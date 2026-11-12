# Ejecución interrumpida

Este intento contra `http://127.0.0.1:3000` se detuvo tras cinco casos (10 respuestas: cinco tradicionales y cinco generativas). Al intentar iniciar el servidor de verificación se detectó que el puerto ya estaba ocupado por otra instancia, por lo que no se continuó utilizando ese servidor.

Las respuestas parciales originales se conservan sin alterar en `results.json`. No se utilizan para la precisión de la ejecución final, no se presentan como una comparación completa y no se descartan como si no hubieran ocurrido. No hubo cambios de referencias, reglas ni prompt entre ambos intentos.

La ejecución completa, con su instancia controlada en el puerto 3101, está en `../run-2026-11-12T23-15-22-174Z/`. Esta repetición añadió 12 llamadas reales a Gemini a las cinco ya realizadas en el intento interrumpido.
