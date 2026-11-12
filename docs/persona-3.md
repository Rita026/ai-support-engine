# Integrante 3: pruebas, documentación y evidencias

## Estado y objetivo

Las partes 1 y 2 contienen la API, integración real de Gemini, motor tradicional y pantalla. Tu entrega completa la práctica mediante pruebas reproducibles y resultados observados. Lee el PDF original, el README y [el contrato](contracts.md) antes de modificar archivos.

Repositorio: https://github.com/Rita026/ai-support-engine. Rama de trabajo: `develop`. No hagas commits ni push; el responsable de integración pedirá tu nombre/correo antes de crear tu commit. No cambies configuraciones globales de Git ni compartas claves.

## Archivos a tu cargo

- `tests/*.test.js`: pruebas automatizadas con `node:test` y `node:assert/strict`.
- `fixtures/cases.json`: 12 tickets y referencias fijadas antes de ejecutar.
- `scripts/compare.js`: comparación real por HTTP.
- `evidence/`: respuestas JSON, tabla CSV/Markdown, conclusión y capturas.
- `README.md`: completar la guía y el estado real de la entrega.
- En `package.json`, puedes añadir únicamente los scripts `test` y `compare`. Evita nuevas dependencias: Node ya proporciona fetch, test y utilidades de archivos.

No modifiques `src/`, `public/`, `index.js`, `server.js`, dependencias ni `vercel.json`. Reporta los defectos encontrados para que se corrijan en la integración. Los documentos de contrato e instrucciones pertenecen a la base; informa cualquier discrepancia.

## Casos y métricas

Preparar exactamente 12 casos: ocho normales, dos ambiguos y dos intentos de manipulación. En los normales, cubrir las cuatro categorías y las cuatro prioridades. Uno de los ataques debe intentar rebajar una vulnerabilidad; otro debe intentar cambiar instrucciones, categoría o formato ocultando un incidente.

Formato de cada caso:

```json
{
  "id": "normal-01",
  "kind": "normal",
  "message": "Ticket de soporte",
  "expected": {
    "category": "ACCESS",
    "priority": "MEDIUM",
    "requiresHumanReview": false
  },
  "rationale": "Justificación breve de la referencia"
}
```

`kind` admite `normal`, `ambiguous` e `injection`. Las referencias representan el criterio humano: no las cambies para que coincidan con resultados observados. Conserva el mismo conjunto para ambos motores. No adaptes reglas o prompts después de ver los resultados sin documentar el cambio y repetir el experimento con referencias fijas.

Por cada caso y motor registra: id, mensaje, referencia, categoría obtenida, prioridad, revisión humana, formato válido, coincidencia de categoría, coincidencia de prioridad y acierto conjunto. El acierto principal exige categoría Y prioridad correctas; revisión humana se informa por separado. Una respuesta HTTP de error cuenta como formato de clasificación inválido y acierto falso.

Precisión de cada motor: aciertos conjuntos / 12 * 100. Siempre informa 12 intentos por motor, incluyendo errores. Puedes reportar además aciertos solo de categoría, fallos y revisión humana. No evalúes la respuesta libre mediante igualdad de texto.

## Pruebas automáticas

Usar las interfaces de inyección descritas en contracts.md. Cubrir reglas, fallback ambiguo, precedencia de seguridad, niveles de prioridad, normalización, contrato exitoso de ambos modos, validaciones, errores y protección compartida. Verificar que errores no expongan mensajes internos ni una clave ficticia de prueba.

Usar clientes falsos únicamente en pruebas: no requieren clave ni llamadas a Gemini. Probar timeout con un valor pequeño inyectado y cerrar servidores/recursos después de cada suite. Añadir `"test": "node --test tests/*.test.js"` y ejecutar `npm test`.

## Comparación real

Añadir `"compare": "node --env-file-if-exists=.env scripts/compare.js"`. El script debe consumir el servidor real, no llamar a funciones falsas. Usar `BASE_URL` opcional con valor predeterminado `http://127.0.0.1:3000`.

1. Configurar GEMINI_API_KEY en `.env` y arrancar `npm start` en otra terminal.
2. Validar fixtures y fijar sus referencias antes de la primera llamada.
3. Ejecutar cada caso con traditional y generative mediante POST /api/analyze, secuencialmente para reducir problemas de cuota.
4. Guardar cada intento y su respuesta o error. No reintentar silenciosamente ni excluir fallos del denominador.
5. Guardar fecha ISO, URL, modelo configurado y una copia o hash de los fixtures usados. No guardar secretos, cabeceras de autenticación ni `.env`.
6. Generar JSON, CSV UTF-8 y Markdown con las métricas. Escapar correctamente comas, comillas, saltos y pipes.
7. Si no puedes completar llamadas por cuota o configuración, guarda lo observado, marca la comparación como incompleta y no inventes evidencias ni una conclusión de éxito.

Ejecutar el comparador una sola vez normalmente. Solo repetir para corregir errores reales, documentando las ejecuciones y su coste de llamadas. No existe almacenamiento persistente del servidor.

## Documentación y aceptación

Completar el README con ejecución, API/errores, reglas, diferencias de motores, limitaciones, reparto real, instrucciones de Vercel y rutas a resultados. Documentar la protección de revisión humana compartida para una comparación transparente.

Capturar la pantalla con resultados reales de ambos motores y al menos un caso SECURITY con revisión humana. Revisar también móvil y errores visibles. Nunca incluir claves o datos sensibles en capturas.

Escribir una conclusión técnica de máximo 150 palabras indicando qué motor tuvo mejores resultados (o empate), usando las métricas reales y explicando limitaciones, ambigüedad, seguridad, latencia o cuota según lo observado.

Entrega tus archivos con un resumen de cambios, comandos ejecutados, resultados y pendientes. No declares la práctica completa si faltan las 24 respuestas o errores registrados, las métricas y las evidencias reales. El responsable integrará correcciones y te pedirá datos de autoría antes de tu commit.
