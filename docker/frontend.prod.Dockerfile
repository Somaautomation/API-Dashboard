FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install --no-audit --no-fund

COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/internal/frontend/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=3s --retries=5 CMD wget -q -O- http://127.0.0.1/healthz || exit 1
