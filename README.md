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
| Pruebas, comparación y documentación final | katherine920 | Implementada; ver evidencias y limitación visual |

El proyecto se desarrolló con asistencia de IA. Cada integrante debe revisar y poder explicar el código de su parte. El nombre del autor de un commit y la cuenta que realiza el push son datos distintos. La autoría de GitHub se vincula mediante correos asociados a los perfiles; Rita026 y katherine920 utilizan sus direcciones noreply basadas en el identificador público de su cuenta.

El trabajo se realiza en `develop`. Se conservan [las instrucciones originales de la parte 3](docs/persona-3.md) y el [prompt de trabajo](docs/prompt-persona-3.md) como documentación del reparto. Las instrucciones de la práctica están en el PDF original incluido en el repositorio.

## Pruebas automáticas

```powershell
npm test
```

La suite usa `node:test` y no necesita una API key: los errores de Gemini se prueban con clientes inyectados. Cubre reglas, prioridades, seguridad, contrato HTTP, entradas inválidas, archivos de la pantalla, protección de secretos, errores del proveedor, timeout y cálculo de métricas. Los mensajes de error impresos durante estas pruebas son casos provocados y esperados. El resultado real de la suite está en [evidence/unit-tests.txt](evidence/unit-tests.txt).

## Comparación real de los motores

Con `npm start` en otra terminal y Gemini configurado:

```powershell
npm run compare
```

El ejecutor envía los 12 tickets de [fixtures/cases.json](fixtures/cases.json) a los dos motores mediante HTTP: ocho normales, dos ambiguos y dos intentos de manipulación. Las referencias se fijaron antes de ejecutar y sus justificaciones están incluidas. El script valida el conjunto y guarda una copia y su SHA-256 antes de la primera llamada.

Cada ejecución hace **12 llamadas reales a Gemini** y 12 al motor tradicional, con cinco segundos entre casos y sin reintentos automáticos. Requiere cuota disponible; no utiliza simulaciones ni descarta fallos. No repitas la comparación innecesariamente.

Un acierto exige que **categoría y prioridad** coincidan con la referencia. Precisión = aciertos / 12 × 100. Formato y revisión humana se informan por separado. Los errores HTTP, de red o de formato cuentan como incorrectos. Una clasificación semánticamente incorrecta no hace fallar el script; sí lo hacen errores técnicos o cambios de referencia durante la ejecución.

Los resultados se guardan en una carpeta nueva `evidence/run-<fecha-UTC>/`, con JSON completo, tabla CSV y tabla Markdown. El JSON incluye respuestas, errores, tiempos, referencias y versión de código. Las ejecuciones previas se conservan. Consulta [la evidencia real](evidence/README.md), [la conclusión técnica](evidence/conclusion.md) y [la validación](evidence/validation.md).

Resultado observado: **tradicional 11/12 (91.67%) y Gemini 12/12 (100%)**, con 12/12 respuestas de formato válido en ambos. La coincidencia de revisión humana fue 12/12 y 10/12, respectivamente. Es una única ejecución con tickets sintéticos, no una garantía general de precisión.

Para un puerto distinto, inicia el servidor con `$env:PORT='3101'` y `npm start`. En la terminal del comparador usa `$env:BASE_URL='http://127.0.0.1:3101'`. `COMPARE_DELAY_MS` permite ajustar la espera entre casos (0 a 60000 ms).

## Decisiones y límites

- Tradicional: orden de señales SECURITY, FEATURE, ACCESS y BUG. FEATURE suele ser LOW; ACCESS/BUG MEDIUM; seguridad HIGH; impacto crítico CRITICAL. Un defecto cosmético baja a LOW y un bloqueo de trabajo sube a HIGH. Sin señales suficientes se usa BUG/MEDIUM con revisión humana y petición de detalles.
- Gemini interpreta el mensaje y genera una respuesta contextualizada; se solicita JSON con esquema y se valida de nuevo en el servidor. Un fallo del proveedor se presenta como error, sin reemplazo manual.
- Ambos motores comparten una protección: posibles incidentes de seguridad fuerzan revisión humana. Esa protección no cambia categoría, prioridad ni respuesta; está declarada en los resultados para una comparación transparente.
- Las reglas tienen limitaciones de vocabulario, negaciones y contexto. Gemini también puede equivocarse, variar entre ejecuciones o devolver sugerencias que deben revisarse. La revisión humana no garantiza detección infalible.
- Doce tickets sintéticos y algunas referencias ambiguas no demuestran superioridad general. La respuesta libre no se califica mediante igualdad de texto. El prototipo propone respuestas y no crea ni deriva tickets realmente.
- Los archivos de la pantalla se validaron por HTTP, pero las capturas y la revisión visual de escritorio/móvil quedaron bloqueadas por falta de conexión con las herramientas de navegador. No se incluyen capturas fabricadas.

## Preparación para Vercel

El proyecto exporta Express desde `index.js`; Vercel sirve la pantalla desde `public/`. `vercel.json` configura Node/Express, cabeceras y una duración máxima de 60 segundos, superior al timeout de Gemini de 30 segundos.

Cuando decidas publicar, importa el repositorio y selecciona la rama `develop`, framework Express y Node.js 24. No hace falta un comando de build personalizado. Configura `GEMINI_API_KEY` y `GEMINI_MODEL` como variables del servidor y despliega. Comprueba `/` y `POST /api/analyze`. Nunca uses un prefijo que exponga la clave al cliente. En esta entrega no se realiza el despliegue.

El servidor no guarda tickets ni resultados. Las evidencias se generan localmente con el ejecutor comparativo. No se necesitan bases de datos ni escrituras persistentes en Vercel. Un endpoint publicado usa tu cuota de Gemini; para esta práctica se mantiene el trabajo local y no se realiza despliegue.

Referencias: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [salidas estructuradas de Gemini](https://aistudio.google.com/docs/structured-output).
