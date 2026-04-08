FROM nginx:1.27-alpine AS runner
ARG VANBLOG_IMAGE_NAME="vanblog-admin"
ARG VANBLOG_IMAGE_VERSION="dev"
ARG VANBLOG_IMAGE_ID="local"
LABEL org.opencontainers.image.title="${VANBLOG_IMAGE_NAME}" \
      org.opencontainers.image.version="${VANBLOG_IMAGE_VERSION}" \
      org.opencontainers.image.revision="${VANBLOG_IMAGE_ID}" \
      io.vanblog.image.name="${VANBLOG_IMAGE_NAME}" \
      io.vanblog.image.version="${VANBLOG_IMAGE_VERSION}" \
      io.vanblog.image.id="${VANBLOG_IMAGE_ID}"
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories \
    && apk add --no-cache wget
COPY packages/admin/dist/ /usr/share/nginx/html/admin/
COPY packages/admin/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 3002
