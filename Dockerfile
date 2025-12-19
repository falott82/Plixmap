FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY dbsetup.js ./dbsetup.js
RUN mkdir -p /app/data
EXPOSE 8787
CMD ["sh", "-c", "node ./dbsetup.js && node server/index.cjs"]
