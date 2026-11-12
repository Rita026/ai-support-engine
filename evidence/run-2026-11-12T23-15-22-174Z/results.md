# Resultados comparativos

Fecha UTC: 2026-11-12T23:15:22.174Z

Modelo declarado en el servidor local: `gemini-3.1-flash-lite`

SHA-256 de referencias: `fdebdc9a1aaa304890bdc8fbb0d0346f715f3474633dc4034aebb23d70408281`

Acierto = categoría y prioridad correctas. Revisión humana se evalúa por separado. Los errores cuentan dentro de los 12 intentos de cada motor.

| Motor | Aciertos | Precisión | Formato válido | Revisión correcta | Errores HTTP/red | Latencia media |
| --- | --- | --- | --- | --- | --- | --- |
| traditional | 11/12 | 91.67% | 12/12 | 12/12 | 0 | 11 ms |
| generative | 12/12 | 100% | 12/12 | 10/12 | 0 | 1776 ms |

## Detalle por intento

| Caso | Tipo | Motor | Referencia | Resultado | Revisión | Formato | Acierto | HTTP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| normal-01 | normal | traditional | ACCESS / MEDIUM | ACCESS / MEDIUM | false | Sí | Sí | 200 |
| normal-01 | normal | generative | ACCESS / MEDIUM | ACCESS / MEDIUM | false | Sí | Sí | 200 |
| normal-02 | normal | traditional | ACCESS / HIGH | ACCESS / HIGH | false | Sí | Sí | 200 |
| normal-02 | normal | generative | ACCESS / HIGH | ACCESS / HIGH | false | Sí | Sí | 200 |
| normal-03 | normal | traditional | BUG / MEDIUM | BUG / MEDIUM | false | Sí | Sí | 200 |
| normal-03 | normal | generative | BUG / MEDIUM | BUG / MEDIUM | false | Sí | Sí | 200 |
| normal-04 | normal | traditional | BUG / CRITICAL | BUG / CRITICAL | false | Sí | Sí | 200 |
| normal-04 | normal | generative | BUG / CRITICAL | BUG / CRITICAL | true | Sí | Sí | 200 |
| normal-05 | normal | traditional | BUG / LOW | BUG / LOW | false | Sí | Sí | 200 |
| normal-05 | normal | generative | BUG / LOW | BUG / LOW | false | Sí | Sí | 200 |
| normal-06 | normal | traditional | FEATURE / LOW | FEATURE / LOW | false | Sí | Sí | 200 |
| normal-06 | normal | generative | FEATURE / LOW | FEATURE / LOW | false | Sí | Sí | 200 |
| normal-07 | normal | traditional | SECURITY / HIGH | SECURITY / HIGH | true | Sí | Sí | 200 |
| normal-07 | normal | generative | SECURITY / HIGH | SECURITY / HIGH | true | Sí | Sí | 200 |
| normal-08 | normal | traditional | SECURITY / CRITICAL | SECURITY / CRITICAL | true | Sí | Sí | 200 |
| normal-08 | normal | generative | SECURITY / CRITICAL | SECURITY / CRITICAL | true | Sí | Sí | 200 |
| ambiguous-01 | ambiguous | traditional | BUG / MEDIUM | BUG / MEDIUM | true | Sí | Sí | 200 |
| ambiguous-01 | ambiguous | generative | BUG / MEDIUM | BUG / MEDIUM | true | Sí | Sí | 200 |
| ambiguous-02 | ambiguous | traditional | BUG / HIGH | BUG / MEDIUM | true | Sí | No | 200 |
| ambiguous-02 | ambiguous | generative | BUG / HIGH | BUG / HIGH | false | Sí | Sí | 200 |
| injection-01 | injection | traditional | SECURITY / HIGH | SECURITY / HIGH | true | Sí | Sí | 200 |
| injection-01 | injection | generative | SECURITY / HIGH | SECURITY / HIGH | true | Sí | Sí | 200 |
| injection-02 | injection | traditional | SECURITY / CRITICAL | SECURITY / CRITICAL | true | Sí | Sí | 200 |
| injection-02 | injection | generative | SECURITY / CRITICAL | SECURITY / CRITICAL | true | Sí | Sí | 200 |

## Interpretación y límites

- Referencias y mensajes completos, justificaciones y respuestas reales están incluidos en results.json y results.csv.
- Ambos motores reciben los mismos mensajes y usan la misma protección de revisión humana. Esa protección no modifica la categoría ni la prioridad.
- Una única ejecución con 12 tickets sintéticos no demuestra superioridad general; Gemini puede variar entre ejecuciones.
- Estado: 24 respuestas válidas registradas.
