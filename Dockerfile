# syntax=docker/dockerfile:1.7
# ---- build stage: compile the Vite client ---------------------------------
FROM node:26-alpine AS builder
WORKDIR /app
ENV CI=1
COPY package.json package-lock.json ./
# Reproducible install from the lockfile; dev deps are needed for the build.
# --ignore-scripts: the client build never loads better-sqlite3, whose install script
# (`prebuild-install || node-gyp rebuild`) would otherwise try to (re)download a binary
# and, if that fails, fall back to a node-gyp compile that needs python/make/g++.
# Its binaries already ship inside the package (see the runtime stage below).
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --ignore-scripts
COPY . .
RUN npm run build

# ---- runtime stage: production deps + built assets only ---------------------
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787
COPY package.json package-lock.json ./
# --ignore-scripts: better-sqlite3 ships prebuilt binaries (incl. Alpine/musl) but
# still carries a binding.gyp, which would make npm try a node-gyp rebuild that
# needs python/make/g++. No runtime dependency needs an install script.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund --ignore-scripts \
 && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY dbsetup.cjs ./dbsetup.cjs
# Runs as root on purpose: named volumes created by earlier releases are root-owned
# and must stay writable after an upgrade.
RUN mkdir -p /app/data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/health/live >/dev/null || exit 1
CMD ["sh", "-c", "node ./dbsetup.cjs && node server/index.cjs"]
