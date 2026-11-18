# AI Support Engine

Prototipo académico que clasifica solicitudes de soporte con tres motores: reglas tradicionales, Gemini y un modelo de machine learning (scikit-learn) servido por un servicio Python aparte. Incluye una pantalla en español y una API con el mismo contrato para los tres motores.

## Integrantes

| Nombre | Matrícula | GitHub | Responsabilidad |
| --- | --- | --- | --- |
| Ariel Abimael Chacon Herrera | 3523110621 | [SoyAri](https://github.com/SoyAri) | API, Gemini, validaciones e integración; entrenamiento del modelo ML, servicio FastAPI e integración del modo `ml` |
| Rita Gonzalez Sanches | 3523110444 | [Rita026](https://github.com/Rita026) | Motor tradicional e interfaz; dataset de entrenamiento y opción ML en la interfaz |
| Gomez Merino Katherine Daniela | 3523110600 | [katherine920](https://github.com/katherine920) | Pruebas, comparación y documentación; pruebas del servicio ML, comparación de tres motores y evidencias |

El trabajo se realiza en la rama `develop`. Las instrucciones de la práctica están en el PDF original incluido en el repositorio.

## Ejecutar localmente

Requiere Node.js 24 y npm. El motor de machine learning requiere además Python 3.9 o superior (ver la sección siguiente).

```powershell
npm ci
Copy-Item .env.example .env
```

Si ya tienes `.env`, conserva ese archivo. Edita únicamente tu copia local:

```dotenv
GEMINI_API_KEY=tu_clave_local
GEMINI_MODEL=gemini-3.1-flash-lite
PORT=3000
ML_SERVICE_URL=http://127.0.0.1:8000
```

```powershell
npm start
```

Abre <http://127.0.0.1:3000>. `npm run dev` reinicia el servidor al modificar código. El motor tradicional funciona sin clave; Gemini requiere una clave válida y cuota disponible; el modo ML requiere el servicio Python en ejecución. Reinicia el servidor después de cambiar `.env`.

La clave no se envía al navegador, no se sirve como archivo estático y está excluida de Git. No compartas `.env`, contraseñas, códigos de recuperación ni datos sensibles en los tickets.

## Servicio de machine learning

El tercer motor vive en [ml-service/](ml-service/): un servicio FastAPI que carga dos clasificadores (categoría y prioridad) entrenados con TF-IDF de palabras y caracteres y regresión logística. Node lo llama por HTTP; si no está en ejecución, el modo `ml` responde `ML_UNAVAILABLE` y los otros motores siguen funcionando.

En otra terminal (Windows / PowerShell):

```powershell
cd ml-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m ml.train
.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

En macOS / Linux:

```bash
cd ml-service
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m ml.train
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`ml.train` tarda alrededor de un minuto: elige hiperparámetros, evalúa y guarda `models/model.joblib` (excluido de Git). Si se omite, el servicio entrena el modelo al arrancar. Comprueba <http://127.0.0.1:8000/health>. La documentación interactiva del servicio está en `/docs`.

- **Dataset**: [ml-service/data/tickets.csv](ml-service/data/tickets.csv), 2 000 tickets sintéticos (500 por categoría). Lo genera de forma determinista `python scripts/generate_dataset.py`. Formato, guía de etiquetado y limitaciones en [ml-service/data/README.md](ml-service/data/README.md).
- **Evaluación**: [training_report.md](ml-service/reports/training_report.md). Con escenarios que el modelo no vio, el acierto conjunto es ~80 % (validación cruzada por escenario), frente a ~76 % del pipeline de ejemplo. En 30 casos redactados aparte obtiene 86.7 % frente a 73.3 %.
- **Respuesta**: predefinida por categoría. `requiresHumanReview` es `true` para SECURITY o con confianza baja (categoría < 0.50 o prioridad < 0.55, umbrales calibrados con predicciones fuera de muestra).
- **Pruebas**: `.venv/bin/python -m pytest` (o `.venv\Scripts\python -m pytest`) dentro de `ml-service/`. Son 40 pruebas de dataset, modelo y API.

## API

`POST /api/analyze` con `Content-Type: application/json`; `mode` acepta `traditional`, `generative` o `ml`:

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

El ejemplo ilustra el contrato; las respuestas tradicional y ML están predefinidas en el código y Gemini redacta su respuesta mediante una llamada real. El servicio ML devuelve además su confianza y versión, pero Node las descarta para mantener el mismo contrato. Ver [contrato y errores](docs/contracts.md).

## Pruebas automáticas

```powershell
npm test
```

La suite usa `node:test` y no necesita una API key ni el servicio Python: los errores de Gemini y del servicio ML se prueban con clientes inyectados. Cubre reglas, prioridades, seguridad, contrato HTTP de los tres modos, entradas inválidas, archivos de la pantalla, protección de secretos, errores del proveedor y del servicio ML, timeout y cálculo de métricas. Los mensajes de error impresos durante estas pruebas son casos provocados y esperados. El resultado real está en [evidence/unit-tests.txt](evidence/unit-tests.txt) (72 pruebas) y el de pytest en [evidence/ml-tests.txt](evidence/ml-tests.txt) (40 pruebas).

## Comparación real de los motores

Con `npm start` y el servicio ML en otras terminales, y Gemini configurado:

```powershell
npm run compare
```

El ejecutor envía los 12 tickets de [fixtures/cases.json](fixtures/cases.json) a los tres motores mediante HTTP: ocho normales, dos ambiguos y dos intentos de manipulación. Las referencias se fijaron antes de ejecutar y sus justificaciones están incluidas. El script valida el conjunto y guarda una copia y su SHA-256 antes de la primera llamada.

Antes de empezar comprueba que el servicio ML responda. Cada ejecución hace **12 llamadas reales a Gemini**, 12 al motor tradicional y 12 al servicio ML, con cinco segundos entre casos y sin reintentos automáticos. Requiere cuota disponible; no utiliza simulaciones ni descarta fallos. No repitas la comparación innecesariamente.

Un acierto exige que **categoría y prioridad** coincidan con la referencia. Precisión = aciertos / 12 × 100 por motor. Formato y revisión humana se informan por separado. Los errores HTTP, de red o de formato cuentan como incorrectos. Una clasificación semánticamente incorrecta no hace fallar el script; sí lo hacen errores técnicos o cambios de referencia durante la ejecución.

Los resultados se guardan en una carpeta nueva `evidence/run-<fecha-UTC>/`, con JSON completo, tabla CSV y tabla Markdown. El JSON incluye respuestas, errores, tiempos, referencias y versión de código. Las ejecuciones previas se conservan. Consulta [la evidencia real](evidence/README.md), [la conclusión técnica](evidence/conclusion.md) y [la validación](evidence/validation.md).

Resultado observado (2026-11-18): **tradicional 11/12 (91.67%), Gemini 12/12 (100%) y machine learning 10/12 (83.33%)**, con 36/36 respuestas de formato válido. La coincidencia de revisión humana fue 12/12, 11/12 y 10/12, respectivamente. Es una única ejecución con tickets sintéticos, no una garantía general de precisión. La ejecución anterior con dos motores también se conserva.

Para un puerto distinto, inicia el servidor con `$env:PORT='3101'` y `npm start`. En la terminal del comparador usa `$env:BASE_URL='http://127.0.0.1:3101'`. Si el servicio ML usa otro puerto, ajusta `ML_SERVICE_URL` en `.env`. `COMPARE_DELAY_MS` permite ajustar la espera entre casos (0 a 60000 ms).

## Decisiones y límites

- Tradicional: orden de señales SECURITY, FEATURE, ACCESS y BUG. FEATURE suele ser LOW; ACCESS/BUG MEDIUM; seguridad HIGH; impacto crítico CRITICAL. Un defecto cosmético baja a LOW y un bloqueo de trabajo sube a HIGH. Sin señales suficientes se usa BUG/MEDIUM con revisión humana y petición de detalles.
- Gemini interpreta el mensaje y genera una respuesta contextualizada; se solicita JSON con esquema y se valida de nuevo en el servidor. Un fallo del proveedor se presenta como error, sin reemplazo manual.
- Los tres motores comparten una protección: posibles incidentes de seguridad fuerzan revisión humana. Esa protección no cambia categoría, prioridad ni respuesta; está declarada en los resultados para una comparación transparente.
- Machine learning: el modelo aprende del dataset sintético; generaliza a redacciones nuevas de los escenarios conocidos, pero puede fallar con vocabulario que no vio. Es determinista para una versión del modelo, responde en milisegundos y no envía datos a terceros. La prioridad se limita a las combinaciones permitidas por la política (FEATURE nunca es HIGH ni CRITICAL).
- Las reglas tienen limitaciones de vocabulario, negaciones y contexto. Gemini también puede equivocarse, variar entre ejecuciones o devolver sugerencias que deben revisarse. El modelo ML puede confundir categorías cercanas (por ejemplo, un problema de carga «al entrar» con uno de acceso). La revisión humana no garantiza detección infalible.
- Doce tickets sintéticos y algunas referencias ambiguas no demuestran superioridad general. La respuesta libre no se califica mediante igualdad de texto. El prototipo propone respuestas y no crea ni deriva tickets realmente.
- Los archivos de la pantalla se validaron por HTTP y la interfaz se recorrió en Chrome sin interfaz gráfica, controlado por un script, en escritorio y móvil. Las capturas reales están en [evidence/ui/](evidence/ui/).

## Preparación para Vercel

El proyecto exporta Express desde `index.js`; Vercel sirve la pantalla desde `public/`. El servicio Python de machine learning no se ejecuta en Vercel: el modo `ml` solo funciona si `ML_SERVICE_URL` apunta a una instancia publicada del servicio; de lo contrario responde `ML_UNAVAILABLE`. `vercel.json` configura Node/Express, cabeceras y una duración máxima de 60 segundos, superior al timeout de Gemini de 30 segundos.

Cuando decidas publicar, importa el repositorio y selecciona la rama `develop`, framework Express y Node.js 24. No hace falta un comando de build personalizado. Configura `GEMINI_API_KEY` y `GEMINI_MODEL` como variables del servidor y despliega. Comprueba `/` y `POST /api/analyze`. Nunca uses un prefijo que exponga la clave al cliente. En esta entrega no se realiza el despliegue.

El servidor no guarda tickets ni resultados. Las evidencias se generan localmente con el ejecutor comparativo. No se necesitan bases de datos ni escrituras persistentes en Vercel. Un endpoint publicado usa tu cuota de Gemini; para esta práctica se mantiene el trabajo local y no se realiza despliegue.

Referencias: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [salidas estructuradas de Gemini](https://aistudio.google.com/docs/structured-output).
