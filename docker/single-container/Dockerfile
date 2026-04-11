FROM eclipse-temurin:21-jdk AS backend-builder

WORKDIR /workspace/backend

COPY backend/gradlew ./
COPY backend/gradle ./gradle
COPY backend/build.gradle backend/settings.gradle ./
COPY backend/src ./src

RUN sed -i 's/\r$//' gradlew && chmod +x gradlew
RUN ./gradlew --no-daemon bootJar

FROM node:20.19-alpine AS frontend-builder

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

RUN npm run build

FROM eclipse-temurin:21-jre-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Seoul

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        curl \
        mariadb-client \
        mariadb-server \
        nginx \
        supervisor \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

RUN rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

RUN mkdir -p \
        /app/backend \
        /data/logs \
        /data/backups \
        /data/tmp/exports \
        /run/mysqld

COPY --from=backend-builder /workspace/backend/build/libs/*.jar /app/backend/app.jar
COPY backend/docker-entrypoint.sh /app/backend/docker-entrypoint.sh
COPY backend/src/main/resources/schema.sql /app/backend/schema.sql
COPY --from=frontend-builder /workspace/frontend/dist /usr/share/nginx/html
COPY docker/single-container/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/single-container/init-db.sh /usr/local/bin/init-db.sh
COPY docker/single-container/start-backend.sh /usr/local/bin/start-backend.sh
COPY docker/single-container/start-nginx.sh /usr/local/bin/start-nginx.sh
COPY docker/single-container/supervisord.conf /etc/supervisor/conf.d/single-container.conf
COPY docker/single-container/nginx.conf /etc/nginx/conf.d/default.conf

RUN ln -sf /app/backend/app.jar /app/app.jar \
    && ln -sf /app/backend/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN chmod +x \
        /app/backend/docker-entrypoint.sh \
        /usr/local/bin/entrypoint.sh \
        /usr/local/bin/init-db.sh \
        /usr/local/bin/start-backend.sh \
        /usr/local/bin/start-nginx.sh

EXPOSE 4173

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
