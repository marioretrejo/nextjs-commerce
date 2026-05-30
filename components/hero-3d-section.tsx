'use client';

/**
 * Hero3DSection — animated 3D hero built with React Three Fiber.
 *
 * The right column hosts a canvas with a MorphingObject that blends between
 * TorusGeometry → BoxGeometry → DodecahedronGeometry using vertex lerp on
 * every frame.  Emissive materials + a point light create the neon-glow look.
 *
 * ── Swap 3D canvas for a Spline scene ─────────────────────────────────────
 * Replace the <Canvas> block with:
 *
 *   <iframe
 *     src="https://my.spline.design/YOUR-SCENE-ID/"
 *     className="w-full h-full rounded-3xl border-0"
 *     allow="autoplay"
 *   />
 *
 * and remove the react-three-fiber / drei / three imports.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MorphingObjectProps {
  speed?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lerp two Float32Arrays of equal length, writing result into `out`. */
function lerpAttributes(
  out: Float32Array,
  a: Float32Array,
  b: Float32Array,
  t: number
): void {
  for (let i = 0; i < out.length; i++) {
    out[i] = a[i]! + (b[i]! - a[i]!) * t;
  }
}

/**
 * Pad or truncate a Float32Array to `targetLen`.
 * This normalises vertex counts so we can lerp between geometries that
 * have different triangle counts.
 */
function normaliseAttribute(src: Float32Array, targetLen: number): Float32Array {
  if (src.length === targetLen) return src;
  const out = new Float32Array(targetLen);
  for (let i = 0; i < targetLen; i++) {
    out[i] = src[i % src.length]!;
  }
  return out;
}

// ── MorphingObject ────────────────────────────────────────────────────────────

function MorphingObject({ speed = 0.4 }: MorphingObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Bake the three target geometries once.  We force them to the same vertex
  // count (the largest of the three) so lerp always works element-by-element.
  const { positions, normals, targetLen } = useMemo(() => {
    const geoTorus  = new THREE.TorusGeometry(1, 0.38, 48, 96);
    const geoBox    = new THREE.BoxGeometry(1.7, 1.7, 1.7, 6, 6, 6);
    const geoDodec  = new THREE.DodecahedronGeometry(1.3, 2);

    // Convert to non-indexed so every triangle has its own vertices (needed
    // for per-face normal recomputation after lerp).
    [geoTorus, geoBox, geoDodec].forEach(g => g.toNonIndexed());

    const posA = geoTorus.attributes.position!.array as Float32Array;
    const posB = geoBox.attributes.position!.array as Float32Array;
    const posC = geoDodec.attributes.position!.array as Float32Array;

    const norA = geoTorus.attributes.normal!.array as Float32Array;
    const norB = geoBox.attributes.normal!.array as Float32Array;
    const norC = geoDodec.attributes.normal!.array as Float32Array;

    const len = Math.max(posA.length, posB.length, posC.length);

    return {
      positions: [
        normaliseAttribute(posA, len),
        normaliseAttribute(posB, len),
        normaliseAttribute(posC, len),
      ] as [Float32Array, Float32Array, Float32Array],
      normals: [
        normaliseAttribute(norA, len),
        normaliseAttribute(norB, len),
        normaliseAttribute(norC, len),
      ] as [Float32Array, Float32Array, Float32Array],
      targetLen: len,
    };
  }, []);

  // Working arrays that will be mutated each frame.
  const workPos = useMemo(() => new Float32Array(targetLen), [targetLen]);
  const workNor = useMemo(() => new Float32Array(targetLen), [targetLen]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed;

    // Cycle: 0→1 torus→box, 1→2 box→dodec, 2→3 dodec→torus (wraps)
    const phase   = t % 3;         // [0, 3)
    const segment = Math.floor(phase);          // 0, 1, or 2
    const frac    = phase - segment;            // [0, 1) within segment
    // Ease in-out so morphs feel smooth at both ends
    const eased   = frac * frac * (3 - 2 * frac);

    const targets: [0 | 1 | 2, 0 | 1 | 2][] = [[0, 1], [1, 2], [2, 0]];
    const [from, to] = targets[segment]!;

    lerpAttributes(workPos, positions[from], positions[to], eased);
    lerpAttributes(workNor, normals[from], normals[to], eased);

    const geo = meshRef.current.geometry;
    const posAttr = geo.attributes.position!;
    const norAttr = geo.attributes.normal!;
    (posAttr.array as Float32Array).set(workPos);
    (norAttr.array as Float32Array).set(workNor);
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;

    // Slow continuous rotation so the shape never looks static
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.4;
    meshRef.current.rotation.y = t * 0.25;
    meshRef.current.rotation.z = Math.cos(t * 0.2) * 0.15;
  });

  // Seed geometry — any shape with targetLen vertices works; we overwrite
  // every frame anyway.
  const seedGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(targetLen), 3));
    g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(targetLen), 3));
    return g;
  }, [targetLen]);

  return (
    <mesh ref={meshRef} geometry={seedGeo} castShadow>
      <meshStandardMaterial
        color="#7c3aed"
        emissive="#4c1d95"
        emissiveIntensity={0.6}
        metalness={0.3}
        roughness={0.25}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Glow ring (decorative) ────────────────────────────────────────────────────

function GlowRing() {
  const meshRef = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    meshRef.current.rotation.z = clock.getElapsedTime() * 0.15;
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.3;
  });
  return (
    <mesh ref={meshRef} scale={[2.4, 2.4, 2.4]}>
      <torusGeometry args={[1, 0.015, 8, 120]} />
      <meshStandardMaterial
        color="#a78bfa"
        emissive="#7c3aed"
        emissiveIntensity={1.2}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

// ── Floating particles ────────────────────────────────────────────────────────

function Particles({ count = 120 }: { count?: number }) {
  const meshRef = useRef<THREE.Points>(null!);

  const { positions, sizes } = useMemo(() => {
    const pos   = new Float32Array(count * 3);
    const sz    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 2.2 + Math.random() * 1.8;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      sz[i]          = Math.random() * 3 + 1;
    }
    return { positions: pos, sizes: sz };
  }, [count]);

  useFrame(({ clock }) => {
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.06;
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.04) * 0.15;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size"     args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color="#c4b5fd"
        size={0.04}
        sizeAttenuation
        transparent
        opacity={0.7}
      />
    </points>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 4]}  intensity={40} color="#a78bfa" />
      <pointLight position={[-4, -3, -2]} intensity={20} color="#6d28d9" />
      <pointLight position={[0, 0, 3]}  intensity={15} color="#ffffff" />

      {/* Objects */}
      <MorphingObject speed={0.35} />
      <GlowRing />
      <Particles count={100} />

      {/* Slow orbit — disabled pointer interaction to keep hero scrollable */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

export function Hero3DSection() {
  return (
    <section
      className="relative min-h-screen w-full flex items-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 40%, #4c1d95 0%, #1e1b4b 35%, #0a0a0a 100%)',
      }}
    >
      {/* Subtle dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle, #a78bfa 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 lg:py-0">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">

          {/* ── Left column: copy ── */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:flex-1">

            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-950/40 px-4 py-1.5 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-[11px] font-semibold tracking-widest text-violet-300 uppercase">
                Plataforma de Voz IA
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              Asistente de
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 50%, #c4b5fd 100%)',
                }}
              >
                voz IA
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 max-w-md text-base leading-relaxed text-violet-200/70 lg:text-lg">
              Despliega agentes de voz inteligentes en segundos.
              Conecta con tus clientes por teléfono con IA que entiende,
              responde y actúa en tiempo real.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                className="group relative overflow-hidden rounded-xl bg-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/50 transition-all duration-200 hover:bg-violet-500 hover:shadow-violet-700/50 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Empezar gratis
                  <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </span>
                {/* Shimmer overlay */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </button>

              <button className="rounded-xl border border-violet-500/30 bg-white/5 px-7 py-3.5 text-sm font-semibold text-violet-200 backdrop-blur-sm transition-all duration-200 hover:border-violet-400/50 hover:bg-white/10 hover:-translate-y-0.5">
                Ver demo en vivo
              </button>
            </div>

            {/* Social proof */}
            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-2">
                {['A', 'B', 'C', 'D'].map((l, i) => (
                  <div
                    key={l}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0a0a0a] text-[10px] font-bold text-white"
                    style={{ background: ['#7c3aed','#6d28d9','#5b21b6','#4c1d95'][i] }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-xs text-violet-300/70">
                <span className="font-semibold text-violet-200">+2 400</span> empresas confían en VoiceOS
              </p>
            </div>
          </div>

          {/* ── Right column: 3D canvas ── */}
          <div className="relative w-full max-w-sm lg:max-w-none lg:flex-1 lg:max-w-[520px]">

            {/* Laptop-style frame */}
            <div className="relative mx-auto w-full max-w-[480px]">
              {/* Screen bezel */}
              <div className="relative rounded-[20px] border border-violet-500/20 bg-[#0d0d1a] p-1 shadow-2xl shadow-violet-950/80">
                {/* Browser bar */}
                <div className="mb-1 flex items-center gap-1.5 px-3 py-2">
                  {['#ff5f57','#febc2e','#28c840'].map((c, i) => (
                    <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
                  ))}
                  <div className="ml-2 flex-1 rounded bg-white/5 px-3 py-0.5 text-[10px] text-violet-400/50 font-mono truncate">
                    voiceos.app/agent/live
                  </div>
                </div>

                {/* Canvas area */}
                <div
                  className="relative overflow-hidden rounded-[12px]"
                  style={{ aspectRatio: '4/3' }}
                >
                  {/* Radial glow behind canvas */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(ellipse 70% 70% at 50% 50%, #4c1d9540 0%, transparent 70%)',
                    }}
                  />

                  <Canvas
                    camera={{ position: [0, 0, 4.5], fov: 55 }}
                    gl={{ antialias: true, alpha: true }}
                    style={{ background: 'transparent' }}
                    className="w-full h-full"
                  >
                    <Suspense fallback={null}>
                      <Scene />
                    </Suspense>
                  </Canvas>

                  {/* Status overlay */}
                  <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                    <span className="text-[10px] font-medium text-green-300">Agente activo · 0 ms latencia</span>
                  </div>
                </div>
              </div>

              {/* Laptop stand */}
              <div className="mx-auto h-3 w-1/3 rounded-b-lg bg-gradient-to-b from-violet-900/30 to-transparent" />
              <div className="mx-auto h-1 w-1/2 rounded-b-xl bg-violet-900/20" />

              {/* Ambient glow below */}
              <div
                className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-16 blur-3xl"
                style={{ background: 'radial-gradient(ellipse, #7c3aed55 0%, transparent 70%)' }}
              />
            </div>

            {/* Floating stats cards */}
            <div className="absolute -left-4 top-8 hidden lg:block">
              <div className="rounded-xl border border-violet-500/20 bg-black/60 px-4 py-3 backdrop-blur-md shadow-xl">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">Llamadas hoy</p>
                <p className="mt-0.5 text-2xl font-bold text-white">1 247</p>
                <p className="text-[10px] text-green-400">↑ 18% vs ayer</p>
              </div>
            </div>

            <div className="absolute -right-4 bottom-16 hidden lg:block">
              <div className="rounded-xl border border-violet-500/20 bg-black/60 px-4 py-3 backdrop-blur-md shadow-xl">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400">Tasa de éxito</p>
                <p className="mt-0.5 text-2xl font-bold text-white">94%</p>
                <p className="text-[10px] text-green-400">↑ Top 3% industria</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
    </section>
  );
}
