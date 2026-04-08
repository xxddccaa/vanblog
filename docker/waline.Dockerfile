FROM node:18-alpine AS runner
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app/waline
ARG VANBLOG_IMAGE_NAME="vanblog-waline"
ARG VANBLOG_IMAGE_VERSION="dev"
ARG VANBLOG_IMAGE_ID="local"
LABEL org.opencontainers.image.title="${VANBLOG_IMAGE_NAME}" \
      org.opencontainers.image.version="${VANBLOG_IMAGE_VERSION}" \
      org.opencontainers.image.revision="${VANBLOG_IMAGE_ID}" \
      io.vanblog.image.name="${VANBLOG_IMAGE_NAME}" \
      io.vanblog.image.version="${VANBLOG_IMAGE_VERSION}" \
      io.vanblog.image.id="${VANBLOG_IMAGE_ID}"

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
    && apk add --no-cache --update tzdata curl \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && corepack enable \
    && corepack prepare pnpm@9.15.3 --activate \
    && pnpm config set network-timeout 600000 -g \
    && pnpm config set registry https://registry.npmmirror.com -g \
    && pnpm config set fetch-retries 20 -g \
    && pnpm config set fetch-timeout 600000 -g

COPY packages/waline/package.json ./package.json
RUN pnpm install --prod

WORKDIR /app
COPY scripts/fix-waline-dashboard.js ./scripts/fix-waline-dashboard.js
COPY docker/waline/runner.cjs ./waline/runner.cjs
RUN node ./scripts/fix-waline-dashboard.js

WORKDIR /app/waline
ENV NODE_ENV=production
ENV PORT=8360
ENV WALINE_CONTROL_PORT=8361

EXPOSE 8360 8361
CMD ["node", "runner.cjs"]
