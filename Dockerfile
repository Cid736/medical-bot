# Bot Telegram — imagen mínima Node.js
FROM node:20-slim

# Directorio de trabajo
WORKDIR /app

# Instala dependencias (solo producción)
COPY package*.json ./
RUN npm install --production

# Copia el código fuente
COPY . .

# Expone el puerto del dashboard
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Inicia la aplicación
CMD ["npm", "start"]
