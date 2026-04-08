FROM nginx:1.27-alpine AS runner
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
    && apk add --no-cache wget
COPY packages/admin/dist/ /usr/share/nginx/html/admin/
COPY packages/admin/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 3002
