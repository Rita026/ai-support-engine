# AI Support Engine

Prototipo académico que clasifica solicitudes de soporte con dos motores: reglas tradicionales y Gemini. Incluye una pantalla en español y una API con el mismo contrato para ambos motores.

## Ejecutar localmente

Requiere Node.js 24 y npm.

```powershell
npm ci
Copy-Item .env.example .env
```

Si ya tienes `.env`, conserva ese archivo. Edita únicamente tu copia local:

```dotenv
GEMINI_API_KEY=tu_clave_local
GEMINI_MODEL=gemini-3.1-flash-lite
PORT=3000
```

```powershell
npm start
```

Abre <http://127.0.0.1:3000>. `npm run dev` reinicia el servidor al modificar código. El motor tradicional funciona sin clave; Gemini requiere una clave válida y cuota disponible. Reinicia el servidor después de cambiar `.env`.

La clave no se envía al navegador, no se sirve como archivo estático y está excluida de Git. No compartas `.env`, contraseñas, códigos de recuperación ni datos sensibles en los tickets.

## API

`POST /api/analyze` con `Content-Type: application/json`:

```json
{ "message": "No puedo iniciar sesión", "mode": "traditional" }
```

```json
{
  "category": "ACCESS",
  "priority": "MEDIUM",
  "response": "Respuesta de soporte en español.",
  "requiresHumanReview": false,
  "mode": "traditional"
}
```

El ejemplo ilustra el contrato; la respuesta tradicional completa está en el código y Gemini redacta su respuesta mediante una llamada real. Ver [contrato y errores](docs/contracts.md).

## Reparto y estado

| Parte | Responsable | Estado |
| --- | --- | --- |
| API, Gemini, validación e integración | Ariel Chacon | Implementada |
| Motor tradicional y pantalla | Rita026 | Implementada |
| Pruebas completas, comparación y documentación final | Integrante 3 | Pendiente |

Las partes 1 y 2 se desarrollaron con asistencia de IA. Cada integrante debe revisar y poder explicar el código de su parte. El nombre del autor de un commit y la cuenta que realiza el push son datos distintos.

El trabajo se realiza en `develop`. El integrante 3 recibe [sus instrucciones](docs/persona-3.md) y un [prompt listo para su IA](docs/prompt-persona-3.md). Las instrucciones de la práctica están en el PDF original incluido en el repositorio.

**Pendiente para completar la práctica:** 12 referencias y casos comparativos, pruebas con `node:test`, comandos `npm test` y `npm run compare`, resultados reales de ambos motores, capturas y conclusión de hasta 150 palabras. Estos entregables no se simulan ni se presentan como ejecutados.

## Preparación para Vercel

El proyecto exporta Express desde `index.js`; Vercel sirve la pantalla desde `public/`. `vercel.json` configura Node/Express, cabeceras y una duración máxima de 60 segundos, superior al timeout de Gemini de 30 segundos.

Cuando decidas publicar, importa el repositorio y selecciona la rama `develop`, framework Express y Node.js 24. No hace falta un comando de build personalizado. Configura `GEMINI_API_KEY` y `GEMINI_MODEL` como variables del servidor y despliega. Comprueba `/` y `POST /api/analyze`. Nunca uses un prefijo que exponga la clave al cliente. En esta entrega no se realiza el despliegue.

El servidor no guarda tickets ni resultados. Las evidencias se generan localmente con el futuro ejecutor comparativo del integrante 3. No se necesitan bases de datos ni escrituras persistentes en Vercel.

Referencias: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [salidas estructuradas de Gemini](https://aistudio.google.com/docs/structured-output).
