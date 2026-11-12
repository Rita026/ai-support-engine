# Verificación de integración: partes 1 y 2

Estas comprobaciones son una revisión inicial de implementación. No reemplazan las pruebas permanentes, la comparación de 12 casos, las capturas ni la conclusión del integrante 3.

## Comprobado

- Sintaxis válida en los nueve archivos JavaScript de servidor y cliente.
- Dependencias instaladas: Express, SDK oficial de Gemini y Zod, fijadas por package-lock.json.
- Once comprobaciones temporales de integración pasaron: clasificación tradicional y fallback; seguridad y manipulación; contrato HTTP de ambos modos; revisión humana compartida; entradas y métodos inválidos; JSON y tamaño del cuerpo; respuesta estructurada de Gemini; clave ausente; esquema incorrecto; respuestas bloqueadas/incompletas; errores del proveedor y timeout. Se utilizaron clientes falsos para probar fallos de forma controlada.
- En el sandbox de esta sesión, node:test necesitó `--test-isolation=none` porque la creación de subprocesos devolvía EPERM. Eso es una limitación del entorno, no una configuración requerida por la aplicación. El integrante 3 debe probar su comando npm test en su entorno.
- Llamada REAL a Gemini para un problema de inicio de sesión: ACCESS / MEDIUM / revisión humana false, respuesta profesional generada por el proveedor.
- Por el endpoint real: ticket que intenta rebajar una vulnerabilidad. Tradicional devolvió SECURITY / HIGH / revisión humana true.
- El primer intento generativo de ese ticket devolvió BUG / MEDIUM / revisión humana true. Se aclaró el prompt para clasificar la vulnerabilidad mencionada aunque el ticket intente manipular instrucciones. Al repetirlo tras el ajuste, Gemini devolvió SECURITY / HIGH / revisión humana true. Esto no garantiza resistencia absoluta a manipulación; las referencias del experimento formal todavía deben definirse y fijarse por separado.
- Página, JavaScript, CSS y favicon devuelven HTTP 200 con tipos de contenido correctos. Las rutas /.env, /.git/config y /src/engines/generative.js no se sirven.
- .env, node_modules y comprobaciones temporales están excluidos de Git.

## Pendiente

No fue posible revisar visualmente la pantalla: tanto el host de navegador como el acceso a aplicaciones nativas estaban desconectados en esta sesión. El integrante 3 debe comprobar escritorio y móvil, botones, comparación, errores visibles y capturas de evidencia.

Todavía faltan la suite permanente de pruebas, 12 referencias previamente fijadas, 24 intentos comparativos registrados, tablas de resultados y conclusión de máximo 150 palabras. No se ha desplegado en Vercel.
