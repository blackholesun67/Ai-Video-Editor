# Stage 1: Build React
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# build-time config (vite อ่าน VITE_* ตอน build)
#   VITE_API_URL=/api  → same-origin (nginx ในคอนเทนเนอร์นี้ proxy /api → backend:8000 ; Caddy ใช้ค่านี้เหมือนกัน)
#   ตั้งต้น = /api กัน build ซ้ำแล้วหลุดกลับไปเรียก :8000 โดยไม่รู้ตัว
#   ต้องการเรียก backend ตรง ๆ: --build-arg VITE_API_URL=http://host:8000
#   VITE_API_KEY=...   → แนบ X-API-Key อัตโนมัติ (ต้องตรงกับ API_KEYS ฝั่ง backend)
ARG VITE_API_URL=/api
ARG VITE_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_KEY=$VITE_API_KEY
RUN npm run build

# Stage 2: Serve ด้วย Nginx
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]