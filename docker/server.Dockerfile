# syntax=docker/dockerfile:1.7
FROM node:24.14.1-alpine AS base
ENV NODE_OPTIONS="--max_old_space_size=7168"
ENV CI=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV npm_config_playwright_skip_browser_download=true
ENV npm_config_devdir=/tmp/node-gyp
ARG ALPINE_MIRROR_HOST=""
WORKDIR /app

RUN if [ -n "$ALPINE_MIRROR_HOST" ]; then sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR_HOST}/g" /etc/apk/repositories; fi \
    && apk add --no-cache --update python3 make g++ tzdata wget unzip curl nss-tools libwebp-tools \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && corepack enable \
    && corepack prepare pnpm@10.33.0 --activate \
    && pnpm config set network-timeout 600000 -g \
    && pnpm config set registry https://registry.npmmirror.com -g \
    && pnpm config set fetch-retries 20 -g \
    && pnpm config set fetch-timeout 600000 -g

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter @vanblog/server... --frozen-lockfile

FROM base AS builder
COPY packages/server ./packages/server
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter @vanblog/server build \
    && pnpm deploy --legacy --filter @vanblog/server --prod /prod/server

FROM base AS runner
WORKDIR /app/server
ARG VANBLOG_IMAGE_NAME="vanblog-server"
ARG VANBLOG_IMAGE_VERSION="dev"
ARG VANBLOG_IMAGE_ID="local"
LABEL org.opencontainers.image.title="${VANBLOG_IMAGE_NAME}" \
      org.opencontainers.image.version="${VANBLOG_IMAGE_VERSION}" \
      org.opencontainers.image.revision="${VANBLOG_IMAGE_ID}" \
      io.vanblog.image.name="${VANBLOG_IMAGE_NAME}" \
      io.vanblog.image.version="${VANBLOG_IMAGE_VERSION}" \
      io.vanblog.image.id="${VANBLOG_IMAGE_ID}"

ARG INSTALL_ALIYUNPAN=false
RUN if [ "$INSTALL_ALIYUNPAN" = "true" ]; then \
      ARCH=$(uname -m) \
      && if [ "$ARCH" = "x86_64" ]; then ALIYUNPAN_ARCH="amd64"; elif [ "$ARCH" = "aarch64" ]; then ALIYUNPAN_ARCH="arm64"; else ALIYUNPAN_ARCH="amd64"; fi \
      && ALIYUNPAN_VERSION="v0.3.7" \
      && wget -O /tmp/aliyunpan.zip "https://github.com/tickstep/aliyunpan/releases/download/${ALIYUNPAN_VERSION}/aliyunpan-${ALIYUNPAN_VERSION}-linux-${ALIYUNPAN_ARCH}.zip" \
      && unzip /tmp/aliyunpan.zip -d /tmp/ \
      && mv /tmp/aliyunpan-${ALIYUNPAN_VERSION}-linux-${ALIYUNPAN_ARCH}/aliyunpan /usr/local/bin/ \
      && chmod +x /usr/local/bin/aliyunpan \
      && rm -rf /tmp/aliyunpan*; \
    else \
      echo "Skipping aliyunpan install; set INSTALL_ALIYUNPAN=true to enable it."; \
    fi

COPY --from=builder /prod/server/ ./
COPY --from=builder /app/packages/server/dist ./dist
COPY docker/shared/ensure-waline-jwt.cjs /app/ensure-waline-jwt.cjs
COPY docker/server/entrypoint.sh /app/server/entrypoint.sh
RUN chmod +x /app/server/entrypoint.sh

ENV NODE_ENV=production
ENV VAN_BLOG_DATABASE_URL="postgresql://postgres:postgres@postgres:5432/vanblog"
ENV VAN_BLOG_REDIS_URL="redis://redis:6379"
ENV VAN_BLOG_WALINE_DB="waline"
ENV VANBLOG_CADDY_API_URL="http://caddy:2019"
ENV VANBLOG_WEBSITE_CONTROL_URL="http://website:3011"
ENV VANBLOG_WEBSITE_ISR_BASE="http://website:3001/api/revalidate?path="

VOLUME /app/static
VOLUME /var/log
VOLUME /root/.config/aliyunpan

EXPOSE 3000
CMD ["sh", "entrypoint.sh"]
