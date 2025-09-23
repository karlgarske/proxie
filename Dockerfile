# build the react client
FROM node:20.18.0-alpine AS client-builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
COPY client/package.json ./client/
RUN npm install --omit=dev --workspaces=false || npm install --workspaces=false || true
WORKDIR /app/client
RUN npm install || true
COPY client/ ./
RUN npm run build || true

# build the nginx image used for ingress
FROM nginx:1.27-alpine
WORKDIR /app

# Copy only the built artifacts to the final image
COPY --from=client-builder /app/client/dist /usr/share/nginx/html

# remove default config
RUN rm -f /etc/nginx/conf.d/default.conf

# use our proxy config as the new default
COPY proxy/nginx.conf /etc/nginx/conf.d/default.conf
