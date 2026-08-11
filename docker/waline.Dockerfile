# syntax=docker/dockerfile:1.7
FROM node:22.22.2-alpine AS builder
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
ARG ALPINE_MIRROR_HOST=""

RUN if [ -n "$ALPINE_MIRROR_HOST" ]; then sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR_HOST}/g" /etc/apk/repositories; fi \
    && apk add --no-cache --update python3 py3-setuptools make g++ \
    && corepack enable \
    && corepack prepare pnpm@10.33.0 --activate \
    && pnpm config set network-timeout 600000 -g \
    && pnpm config set registry https://registry.npmmirror.com -g \
    && pnpm config set fetch-retries 20 -g \
    && pnpm config set fetch-timeout 600000 -g

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/waline/package.json ./packages/waline/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter @vanblog/waline... --prod --ignore-scripts --frozen-lockfile

FROM node:22.22.2-alpine AS runner
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app
ARG ALPINE_MIRROR_HOST=""
ARG VANBLOG_IMAGE_NAME="vanblog-waline"
ARG VANBLOG_IMAGE_VERSION="dev"
ARG VANBLOG_IMAGE_ID="local"
LABEL org.opencontainers.image.title="${VANBLOG_IMAGE_NAME}" \
      org.opencontainers.image.version="${VANBLOG_IMAGE_VERSION}" \
      org.opencontainers.image.revision="${VANBLOG_IMAGE_ID}" \
      io.vanblog.image.name="${VANBLOG_IMAGE_NAME}" \
      io.vanblog.image.version="${VANBLOG_IMAGE_VERSION}" \
      io.vanblog.image.id="${VANBLOG_IMAGE_ID}"

RUN if [ -n "$ALPINE_MIRROR_HOST" ]; then sed -i "s/dl-cdn.alpinelinux.org/${ALPINE_MIRROR_HOST}/g" /etc/apk/repositories; fi \
    && apk add --no-cache --update tzdata curl postgresql-client su-exec \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && addgroup -S -g 10001 vanblog \
    && adduser -S -D -H -u 10001 -G vanblog vanblog

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/waline /app/packages/waline

COPY docker/shared/ensure-waline-jwt.cjs ./ensure-waline-jwt.cjs
COPY scripts/fix-waline-dashboard.js ./scripts/fix-waline-dashboard.js
COPY scripts/fix-waline-adapter.js ./scripts/fix-waline-adapter.js
COPY docker/waline/entrypoint.sh ./packages/waline/entrypoint.sh
COPY docker/waline/control-auth.cjs ./packages/waline/control-auth.cjs
COPY docker/waline/runner.cjs ./packages/waline/runner.cjs
RUN ln -s /app/packages/waline /app/waline \
    && node ./scripts/fix-waline-dashboard.js \
    && node ./scripts/fix-waline-adapter.js \
    && mkdir -p /app/waline/node_modules/@waline/vercel/runtime/config /var/log /home/vanblog \
    && chown -R vanblog:vanblog /app/waline/node_modules/@waline/vercel/runtime /var/log /home/vanblog

WORKDIR /app/waline
ENV NODE_ENV=production
ENV AKISMET_KEY=false
ENV PORT=8360
ENV WALINE_CONTROL_PORT=8361

VOLUME /var/log

EXPOSE 8360 8361
CMD ["sh", "entrypoint.sh"]
