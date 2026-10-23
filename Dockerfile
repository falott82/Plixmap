FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk upgrade --no-cache
RUN npm install --global npm@12.2.1 --ignore-scripts --no-audit --no-fund \
    && npm install --prefix /usr/local/lib/node_modules/npm ip-address@10.7.4 --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY dbsetup.cjs ./dbsetup.cjs
RUN mkdir -p /app/data && chown -R node:node /app
# Drop root: the runtime writes only to /app/data (owned by node above).
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8787/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "node ./dbsetup.cjs && exec node server/index.cjs"]
