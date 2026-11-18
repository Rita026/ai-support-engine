# Evidencia de ejecución

Última ejecución: 2026-11-18T23:43:30.116Z (UTC), con los tres motores.

- [Tabla y métricas](run-2026-11-18T23-43-30-116Z/results.md)
- [Respuestas reales y referencias](run-2026-11-18T23-43-30-116Z/results.json)
- [Tabla CSV](run-2026-11-18T23-43-30-116Z/results.csv)
- [Conclusión técnica](conclusion.md)

Estado de las 36 respuestas (12 casos × 3 motores): válidas. Referencias sin cambios (SHA-256 verificado al inicio y al final). Modelo de machine learning `20261118-84e6ca6e`.

| Motor | Aciertos de categoría y prioridad | Precisión | Formato válido | Revisión humana según referencia | Latencia media |
| --- | --- | --- | --- | --- | --- |
| Tradicional | 11/12 | 91.67% | 12/12 | 12/12 | 5 ms |
| Gemini | 12/12 | 100% | 12/12 | 11/12 | 1497 ms |
| Machine learning | 10/12 | 83.33% | 12/12 | 10/12 | 13 ms |

Fallos y discrepancias:

- **Tradicional**: ambiguous-02 recibió MEDIUM en lugar de HIGH, igual que en la ejecución anterior.
- **Machine learning**: ambiguous-02 se clasificó como ACCESS/HIGH, porque el mensaje empieza con «Al entrar…». injection-02 recibió HIGH en lugar de CRITICAL; la categoría SECURITY y la revisión humana fueron correctas. En ambiguous-01 la clasificación fue correcta, pero no pidió revisión humana: la confianza de categoría quedó justo en el umbral de 0.50.
- **Gemini**: en ambiguous-02 no pidió revisión humana. En normal-04 su respuesta volvió a afirmar que el equipo de infraestructura ya trabaja en la restauración; el prototipo no ejecuta esas acciones y se conserva como limitación observada.

Antes de la ejecución se hizo una única llamada de prueba a Gemini para confirmar la clave (13 llamadas reales en total). No se repitió la comparación ni se ajustaron reglas, prompt, modelo ni referencias después de observar los resultados.

## Otras evidencias

- [72 pruebas automáticas de Node aprobadas](unit-tests.txt)
- [40 pruebas automáticas del servicio ML aprobadas](ml-tests.txt)
- [Reporte de entrenamiento del modelo](../ml-service/reports/training_report.md) y [evaluación directa con los 12 casos](../ml-service/reports/fixtures_eval.md)
- Capturas reales de la interfaz: [escritorio](ui/escritorio-comparacion.png) y [móvil](ui/movil-comparacion.png). Se tomaron con Gemini sin configurar para verificar el estado parcial; muestran reglas y ML respondiendo y la tarjeta de error de Gemini.
- [Validación y limitaciones](validation.md)

## Ejecuciones anteriores (dos motores)

- [Ejecución del 2026-11-12](run-2026-11-12T23-15-22-174Z/results.md): tradicional 11/12, Gemini 12/12.
- [Intento interrumpido, conservado por transparencia](run-2026-11-12T23-14-02-932Z/interruption.md).
