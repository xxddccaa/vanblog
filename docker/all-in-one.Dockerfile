# syntax=docker/dockerfile:1.7
FROM node:24.14.1-alpine AS builder
ENV NODE_OPTIONS="--max_old_space_size=7168"
ENV CI=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV npm_config_playwright_skip_browser_download=true
ENV npm_config_devdir=/tmp/node-gyp
ARG ALPINE_MIRROR_HOST=""
WORKDIR /app

RUN if [ -n "$ALPINE_MIRROR_HOST" ]; then sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR_HOST}/g" /etc/apk/repositories; fi \
    && apk add --no-cache --update bash git python3 py3-pip make g++ tzdata wget unzip curl nss-tools libwebp-tools libc6-compat \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && corepack enable \
    && corepack prepare pnpm@10.33.0 --activate \
    && pnpm config set network-timeout 600000 -g \
    && pnpm config set registry https://registry.npmmirror.com -g \
    && pnpm config set fetch-retries 20 -g \
    && pnpm config set fetch-timeout 600000 -g

COPY . ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile \
    && pnpm --filter @vanblog/server build \
    && pnpm build:website \
    && pnpm build:admin \
    && pnpm deploy --legacy --filter @vanblog/server --prod /prod/server \
    && pnpm deploy --legacy --filter @vanblog/waline --prod /prod/waline

FROM node:24.14.1-alpine AS runner
WORKDIR /app
ARG ALPINE_MIRROR_HOST=""
ARG VANBLOG_IMAGE_NAME="vanblog-all-in-one"
ARG VANBLOG_IMAGE_VERSION="dev"
ARG VANBLOG_IMAGE_ID="local"
LABEL org.opencontainers.image.title="${VANBLOG_IMAGE_NAME}" \
      org.opencontainers.image.version="${VANBLOG_IMAGE_VERSION}" \
      org.opencontainers.image.revision="${VANBLOG_IMAGE_ID}" \
      io.vanblog.image.name="${VANBLOG_IMAGE_NAME}" \
      io.vanblog.image.version="${VANBLOG_IMAGE_VERSION}" \
      io.vanblog.image.id="${VANBLOG_IMAGE_ID}"

RUN if [ -n "$ALPINE_MIRROR_HOST" ]; then sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR_HOST}/g" /etc/apk/repositories; fi \
    && apk add --no-cache --update bash curl wget nginx caddy redis postgresql16 postgresql16-client postgresql16-contrib su-exec tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && mkdir -p /run/nginx /var/run/postgresql /data/redis /var/lib/postgresql/data /app/static /var/log /root/.config/aliyunpan \
    && chown -R postgres:postgres /var/lib/postgresql /var/run/postgresql

COPY --from=builder /prod/server/ /app/server/
COPY --from=builder /app/packages/server/dist /app/server/dist
COPY --from=builder /app/packages/website/.next/standalone/ /app/website/
COPY --from=builder /app/packages/website/next.config.js /app/website/packages/website/next.config.js
COPY --from=builder /app/packages/website/public /app/website/packages/website/public
COPY --from=builder /app/packages/website/package.json /app/website/packages/website/package.json
COPY --from=builder /app/packages/website/.next/static /app/website/packages/website/.next/static
COPY --from=builder /app/packages/admin/dist /usr/share/nginx/html/admin
COPY --from=builder /prod/waline/ /app/waline/

COPY docker/shared/ensure-waline-jwt.cjs /app/ensure-waline-jwt.cjs
COPY docker/server/entrypoint.sh /app/server/entrypoint.sh
COPY docker/server/terminal-shell.sh /app/server/terminal-shell.sh
COPY docker/website/entrypoint.sh /app/website/entrypoint.sh
COPY docker/website/control-auth.cjs /app/website/control-auth.cjs
COPY docker/website/runner.cjs /app/website/runner.cjs
COPY docker/waline/entrypoint.sh /app/waline/entrypoint.sh
COPY docker/waline/control-auth.cjs /app/waline/control-auth.cjs
COPY docker/waline/runner.cjs /app/waline/runner.cjs
COPY packages/admin/default.conf /etc/nginx/http.d/default.conf
COPY scripts/fix-waline-dashboard.js /app/scripts/fix-waline-dashboard.js
COPY docker/all-in-one/Caddyfile /etc/caddy/Caddyfile
COPY docker/all-in-one/entrypoint.sh /usr/local/bin/vanblog-all-in-one-entrypoint
COPY docker/all-in-one/healthcheck.sh /usr/local/bin/vanblog-all-in-one-healthcheck
RUN chmod +x \
      /app/server/entrypoint.sh \
      /app/server/terminal-shell.sh \
      /app/website/entrypoint.sh \
      /app/waline/entrypoint.sh \
      /usr/local/bin/vanblog-all-in-one-entrypoint \
      /usr/local/bin/vanblog-all-in-one-healthcheck \
    && node /app/scripts/fix-waline-dashboard.js

ENV NODE_ENV=production
ENV POSTGRES_PORT=5432
ENV POSTGRES_DB=vanblog
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
ENV PGDATA=/var/lib/postgresql/data
ENV VANBLOG_REDIS_DIR=/data/redis
ENV VAN_BLOG_WALINE_DB=waline
ENV VAN_BLOG_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/vanblog"
ENV VAN_BLOG_REDIS_URL="redis://127.0.0.1:6379"
ENV VAN_BLOG_WALINE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/waline"
ENV VAN_BLOG_CADDY_MANAGE_HTTPS=false
ENV VANBLOG_CADDY_API_URL="http://127.0.0.1:2019"
ENV VANBLOG_WEBSITE_CONTROL_URL="http://127.0.0.1:3011"
ENV VANBLOG_WALINE_CONTROL_URL="http://127.0.0.1:8361"
ENV VANBLOG_WEBSITE_ISR_BASE="http://127.0.0.1:3001/api/revalidate?path="
ENV PORT=3001
ENV WEBSITE_CONTROL_PORT=3011
ENV WALINE_CONTROL_PORT=8361
ENV WALINE_JWT_TOKEN=""
ENV EMAIL="someone@example.com"

VOLUME /app/static
VOLUME /var/log
VOLUME /root/.config/aliyunpan
VOLUME /root/.config/caddy
VOLUME /root/.local/share/caddy
VOLUME /var/lib/postgresql/data
VOLUME /data/redis

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=10s --retries=10 --start-period=40s CMD ["/usr/local/bin/vanblog-all-in-one-healthcheck"]
CMD ["/usr/local/bin/vanblog-all-in-one-entrypoint"]
