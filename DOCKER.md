# 🐳 Ejecución del Bot en Docker

Esta guía te muestra cómo ejecutar el bot de WhatsApp usando Docker.

## Requisitos previos

1. **Docker instalado**: Descarga desde [docker.com](https://www.docker.com/products/docker-desktop)
2. **Docker Desktop** (en Windows): Necesario para ejecutar contenedores

## Instalación rápida

### Opción 1: Con Docker Compose (Recomendado)

```bash
# 1. Navega a la carpeta del bot
cd C:\Users\ericc\OneDrive\Desktop\C\dental-bot

# 2. Construye la imagen
docker-compose build

# 3. Arranca el bot
docker-compose up
```

### Opción 2: Con Docker directo

```bash
# 1. Construye la imagen
docker build -t dental-bot .

# 2. Arranca el contenedor
docker run -p 3000:3000 -v wwebjs_auth:/app/.wwebjs_auth dental-bot
```

## 📱 Escanear el QR

Cuando ejecutes el bot, verás el QR en los logs de Docker:

```bash
# En otra terminal (con docker-compose up corriendo):
docker logs dental-bot --follow
```

Busca el mensaje:
```
📱 Escanea este QR con WhatsApp:
```

Luego escanea con tu móvil:
- WhatsApp → 3 puntos (⋮) → **Dispositivos vinculados** → **Vincular dispositivo**
- Escanea el QR

## 🌐 Acceso al Dashboard

Una vez conectado, abre tu navegador:
```
http://localhost:3000
```

## 🧪 Prueba del Bot

Desde otro móvil, envía un WhatsApp al número vinculado escribiendo: **hola**

El bot debería responder automáticamente.

## 📋 Comandos útiles

```bash
# Ver los logs en tiempo real
docker-compose logs -f dental-bot

# Detener el bot
docker-compose down

# Reiniciar el bot
docker-compose restart

# Borrar todo (incluida la autenticación)
docker-compose down -v

# Ejecutar comandos dentro del contenedor
docker-compose exec dental-bot ls -la .wwebjs_auth
```

## ⚠️ Solución de problemas

### El QR no aparece
1. Verifica los logs: `docker-compose logs -f`
2. Asegúrate de que el contenedor está corriendo: `docker-compose ps`

### El bot se desconecta
1. Esto es normal si pierdes conexión a internet
2. Se reconectará automáticamente (restart: unless-stopped)

### Limpiar autenticación antigua
```bash
docker-compose down -v
```
Esto borra la autenticación guardada, obligándote a escanear el QR de nuevo.

## 🔄 Actualizar el código

Si cambias el código Python/Node:

```bash
# Reconstruir la imagen
docker-compose build

# Reiniciar
docker-compose up
```

## 📦 Persistencia de datos

- **Autenticación WhatsApp**: Guardada en `./wwebjs_auth/` (local)
- **Base de datos**: Guardada en `./datos/` (local)
- **Logs**: Accesibles con `docker-compose logs`

Los datos persisten incluso si paras y reinicias el contenedor.

## 🌍 Acceso remoto

Si quieres acceder al dashboard desde otra máquina en tu red:

1. Busca la IP local de tu PC (Windows):
   ```powershell
   ipconfig
   ```
   Busca "IPv4 Address" (ej: 192.168.1.100)

2. Accede desde otro dispositivo:
   ```
   http://192.168.1.100:3000
   ```

## 📝 Notas

- El contenedor usa `restart: unless-stopped` para reiniciarse automáticamente
- Requiere ~1GB de RAM (Chromium incluido)
- Primer inicio tarda más (descarga Chromium en el contenedor)

¡Listo! El bot debería estar corriendo en Docker. 🎉
