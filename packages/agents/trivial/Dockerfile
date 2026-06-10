FROM node:22-alpine AS build
WORKDIR /app

# Copy workspace root and all packages needed for this service.
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/lean-index ./packages/lean-index
COPY packages/agent-facts ./packages/agent-facts
COPY packages/agents/shared ./packages/agents/shared
COPY packages/agents/trivial ./packages/agents/trivial

RUN npm install --workspaces --if-present
RUN npm run build --workspace packages/shared
RUN npm run build --workspace packages/lean-index
RUN npm run build --workspace packages/agent-facts
RUN npm run build --workspace packages/agents/shared
RUN npm run build --workspace packages/agents/trivial

FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/lean-index/dist ./packages/lean-index/dist
COPY --from=build /app/packages/lean-index/package.json ./packages/lean-index/
COPY --from=build /app/packages/agent-facts/dist ./packages/agent-facts/dist
COPY --from=build /app/packages/agent-facts/package.json ./packages/agent-facts/
COPY --from=build /app/packages/agents/shared/dist ./packages/agents/shared/dist
COPY --from=build /app/packages/agents/shared/package.json ./packages/agents/shared/
COPY --from=build /app/packages/agents/trivial/dist ./packages/agents/trivial/dist
COPY --from=build /app/packages/agents/trivial/package.json ./packages/agents/trivial/

RUN npm install --workspaces --if-present --omit=dev

EXPOSE 8445

CMD ["node", "packages/agents/trivial/dist/server-entry.js"]
