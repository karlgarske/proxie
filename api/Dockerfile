FROM node:20.18.0-alpine AS api-builder
WORKDIR /app/api
COPY api/package*.json ./
RUN npm install
COPY api/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:20.18.0-alpine
WORKDIR /app
COPY --from=api-builder /app/api/package*.json ./
COPY --from=api-builder /app/api/node_modules ./node_modules
COPY --from=api-builder /app/api/dist ./dist
COPY --from=api-builder /app/api/prompts ./prompts

CMD ["node", "dist/index.js"]
