FROM node:18-alpine AS base
ENV NODE_OPTIONS=--max_old_space_size=4096
WORKDIR /app

# Install system dependencies (only for building)
RUN apk add --no-cache --update python3 make g++ tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata

# Configure pnpm
RUN corepack enable \
    && corepack prepare pnpm@9.15.3 --activate \
    && pnpm config set network-timeout 600000 -g \
    && pnpm config set registry https://registry.npmmirror.com -g \
    && pnpm config set fetch-retries 20 -g \
    && pnpm config set fetch-timeout 600000 -g

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/website/package.json ./packages/website/
COPY packages/admin/package.json ./packages/admin/
COPY packages/cli/package.json ./packages/cli/
COPY packages/waline/package.json ./packages/waline/

# Install all dependencies (including devDependencies for building)
RUN pnpm install

# Build server
FROM base AS server_builder
WORKDIR /app
COPY ./packages/server/ ./packages/server/
WORKDIR /app/packages/server
RUN pnpm build

# Build website
FROM base AS website_builder
WORKDIR /app
COPY ./packages/website ./packages/website
WORKDIR /app/packages/website
ENV isBuild=true
ENV VAN_BLOG_ALLOW_DOMAINS="pic.mereith.com"
ARG VAN_BLOG_BUILD_SERVER
ENV VAN_BLOG_SERVER_URL=${VAN_BLOG_BUILD_SERVER}
ARG VAN_BLOG_VERSIONS
ENV VAN_BLOG_VERSION=${VAN_BLOG_VERSIONS}
RUN pnpm build

# Build admin
FROM base AS admin_builder
WORKDIR /app
COPY ./packages/admin/ ./packages/admin/
WORKDIR /app/packages/admin
ENV NODE_OPTIONS='--max_old_space_size=4096 --openssl-legacy-provider'
ENV EEE=production
RUN pnpm build

# Final runtime image
FROM node:18-alpine AS runner
WORKDIR /app

# Install ONLY runtime dependencies (no build tools)
RUN apk add --no-cache --update tzdata caddy nss-tools libwebp-tools wget unzip \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && corepack enable \
    && corepack prepare pnpm@9.15.3 --activate \
    && pnpm config set network-timeout 600000 -g \
    && pnpm config set registry https://registry.npmmirror.com -g \
    && pnpm config set fetch-retries 20 -g \
    && pnpm config set fetch-timeout 600000 -g

# Install aliyunpan (阿里云盘命令行工具)
RUN ARCH=$(uname -m) \
    && if [ "$ARCH" = "x86_64" ]; then ALIYUNPAN_ARCH="amd64"; elif [ "$ARCH" = "aarch64" ]; then ALIYUNPAN_ARCH="arm64"; else ALIYUNPAN_ARCH="amd64"; fi \
    && ALIYUNPAN_VERSION="v0.3.7" \
    && wget -O /tmp/aliyunpan.zip "https://github.com/tickstep/aliyunpan/releases/download/${ALIYUNPAN_VERSION}/aliyunpan-${ALIYUNPAN_VERSION}-linux-${ALIYUNPAN_ARCH}.zip" \
    && unzip /tmp/aliyunpan.zip -d /tmp/ \
    && mv /tmp/aliyunpan-${ALIYUNPAN_VERSION}-linux-${ALIYUNPAN_ARCH}/aliyunpan /usr/local/bin/ \
    && chmod +x /usr/local/bin/aliyunpan \
    && rm -rf /tmp/aliyunpan* \
    && aliyunpan --version

# Copy CLI tool with PRODUCTION dependencies only
WORKDIR /app/cli
COPY ./packages/cli/ ./
COPY packages/cli/package.json ./package.json
RUN pnpm install --prod

# Copy Waline with PRODUCTION dependencies only
WORKDIR /app/waline
COPY ./packages/waline/ ./
COPY packages/waline/package.json ./package.json
RUN pnpm install --prod

# Copy server with PRODUCTION dependencies only
WORKDIR /app/server
COPY --from=server_builder /app/packages/server/dist/src/ ./
COPY packages/server/package.json ./package.json
RUN pnpm install --prod

# Copy website (static files, no additional dependencies needed)
WORKDIR /app/website
COPY --from=website_builder /app/packages/website/.next/standalone/ ./
COPY --from=website_builder /app/packages/website/next.config.js ./packages/website/next.config.js
COPY --from=website_builder /app/packages/website/public ./packages/website/public
COPY --from=website_builder /app/packages/website/package.json ./packages/website/package.json
COPY --from=website_builder /app/packages/website/.next/static ./packages/website/.next/static

# Copy admin static files (no dependencies needed)
WORKDIR /app/admin
COPY --from=admin_builder /app/packages/admin/dist/ ./

# Copy configuration files
WORKDIR /app
COPY caddyTemplate.json /app/caddyTemplate.json
COPY CaddyfileTemplateLocal /app/CaddyfileTemplateLocal
COPY ./scripts/start.js ./
COPY ./entrypoint.sh ./

# Set production environment variables
ENV NODE_ENV=production
ENV VAN_BLOG_SERVER_URL="http://127.0.0.1:3000"
ENV VAN_BLOG_ALLOW_DOMAINS="pic.mereith.com"
ENV VAN_BLOG_DATABASE_URL="mongodb://mongo:27017/vanBlog?authSource=admin"
ENV EMAIL="vanblog@mereith.com"
ENV VAN_BLOG_WALINE_DB="waline"
ENV PORT=3001
ARG VAN_BLOG_VERSIONS
ENV VAN_BLOG_VERSION=${VAN_BLOG_VERSIONS}

# Define volumes
VOLUME /app/static
VOLUME /var/log
VOLUME /root/.config/caddy
VOLUME /root/.local/share/caddy
VOLUME /root/.config/aliyunpan

EXPOSE 80
ENTRYPOINT [ "sh","entrypoint.sh" ]