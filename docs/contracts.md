# Contrato e implementación

## Solicitud

`POST /api/analyze`, `Content-Type: application/json`. Objeto sin campos adicionales:

- `message`: string, recortado en el servidor, entre 1 y 5000 caracteres. Límite del cuerpo HTTP: 64 KiB.
- `mode`: `traditional` o `generative`, obligatorio.

## Respuesta exitosa (HTTP 200)

Objeto con exactamente estos campos:

| Campo | Tipo y valores |
| --- | --- |
| `category` | `ACCESS`, `BUG`, `FEATURE`, `SECURITY` |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `response` | string no vacío, hasta 5000 caracteres |
| `requiresHumanReview` | boolean |
| `mode` | modo solicitado, asignado por el servidor |

`src/contracts.js` exporta `requestSchema`, `analysisSchema`, `resultSchema`, listas de valores y el esquema JSON enviado a Gemini. `analysisSchema` es el contrato sin `mode`. Se rechazan los campos adicionales.

## Errores

Forma común: `{ "error": { "code": "INVALID_REQUEST", "message": "Mensaje legible." } }`. No es una clasificación exitosa y debe contarse como fallo en la comparación.

| HTTP | Código | Situación |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Campo ausente, modo incorrecto, longitud o tipo inválidos, campos adicionales |
| 400 | `INVALID_JSON` | JSON mal formado |
| 413 | `PAYLOAD_TOO_LARGE` | Cuerpo mayor a 64 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Petición sin application/json |
| 405 | `METHOD_NOT_ALLOWED` | Otro método sobre /api/analyze |
| 404 | `NOT_FOUND` | Recurso inexistente |
| 429 | `GEMINI_QUOTA` | Límite o cuota del proveedor |
| 503 | `GEMINI_NOT_CONFIGURED` | Clave no configurada |
| 503 | `GEMINI_AUTH` | Clave inválida, vencida o sin permisos |
| 503 | `GEMINI_MODEL` | Modelo no disponible |
| 502 | `GEMINI_BLOCKED` | Respuesta bloqueada por el proveedor |
| 502 | `GEMINI_INVALID_RESPONSE` | JSON, esquema o finalización incorrectos |
| 502 | `GEMINI_UNAVAILABLE` | Otro fallo del proveedor |
| 504 | `GEMINI_TIMEOUT` | Se superaron 30 segundos |
| 503 | `ENGINE_NOT_CONFIGURED` | Falta un motor al construir la app |
| 500 | `INVALID_ENGINE_RESULT` / `INTERNAL_ERROR` | Fallo interno |

Los errores no contienen detalles del proveedor, claves ni tickets. Solo se registra el código de fallos HTTP 5xx. No hay fallback generativo simulado ni reintentos automáticos que oculten errores.

## Reglas y protección compartida

- Tradicional: `analyzeTraditional(message)` en `src/engines/traditional.js`, función síncrona, sin red. Devuelve los cinco campos completos.
- Prioridad por defecto: FEATURE LOW, ACCESS y BUG MEDIUM, SECURITY HIGH. Un defecto cosmético de BUG baja a LOW. Un bloqueo de trabajo explícito sube a HIGH y el impacto crítico tiene precedencia.
- Una caída general o incidente activo descrito con las señales implementadas sube a CRITICAL. Una mención incierta de un incidente de seguridad permanece HIGH.
- Orden de categorías: señales SECURITY, petición FEATURE, señales ACCESS, señales BUG. Sin señales: BUG/MEDIUM con revisión humana y petición de detalles.
- Gemini recibe un prompt de sistema separado del contenido del ticket. Se solicita JSON con esquema, se valida y se añade el modo desde el servidor.
- Tras ambos motores, `applySafetyReview` fuerza únicamente `requiresHumanReview=true` si la categoría es SECURITY o se detectan señales de seguridad en el mensaje. No sustituye categoría, prioridad ni respuesta de Gemini. Esta protección común debe indicarse en la comparación.
- Las señales son heurísticas conservadoras: pueden tener falsos positivos (por ejemplo, mencionar una vulnerabilidad negada) y falsos negativos en paráfrasis. No se promete detección infalible de incidentes o prompt injection.
- El resultado es una sugerencia de soporte. No se crean tickets, envían mensajes ni ejecutan acciones en sistemas externos.

## Interfaces para pruebas

```js
import { createApp } from '../src/app.js';
import { createGenerativeAnalyzer } from '../src/engines/generative.js';
import { analyzeTraditional } from '../src/engines/traditional.js';
```

`createApp({ traditionalAnalyzer, generativeAnalyzer })` acepta motores inyectables. El motor generativo predeterminado usa la configuración del proceso. `index.js` conecta el motor tradicional real y exporta la app por defecto para Vercel. Para pruebas, usar `app.listen(0, '127.0.0.1')`, `fetch` de Node y cerrar el servidor al terminar.

`createGenerativeAnalyzer({ client, apiKey, model, timeoutMs })` permite simular el SDK. El cliente debe implementar `models.generateContent(params)`, devolviendo una promesa con `{ text: 'JSON...', candidates: [{ finishReason: 'STOP' }] }` o lanzando un error con `status`/`message`. Las respuestas del SDK no son el contrato HTTP final.

Ejemplos para pruebas: `status:429`, `status:403`, JSON inválido, enum desconocido, campo booleano incorrecto, texto vacío, `promptFeedback.blockReason`, `finishReason:'MAX_TOKENS'` y promesa que no resuelve con `timeoutMs` pequeño. Nunca usar estas simulaciones en las evidencias reales.
