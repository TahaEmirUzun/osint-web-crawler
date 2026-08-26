# frontend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# Bağımlılıkları kopyala ve kur
COPY package*.json ./
RUN npm install

# Tüm kodları kopyala
COPY . .

# İstenen 3000 portunu aç
EXPOSE 3000

# Vite sunucusunu 3000 portunda ve dışarıya açık başlat
CMD ["npm", "run", "dev", "--", "--port", "3000", "--host", "0.0.0.0"]