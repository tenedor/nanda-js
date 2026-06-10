FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/agent-facts/package.json ./packages/agent-facts/

RUN npm ci

# Build shared first, then agent-facts
COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

COPY packages/agent-facts ./packages/agent-facts
RUN npm run build --workspace=packages/agent-facts

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/agent-facts/package.json ./packages/agent-facts/
RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/agent-facts/dist ./packages/agent-facts/dist

RUN mkdir -p /data

EXPOSE 8444
ENV PORT=8444 \
    DB_PATH=/data/agent-facts.db \
    TLS_CERT_PATH=/certs/cert.pem \
    TLS_KEY_PATH=/certs/key.pem \
    LOG_LEVEL=info

CMD ["node", "packages/agent-facts/dist/server-entry.js"]
