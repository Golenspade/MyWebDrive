# syntax=docker/dockerfile:1
FROM nginxinc/nginx-unprivileged:1.27.4-alpine@sha256:62a904036bfc0e4a4f2b556e34cbf17bc136b47fde8cdb4628762725f48c5782

COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf

USER nginx
EXPOSE 8080
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]
