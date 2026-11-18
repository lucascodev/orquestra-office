FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production PORT=8420 WEB_DIR=/app/web DATA_DIR=/data SITE_DIR=/site
RUN mkdir -p /data /app/web /site && chown node:node /data
USER node
EXPOSE 8420
CMD ["node", "src/main.js"]
