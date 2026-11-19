FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production PORT=8420 OFFICE_HOST=0.0.0.0 WEB_DIR=/app/web DATA_DIR=/data OFFICE_SECRET_FILE=/run/secrets/office_secret
RUN mkdir -p /data /app/web && chown node:node /data
USER node
EXPOSE 8420
CMD ["node", "src/main.js"]
