FROM nginx
RUN mkdir /app
COPY ./dist/index.html /app/index.html
COPY ./dist /app/dist/
COPY nginx.conf /etc/nginx/nginx.conf
