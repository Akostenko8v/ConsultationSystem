FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Generate Prisma Client without embedding the actual database credentials.
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate --config ./prisma7.config.ts
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --config ./prisma7.config.ts && node dist/main.js"]
