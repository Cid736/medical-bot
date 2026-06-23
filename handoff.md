# Handoff — dental-bot

Fecha: 2026-05-31

Resumen breve
--------------
El usuario reportó que, al pedir cita, el bot sólo mostraba la opción de "Limpieza dental" y no permitía elegir otros servicios mediante la opción numérica (ej. `1` o el emoji `1️⃣`). Se aplicaron correcciones para que:

- El menú de servicios muestre siempre las 6 opciones numeradas cuando se pregunta por el servicio.
- La normalización del texto convierta las variantes de "teclas" numéricas (ej. `1️⃣`) a dígitos, de modo que `1` y `1️⃣` sean aceptadas.

Cambios realizados
------------------

- `ai.js` (modificado)
  - `normalizar(text)`: ahora maneja varias representaciones de keycap numbers (p. ej. `1️⃣`, U+20E3 variantes) y las convierte a dígitos; además devuelve cadena vacía si `text` es falsy.
  - `handleMenu()` / `ask_service`: el texto de respuesta pasa a listar siempre las 6 opciones numeradas cuando el servicio no se detecta automáticamente.

- `test_ai.js` (nuevo)
  - Script de prueba mínimo que invoca `getReplyWithPhone()` con las entradas `"1"` y `"1️⃣"` para validar la corrección.

Pruebas realizadas
------------------

1. Test local con Node

Ejecuté:

```bash
node test_ai.js
```

Salida esperada (ejemplo obtenido):

```
INPUT: "1" => {"text":"Limpieza dental — 60€. 👍\n¿A qué nombre apunto la cita?","lead":null}
INPUT: "1️⃣" => {"text":"Limpieza dental — 60€. 👍\n¿A qué nombre apunto la cita?","lead":null}
```

2. Prueba en Telegram

- Reiniciar el bot (si está corriendo) y probar desde el chat privado:

```bash
npm start
# o alternativamente
node index.js
```

- Asegúrate de tener en el fichero `.env` (en la raíz) las variables necesarias:

```
TELEGRAM_TOKEN=xxxx
TELEGRAM_CHAT_ID=yyyy   # opcional, para notificaciones
TELEGRAM_ADMIN_IDS=11111,22222   # opcional
```

- Flujo de prueba sugerido en Telegram:
  1. Enviar `hola` para que aparezca el menú principal.
  2. Enviar `1` o pulsar el emoji `1️⃣` para seleccionar "Limpieza".
  3. Verificar que el bot responda: "Limpieza dental — 60€. 👍\n¿A qué nombre apunto la cita?"

Archivos afectados
------------------

- [ai.js](ai.js): lógica de conversación y normalización.
- [index.js](index.js): manejador de Telegram y orquestador (sin cambios en esta tarea).
- [test_ai.js](test_ai.js): script de pruebas agregado.
- [handoff.md](handoff.md): este archivo.

Notas técnicas / Consideraciones
--------------------------------

- La normalización cubre las formas más comunes de keycap numbers (ej. `1️⃣` y variantes con U+20E3). Si se detectan más variantes en Telegram u otras plataformas, ampliar la lista de reemplazos.
- El `detectServicio()` ya aceptaba números (1..6) y palabras clave; la falta de reconocimiento vino de que el menú no mostraba las opciones numeradas en el paso `ask_service` y además los usuarios enviaban el emoji de tecla en lugar del dígito. Ambas causas fueron solucionadas.
- Mantener los tests simples y reproducibles; se puede ampliar con un test runner (mocha/jest) si se quiere.

Pasos siguientes / To‑do
-----------------------

1. Pide al usuario que pruebe en Telegram y confirme si la selección con `1` y `1️⃣` funciona. (Tarea marcada como "in-progress" en la lista de tareas).
2. Si todo está OK, marcar el lead/pipeline de producción según el flujo del proyecto.
3. (Opcional) Añadir unit tests automáticos y CI para cobertura de parsing/normalización.

Contacto
--------

Si necesitas que yo reinicie el bot desde aquí, dímelo y lo arranco. También puedo:

- revertir cambios si prefieres otra aproximación;
- ampliar la normalización para más emojis o formatos internacionales.

— Copilot
