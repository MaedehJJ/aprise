# ── Next.js — development image ───────────────────────────────────────────
# Installs dependencies inside the image; the source tree is bind-mounted
# at runtime (docker-compose) so edits hot-reload without a rebuild.
# node_modules are intentionally kept in the image layer so that
# platform-specific binaries (e.g. @swc/core) match the container OS.

FROM node:22-slim AS base

WORKDIR /app

# ── Install dependencies ───────────────────────────────────────────────────
COPY package.json package-lock.json ./
RUN npm install

# ── Copy source ────────────────────────────────────────────────────────────
# In docker-compose dev mode the whole repo is bind-mounted, so this layer
# is only used when building a standalone image (e.g. for CI or staging).
COPY . .

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "dev"]
