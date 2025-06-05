FROM node:18-alpine AS server_builder
ENV NODE_OPTIONS=--max_old_space_size=4096
WORKDIR /app
COPY ./packages/server/ .
RUN corepack enable
RUN corepack prepare pnpm@9.15.3 --activate
RUN pnpm config set network-timeout 600000 -g
RUN pnpm config set registry https://registry.npmmirror.com -g
RUN pnpm config set fetch-retries 20 -g
RUN pnpm config set fetch-timeout 600000 -g
RUN pnpm i
RUN pnpm build

FROM node:18-alpine AS website_builder
WORKDIR /app
RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*
COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY ./pnpm-workspace.yaml ./
COPY ./tsconfig.base.json ./
COPY ./packages/website ./packages/website
ENV isBuild t
ENV VAN_BLOG_ALLOW_DOMAINS "pic.mereith.com"
ARG VAN_BLOG_BUILD_SERVER
ENV VAN_BLOG_SERVER_URL ${VAN_BLOG_BUILD_SERVER}
ARG VAN_BLOG_VERSIONS
ENV VAN_BLOG_VERSION ${VAN_BLOG_VERSIONS}
RUN corepack enable
RUN corepack prepare pnpm@9.15.3 --activate
RUN pnpm config set network-timeout 600000 -g
RUN pnpm config set registry https://registry.npmmirror.com -g
RUN pnpm config set fetch-retries 20 -g
RUN pnpm config set fetch-timeout 600000 -g
RUN pnpm install
RUN pnpm build:website


FROM  node:18-alpine AS admin_builder
ENV NODE_OPTIONS='--max_old_space_size=4096 --openssl-legacy-provider'
ENV EEE=production
WORKDIR /app
USER root
RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*
COPY ./packages/admin/ ./
RUN corepack enable
RUN corepack prepare pnpm@9.15.3 --activate
RUN pnpm config set network-timeout 600000 -g
RUN pnpm config set registry https://registry.npmmirror.com -g
RUN pnpm config set fetch-retries 20 -g
RUN pnpm config set fetch-timeout 600000 -g
RUN pnpm i
# RUN sed -i 's/\/assets/\/admin\/assets/g' dist/admin/index.html
RUN pnpm build

#运行容器
FROM node:18-alpine AS runner
WORKDIR /app
RUN  apk add --no-cache --update tzdata caddy nss-tools libwebp-tools \
  && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && echo "Asia/Shanghai" > /etc/timezone \
  && apk del tzdata
RUN corepack enable
RUN corepack prepare pnpm@9.15.3 --activate
RUN pnpm config set network-timeout 600000 -g
RUN pnpm config set registry https://registry.npmmirror.com -g
RUN pnpm config set fetch-retries 20 -g
RUN pnpm config set fetch-timeout 600000 -g
# 复制 cli 工具
WORKDIR /app/cli
COPY ./packages/cli/ ./
RUN pnpm i
# 安装 waline
WORKDIR /app/waline
COPY ./packages/waline/ ./
RUN pnpm i
# 复制 server
WORKDIR /app/server
COPY --from=server_builder /app/node_modules ./node_modules
COPY --from=server_builder /app/dist/src/ ./
# 复制 website
WORKDIR /app/website
COPY --from=website_builder  /app/packages/website/.next/standalone/ ./
COPY --from=website_builder /app/packages/website/next.config.js ./packages/website/next.config.js
COPY --from=website_builder /app/packages/website/public ./packages/website/public
COPY --from=website_builder /app/packages/website/package.json ./packages/website/package.json
COPY --from=website_builder  /app/packages/website/.next/static ./packages/website/.next/static
RUN  cd  /app/website  && cd ..
ENV NODE_ENV production
ENV VAN_BLOG_SERVER_URL "http://127.0.0.1:3000"
ENV VAN_BLOG_ALLOW_DOMAINS "pic.mereith.com"
ENV VAN_BLOG_DATABASE_URL "mongodb://mongo:27017/vanBlog?authSource=admin"
ENV EMAIL "vanblog@mereith.com"
ENV VAN_BLOG_WALINE_DB "waline"
# 复制静态文件
WORKDIR /app/admin
COPY --from=admin_builder /app/dist/ ./
COPY caddyTemplate.json /app/caddyTemplate.json
COPY CaddyfileTemplateLocal /app/CaddyfileTemplateLocal
# 复制入口文件
WORKDIR /app
COPY ./scripts/start.js ./
COPY ./entrypoint.sh ./
ENV PORT 3001
# 增加版本
ARG VAN_BLOG_VERSIONS
ENV VAN_BLOG_VERSION ${VAN_BLOG_VERSIONS}
VOLUME /app/static
VOLUME /var/log
VOLUME /root/.config/caddy
VOLUME /root/.local/share/caddy

EXPOSE 80
ENTRYPOINT [ "sh","entrypoint.sh" ]
# CMD [ "entrypoint.sh" ]
