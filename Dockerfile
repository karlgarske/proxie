# Multi-stage build: client and api

FROM node:18-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
COPY client/package.json ./client/
RUN npm install --omit=dev --workspaces=false || npm install --workspaces=false || true
WORKDIR /app/client
RUN npm install || true
COPY client/ ./
RUN npm run build || true

FROM node:18-alpine AS api-builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
COPY api/package.json ./api/
RUN npm install --omit=dev --workspaces=false || npm install --workspaces=false
WORKDIR /app/api
RUN npm install
COPY api/ ./
RUN npm run build
# Strip dev dependencies for runtime
RUN npm prune --omit=dev

FROM node:18-alpine
WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx gettext
RUN mkdir -p /run/nginx

# Copy only the built artifacts to the final image
COPY --from=client-builder /app/client/dist /usr/share/nginx/html
COPY --from=api-builder /app/api/dist /app/api/dist
COPY --from=api-builder /app/api/package.json /app/api/package.json
WORKDIR /app/api
# Install only production dependencies for runtime
RUN npm install --omit=dev
WORKDIR /app

# Copy proxy template and start script
COPY docker/nginx.conf.template /etc/nginx/nginx.conf.template
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

ENV PORT=8080
EXPOSE 8080

CMD ["/start.sh"]
