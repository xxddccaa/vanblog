FROM node:18-alpine AS runner
WORKDIR /app/website
ARG VANBLOG_IMAGE_NAME="vanblog-website"
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
    && apk del tzdata

COPY packages/website/.next/standalone/ ./
COPY packages/website/next.config.js ./packages/website/next.config.js
COPY packages/website/public ./packages/website/public
COPY packages/website/package.json ./packages/website/package.json
COPY packages/website/.next/static ./packages/website/.next/static
COPY docker/website/runner.cjs ./runner.cjs

ENV NODE_ENV=production
ENV PORT=3001
ENV WEBSITE_CONTROL_PORT=3011
ENV VAN_BLOG_SERVER_URL="http://server:3000"
ENV VAN_BLOG_REVALIDATE="false"
ENV VAN_BLOG_ALLOW_DOMAINS="pic.mereith.com"

EXPOSE 3001 3011
CMD ["node", "runner.cjs"]
