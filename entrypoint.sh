#!/bin/sh
echo "============================================="
echo "欢迎使用 VanBlog xxxxx"
echo "Github: https://github.com/mereithhh/vanblog"
echo "Version(Env): ${VAN_BLOG_VERSION}"
echo "============================================="


sed "s/VAN_BLOG_EMAIL/${EMAIL}/g" /app/CaddyfileTemplateLocal >/app/Caddyfile
caddy start --config /app/Caddyfile

node start.js
