# Evidencia de ejecución

Última ejecución: 2026-11-12T23:15:22.174Z (UTC).

- [Tabla y métricas](run-2026-11-12T23-15-22-174Z/results.md)
- [Respuestas reales y referencias](run-2026-11-12T23-15-22-174Z/results.json)
- [Tabla CSV](run-2026-11-12T23-15-22-174Z/results.csv)
- [Conclusión técnica](conclusion.md)

Estado de las 24 respuestas: válidas. Las capturas y la verificación visual, si están disponibles, se describen en validation.md.

| Motor | Aciertos de categoría y prioridad | Precisión | Formato válido | Revisión humana según referencia | Latencia media |
| --- | --- | --- | --- | --- | --- |
| Tradicional | 11/12 | 91.67% | 12/12 | 12/12 | 11 ms |
| Gemini | 12/12 | 100% | 12/12 | 10/12 | 1776 ms |

- [Registro de 52 pruebas automáticas aprobadas](unit-tests.txt)
- [Validación y limitaciones](validation.md)
- [Intento previo interrumpido, conservado por transparencia](run-2026-11-12T23-14-02-932Z/interruption.md)

Las discrepancias de revisión de Gemini fueron normal-04 (más conservador que la referencia) y ambiguous-02 (no solicitó revisión, aunque la referencia sí). En normal-04 su respuesta también afirmó que ingeniería ya había sido notificada; el prototipo no ejecuta notificaciones y esa afirmación se conserva como limitación observada. No se modificaron los resultados ni se volvió a ajustar el modelo para mejorar las métricas.
