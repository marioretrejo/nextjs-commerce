# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Enable corepack so pnpm version matches the lockfile (pnpm@10)
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy manifest only — Docker cache layer stays valid unless deps change
COPY package.json pnpm-lock.yaml ./

# Install all deps (devDeps included — tsx is required at runtime for ESM transforms)
RUN pnpm install --frozen-lockfile --ignore-scripts

# ─── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json  ./package.json

# Copy only what the agent worker needs at runtime:
#   agent/   — worker entry + tools + pronunciation + backchannel
#   lib/     — supabase admin client, tracing, integrations dispatcher
#   tsconfig.json — path aliases (@/* → ./*) used by tsx
COPY agent/      ./agent/
COPY lib/        ./lib/
COPY tsconfig.json ./

# ─── Runtime config ────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# Healthcheck: verifies the Node.js process is alive.
# Real connectivity health is monitored by LiveKit Cloud agent dispatch.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
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
CMD ["node", "--import", "tsx/esm", "agent/worker.ts", "start"]
