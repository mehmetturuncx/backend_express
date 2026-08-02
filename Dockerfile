# 1. Base Image: Hangi işletim sistemi ve Node sürümünü kullanacağız?
FROM node:20-alpine

# 2. Çalışma Dizini: Konteyner içindeki klasörümüz
WORKDIR /app

# 3. Bağımlılık Dosyalarını Kopyala
COPY package*.json ./
COPY prisma ./prisma/

# 4. Bağımlılıkları Kur
RUN npm install --legacy-peer-deps

# 5. Prisma Client'ı oluştur (Veritabanı için şart)
RUN npx prisma generate

# 6. Kodların Tamamını Kopyala
COPY . .

# 7. TypeScript Kodunu Derle (Projen npm run build komutuna sahipse)
RUN npm run build

# 8. Konteyner Dışına Açılacak Port
EXPOSE 3000

# 9. Uygulamayı Başlatma Komutu
CMD ["npm", "start"]