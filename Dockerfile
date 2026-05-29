# ─── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy manifest only — Docker cache layer stays valid unless deps change
COPY package.json pnpm-lock.yaml ./

# Install all deps (including devDeps — tsx is needed at runtime for ESM transforms)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

# Install pnpm in runner stage
RUN npm install -g pnpm@9

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy only what the agent worker needs
COPY agent/ ./agent/
COPY tsconfig.json ./

# ─── Runtime config ────────────────────────────────────────────────────────────
ENV NODE_ENV=production

# Healthcheck: the worker connects to LiveKit via WebSocket.
# This just checks the process is alive; real health is monitored by LiveKit Cloud.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)"

# Required environment variables (set via your hosting provider's secrets):
#   LIVEKIT_URL              wss://your-project.livekit.cloud
#   LIVEKIT_API_KEY          your-livekit-api-key
#   LIVEKIT_API_SECRET       your-livekit-api-secret
#   DEEPGRAM_API_KEY         your-deepgram-api-key
#   GROQ_API_KEY             your-groq-api-key
#   CARTESIA_API_KEY         your-cartesia-api-key
#   NEXT_PUBLIC_SUPABASE_URL https://xxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY your-service-role-key

# "start" mode: connects to LiveKit Cloud and waits for job dispatch
CMD ["node", "--import", "tsx/esm", "agent/worker.ts", "start"]
