# ETAPA 1: compilar React con Vite
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build
# Genera la carpeta /app/dist con HTML, CSS y JS listos para producción

# ETAPA 2: servidor Nginx ultra ligero
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
