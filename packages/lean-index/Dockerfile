FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/lean-index/package.json ./packages/lean-index/

RUN npm ci

# Build shared first, then lean-index
COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

COPY packages/lean-index ./packages/lean-index
RUN npm run build --workspace=packages/lean-index

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/lean-index/package.json ./packages/lean-index/
RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/lean-index/dist ./packages/lean-index/dist

RUN mkdir -p /data

CMD ["node", "packages/lean-index/dist/server-entry.js"]
