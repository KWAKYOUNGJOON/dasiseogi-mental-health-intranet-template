FROM node:20.19-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

FROM nginx:stable-alpine AS runtime

ARG APP_FRONTEND_PORT=4173

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE ${APP_FRONTEND_PORT}
