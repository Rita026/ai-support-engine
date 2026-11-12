# Validación de la entrega

## Pruebas automáticas

`npm test`: 52 pruebas aprobadas, 0 fallos. El registro íntegro está en [unit-tests.txt](unit-tests.txt). La suite no llama a Gemini real; usa clientes falsos únicamente para pruebas deterministas de esquema, bloqueos, errores, cuota y timeout.

Se detectó y corrigió el reconocimiento de «cuenta está bloqueada». También se integró la corrección local de URLs de los recursos estáticos: `/app.js` y `/styles.css`. La prueba de pantalla comprueba los enlaces del HTML, respuestas HTTP, tipos de contenido y cabeceras.

## Comparación real

La evidencia final es la enlazada en [README.md](README.md). Contiene 24 intentos: 12 por motor, sin reintentos y con referencias previamente fijadas. El script conserva respuestas y errores; no se excluyen fallos del denominador.

La primera ejecución contra el puerto 3000 se interrumpió porque ese puerto estaba ocupado por otra instancia. Se conservan sus respuestas parciales y el motivo en su carpeta. La ejecución completa utiliza una instancia controlada en el puerto 3101, iniciada después de las correcciones. No se cambiaron los tickets, referencias, reglas ni prompt después de observar esa comparación.

## Interfaz y capturas

Verificado automáticamente: HTML, CSS, JavaScript y favicon accesibles, rutas privadas inaccesibles, respuestas con cabeceras y tipos correctos. El cliente inserta resultados como texto y no contiene la clave de Gemini.

No se pudo ejecutar la comprobación visual de escritorio/móvil ni capturar el navegador: el host del navegador y la conexión nativa a aplicaciones estaban indisponibles. Esta limitación se declara expresamente. Los archivos JSON y las tablas son evidencia real de ejecución de la API; no se presentan como capturas de la interfaz.

Para completar la revisión visual manual: iniciar `npm start`, abrir la pantalla, probar los cuatro ejemplos, comparar ambos motores, desplegar el JSON y verificar un caso SECURITY con revisión humana. Revisar también un mensaje vacío, un error de proveedor y un ancho de móvil. Guardar capturas únicamente de resultados reales y sin secretos.

## Credenciales y despliegue

La clave permanece en `.env`, excluido de Git y fuera de los recursos estáticos. No se modifican las identidades globales de Git ni la sesión autenticada. El despliegue en Vercel se deja preparado pero no se realiza.
