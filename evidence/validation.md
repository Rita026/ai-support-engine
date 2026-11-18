# Validación de la entrega

## Pruebas automáticas

- `npm test`: 72 pruebas aprobadas, 0 fallos. Registro en [unit-tests.txt](unit-tests.txt). La suite no llama a Gemini ni al servicio ML reales: usa clientes y `fetch` falsos solo para probar de forma determinista el esquema, los bloqueos, los errores, la cuota, el servicio apagado y los timeouts.
- `pytest` en `ml-service/`: 40 pruebas aprobadas, 0 fallos. Registro en [ml-tests.txt](ml-tests.txt). Cubren:
  - el formato, el balance y la política del dataset;
  - que no haya fuga hacia los fixtures;
  - que el CSV coincida con el generador determinista;
  - la generalización del modelo a escenarios no vistos y la comparación con el baseline del ejemplo;
  - la restricción de prioridades por categoría;
  - el rechazo de modelos incompatibles;
  - el contrato HTTP del servicio FastAPI.

Se detectó y corrigió el reconocimiento de «cuenta está bloqueada». También se integró la corrección local de las URLs de los recursos estáticos: `/app.js` y `/styles.css`. La prueba de pantalla comprueba los enlaces del HTML, las respuestas HTTP, los tipos de contenido y las cabeceras.

## Motor de machine learning

El dataset, el entrenamiento y sus métricas están documentados en [ml-service/data/README.md](../ml-service/data/README.md) y [training_report.md](../ml-service/reports/training_report.md). La evaluación honesta usa particiones por escenario (`template_id`), porque una partición aleatoria mezcla redacciones del mismo escenario y da cifras optimistas (98.75 % frente a ~80 %).

La evaluación directa del modelo con los 12 fixtures ([fixtures_eval.md](../ml-service/reports/fixtures_eval.md)) se consultó durante el desarrollo. Los ajustes posteriores del dataset fueron genéricos, se validaron con 30 casos de desarrollo redactados aparte y no se escribieron a partir de los fixtures. Esto se declara para que la cifra de 10/12 se interprete con esa cautela.

## Comparación real

La evidencia final está enlazada en [README.md](README.md). Contiene 36 intentos: 12 por motor, sin reintentos y con referencias fijadas previamente. El script comprueba primero que el servicio ML responda, para no gastar llamadas a Gemini. Conserva respuestas y errores, y no excluye fallos del denominador. Antes de ejecutar se hizo una única llamada manual a Gemini para validar la clave.

La comparación de la entrega anterior, con dos motores, se conserva sin cambios. Su primera ejecución contra el puerto 3000 se interrumpió porque el puerto pertenecía a otra instancia; ese intento también se conserva.

## Interfaz y capturas

Verificado automáticamente:
- HTML, CSS, JavaScript y favicon accesibles;
- rutas privadas inaccesibles;
- cabeceras y tipos de contenido correctos;
- el cliente inserta los resultados como texto y no contiene la clave de Gemini.

La interfaz se recorrió en Chrome sin interfaz gráfica, controlado por un script, en escritorio (1280 px) y móvil (390 px):
- comparación de los tres motores;
- selección de cada método;
- estado parcial cuando Gemini no está configurado;
- ausencia de desplazamiento horizontal en móvil.

Las capturas están en [ui/](ui/). Son reales y no contienen secretos. Se tomaron con Gemini sin configurar, por lo que su tarjeta muestra el error esperado.

## Credenciales y despliegue

La clave permanece en `.env`, excluido de Git y fuera de los recursos estáticos. El servicio ML no registra el contenido de los tickets. El despliegue en Vercel se deja preparado para los motores tradicional y generativo, pero no se realiza. El servicio Python no se ejecuta en Vercel; ahí el modo `ml` responde `ML_UNAVAILABLE` salvo que `ML_SERVICE_URL` apunte a un servicio publicado.
