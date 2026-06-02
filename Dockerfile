# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Enable corepack so pnpm version matches the lockfile (pnpm@10)
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy manifest only — Docker cache layer stays valid unless deps change
COPY package.json pnpm-lock.yaml ./

# Install all deps (devDeps included — esbuild needs tsx types for bundling)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ─── Stage 2: Bundle with esbuild ─────────────────────────────────────────────
# Pre-compile agent/worker_core.ts into a single ESM bundle so the runtime
# starts in <3 s instead of ~20 s (tsx transpilation overhead). LiveKit's
# supervised_proc spawns child job processes per call — each child must signal
# "ready" within 10 s, so fast startup is critical.
#
# --external:@livekit/*  kept out of the bundle so LiveKit's internal sibling
#                        files (job_proc_lazy_main.mjs etc.) resolve correctly.
# --tsconfig             resolves @/* path aliases from tsconfig.json.
FROM node:22-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json  ./package.json

COPY agent/      ./agent/
COPY lib/        ./lib/
COPY tsconfig.json ./

RUN node_modules/.pnpm/node_modules/.bin/esbuild agent/worker_core.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --target=node22 \
  --tsconfig=tsconfig.json \
  --external:@livekit/* \
  --external:fsevents \
  --outfile=dist/worker.mjs

# ─── Stage 3: Runtime image ────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# npm packages (kept external by esbuild) must be present at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json  ./package.json

# Pre-compiled bundle — no tsx or TypeScript source needed at runtime
COPY --from=builder /app/dist/worker.mjs ./dist/worker.mjs

# ─── Runtime config ────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# Healthcheck: verifies the Node.js process is alive.
# Real connectivity health is monitored by LiveKit Cloud agent dispatch.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "process.exit(0)"

# ─── Required environment variables ───────────────────────────────────────────
# Set ALL of these in your hosting provider's secret/env panel. Never bake into image.
#
#   LIVEKIT_URL               wss://your-project.livekit.cloud
#   LIVEKIT_API_KEY           key_xxxxxxxx
#   LIVEKIT_API_SECRET        secret_xxxxxxxx
#   DEEPGRAM_API_KEY          your-deepgram-api-key
#   GROQ_API_KEY              gsk_xxxxxxxx
#   CARTESIA_API_KEY          your-cartesia-api-key
#   OPENAI_API_KEY            sk-xxxxxxxx          (LLM + TTS fallback + RAG embeddings)
#   NEXT_PUBLIC_SUPABASE_URL  https://xxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY your-service-role-key
#   SUPPORT_TRANSFER_NUMBER   +1XXXXXXXXXX         (optional — E.164 fallback transfer)

# "start" mode: registers with LiveKit Cloud and waits for job dispatch
CMD ["node", "dist/worker.mjs", "start"]
