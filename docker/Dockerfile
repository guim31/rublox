# syntax=docker/dockerfile:1
# Rublox: one image serving the studio, the player and the API.
# Build from the repository root: docker build -f docker/Dockerfile .

ARG NODE_VERSION=24

# ---- build: install the workspace, build the server and both front-ends ----------------------
FROM node:${NODE_VERSION} AS build
ENV CI=true \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
# Corepack is not reliable on Node 24+: install the pinned pnpm with npm.
RUN npm install -g pnpm@12.9.1
WORKDIR /src
COPY . .
RUN --mount=type=cache,id=rublox-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
RUN pnpm turbo run build --filter=@rublox/server --filter=@rublox/studio --filter=@rublox/player
# Server bundle + migrations (`files` of its package.json) + production node_modules only.
RUN --mount=type=cache,id=rublox-pnpm-store,target=/pnpm/store \
    pnpm --filter @rublox/server deploy --prod --store-dir /pnpm/store /out/server

# ---- runtime: only what runs, as a non-root user ---------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
LABEL org.opencontainers.image.title="Rublox" \
      org.opencontainers.image.description="Build real phone apps with blocks." \
      org.opencontainers.image.source="https://github.com/guim31/rublox" \
      org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
WORKDIR /app
# Same layout as the repository, so the server finds `drizzle/` and the front-ends by relative
# path (apps/server/dist -> ../drizzle, ../../studio/dist, ../../player/dist). Files stay owned by
# root: the server only writes to /data.
COPY --from=build /out/server/package.json apps/server/package.json
COPY --from=build /out/server/node_modules apps/server/node_modules
COPY --from=build /out/server/drizzle apps/server/drizzle
COPY --from=build /out/server/dist apps/server/dist
COPY --from=build /src/apps/studio/dist apps/studio/dist
COPY --from=build /src/apps/player/dist apps/player/dist
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/server/dist/index.js"]
