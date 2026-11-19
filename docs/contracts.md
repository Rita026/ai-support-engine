# Contrato e implementación

## Solicitud

`POST /api/analyze`, `Content-Type: application/json`. Objeto sin campos adicionales:

- `message`: string, recortado en el servidor, entre 1 y 5000 caracteres. Límite del cuerpo HTTP: 64 KiB.
- `mode`: `traditional`, `generative` o `ml`, obligatorio.

## Respuesta exitosa (HTTP 200)

Objeto con exactamente estos campos:

| Campo | Tipo y valores |
| --- | --- |
| `category` | `ACCESS`, `BUG`, `FEATURE`, `SECURITY` |
| `priority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `response` | string no vacío, hasta 5000 caracteres |
| `requiresHumanReview` | boolean |
| `mode` | modo solicitado, asignado por el servidor |

`src/contracts.js` exporta `requestSchema`, `analysisSchema`, `resultSchema`, `mlServiceSchema`, listas de valores y el esquema JSON enviado a Gemini. `analysisSchema` es el contrato sin `mode`. Se rechazan los campos adicionales. Los tres motores devuelven exactamente este contrato.

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
| 503 | `ML_NOT_CONFIGURED` | `ML_SERVICE_URL` no es una URL HTTP válida |
| 503 | `ML_UNAVAILABLE` | El servicio ML no está en ejecución o no acepta conexiones |
| 503 | `ML_NOT_READY` | El servicio ML está activo, pero no tiene un modelo cargado |
| 502 | `ML_UNAVAILABLE` | El servicio ML respondió con otro error HTTP |
| 502 | `ML_INVALID_RESPONSE` | JSON o esquema incorrectos del servicio ML |
| 504 | `ML_TIMEOUT` | El servicio ML superó 10 segundos |
| 503 | `ENGINE_NOT_CONFIGURED` | Falta un motor al construir la app |
| 500 | `INVALID_ENGINE_RESULT` / `INTERNAL_ERROR` | Fallo interno |

Los errores no contienen detalles del proveedor, claves ni tickets. Solo se registra el código de fallos HTTP 5xx. No hay fallback generativo simulado ni reintentos automáticos que oculten errores.

## Servicio de machine learning (`ml-service/`)

Servicio FastAPI independiente, por defecto en `http://127.0.0.1:8000` (variable `ML_SERVICE_URL` del servidor Node).

- `GET /health` → `{ "status": "ok", "modelVersion": "...", "trainedAt": "..." }`, o HTTP 503 `{ "status": "unavailable" }`.
- `POST /predict` con `{ "message": "..." }`: texto recortado de 1 a 5000 caracteres, sin campos adicionales. Cuerpo máximo de 64 KiB.

```json
{
  "category": "SECURITY",
  "priority": "HIGH",
  "response": "Respuesta predefinida según la categoría.",
  "requiresHumanReview": true,
  "confidence": { "category": 0.81, "priority": 0.74 },
  "modelVersion": "20261118-6651068c"
}
```

Dos clasificadores (TF-IDF de palabras y caracteres + regresión logística) predicen la categoría y la prioridad. La prioridad se limita a las combinaciones presentes en el dataset; por ejemplo, FEATURE nunca recibe HIGH ni CRITICAL. `requiresHumanReview` es `true` para SECURITY o cuando la confianza de categoría es menor a 0.50 o la de prioridad menor a 0.55; en ese caso la respuesta también pide detalles.

Errores con la misma forma que la API Node: 400 `INVALID_REQUEST` / `INVALID_JSON`, 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 404, 405, 503 `MODEL_NOT_READY` y 500 `INTERNAL_ERROR`. El servicio no registra el contenido de los tickets.

## Reglas y protección compartida

- Tradicional: `analyzeTraditional(message)` en `src/engines/traditional.js`, función síncrona, sin red. Devuelve los cinco campos completos.
- Machine learning: `createMlAnalyzer()` en `src/engines/ml.js` llama por HTTP al servicio Python `ml-service` (`POST {ML_SERVICE_URL}/predict`), valida su respuesta con `mlServiceSchema` y descarta `confidence` y `modelVersion` antes de responder. No hay respaldo simulado: si el servicio no responde, la API devuelve un error `ML_*`.
- Prioridad por defecto: FEATURE LOW, ACCESS y BUG MEDIUM, SECURITY HIGH. Un defecto cosmético de BUG baja a LOW. Un bloqueo de trabajo explícito sube a HIGH y el impacto crítico tiene precedencia.
- Una caída general o incidente activo descrito con las señales implementadas sube a CRITICAL. Una mención incierta de un incidente de seguridad permanece HIGH.
- Orden de categorías: señales SECURITY, petición FEATURE, señales ACCESS, señales BUG. Sin señales: BUG/MEDIUM con revisión humana y petición de detalles.
- Gemini recibe un prompt de sistema separado del contenido del ticket. Se solicita JSON con esquema, se valida y se añade el modo desde el servidor.
- Tras los tres motores, `applySafetyReview` fuerza únicamente `requiresHumanReview=true` si la categoría es SECURITY o se detectan señales de seguridad en el mensaje. No sustituye categoría, prioridad ni respuesta del motor. Esta protección común debe indicarse en la comparación.
- Las señales son heurísticas conservadoras: pueden tener falsos positivos (por ejemplo, mencionar una vulnerabilidad negada) y falsos negativos en paráfrasis. No se promete detección infalible de incidentes o prompt injection.
- El resultado es una sugerencia de soporte. No se crean tickets, envían mensajes ni ejecutan acciones en sistemas externos.

## Interfaces para pruebas

```js
import { createApp } from '../src/app.js';
import { createGenerativeAnalyzer } from '../src/engines/generative.js';
import { analyzeTraditional } from '../src/engines/traditional.js';
import { createMlAnalyzer } from '../src/engines/ml.js';
```

`createApp({ traditionalAnalyzer, generativeAnalyzer, mlAnalyzer })` acepta motores inyectables. Los motores generativo y ML predeterminados usan la configuración del proceso. `index.js` conecta el motor tradicional real y exporta la app por defecto para Vercel. Para pruebas, usar `app.listen(0, '127.0.0.1')`, `fetch` de Node y cerrar el servidor al terminar.

`createGenerativeAnalyzer({ client, apiKey, model, timeoutMs })` permite simular el SDK. El cliente debe implementar `models.generateContent(params)`, devolviendo una promesa con `{ text: 'JSON...', candidates: [{ finishReason: 'STOP' }] }` o lanzando un error con `status`/`message`. Las respuestas del SDK no son el contrato HTTP final.

Ejemplos para pruebas: `status:429`, `status:403`, JSON inválido, enum desconocido, campo booleano incorrecto, texto vacío, `promptFeedback.blockReason`, `finishReason:'MAX_TOKENS'` y promesa que no resuelve con `timeoutMs` pequeño. Nunca usar estas simulaciones en las evidencias reales.

`createMlAnalyzer({ baseUrl, timeoutMs, fetchImpl })` permite simular el servicio Python con un `fetch` falso que devuelva `new Response(JSON.stringify(...))` o lance un error.
