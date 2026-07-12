# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Registry URL is overridden at build time to point to the running Verdaccio
# instance. Podman uses host.containers.internal to reach the host machine —
# so publish-local.sh must have run on the host first.
ARG REGISTRY_URL=http://host.containers.internal:4873

COPY package.json package-lock.json* ./

# Install all deps (including devDeps needed for tsc) from the local registry.
RUN npm install --registry $REGISTRY_URL

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000

# Config is mounted via the compose volume at /app/pulsebridge.config.json.
CMD ["node", "dist/index.js", "pulsebridge.config.json"]
