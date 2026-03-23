FROM node:22-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:22-slim AS runtime

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
ENV PORT=4800
EXPOSE 4800

# SQLite data directory
VOLUME /app/data
ENV MODULAR_DATA_DIR=/app/data

CMD ["node", "dist-server/server/index.js"]
