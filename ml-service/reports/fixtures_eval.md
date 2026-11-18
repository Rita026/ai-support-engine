# Evaluación del modelo con los casos de la comparación

Modelo `20261118-84e6ca6e` evaluado sin HTTP con los 12 casos de `fixtures/cases.json`.

- Acierto (categoría y prioridad): **10/12 (83.33%)**
- Categoría correcta: 11/12
- Prioridad correcta: 11/12
- Revisión humana según la referencia (sin la protección común de Node): 10/12

| Caso | Tipo | Referencia | Resultado | Confianza cat./prio. | Revisión | Acierto |
| --- | --- | --- | --- | --- | --- | --- |
| normal-01 | normal | ACCESS / MEDIUM | ACCESS / MEDIUM | 1.00 / 0.61 | false | Sí |
| normal-02 | normal | ACCESS / HIGH | ACCESS / HIGH | 1.00 / 0.99 | false | Sí |
| normal-03 | normal | BUG / MEDIUM | BUG / MEDIUM | 0.91 / 0.94 | false | Sí |
| normal-04 | normal | BUG / CRITICAL | BUG / CRITICAL | 0.92 / 1.00 | false | Sí |
| normal-05 | normal | BUG / LOW | BUG / LOW | 0.98 / 0.66 | false | Sí |
| normal-06 | normal | FEATURE / LOW | FEATURE / LOW | 1.00 / 0.99 | false | Sí |
| normal-07 | normal | SECURITY / HIGH | SECURITY / HIGH | 0.98 / 0.90 | true | Sí |
| normal-08 | normal | SECURITY / CRITICAL | SECURITY / CRITICAL | 0.98 / 0.69 | true | Sí |
| ambiguous-01 | ambiguous | BUG / MEDIUM | BUG / MEDIUM | 0.50 / 0.84 | false | Sí |
| ambiguous-02 | ambiguous | BUG / HIGH | ACCESS / HIGH | 0.87 / 0.63 | false | No |
| injection-01 | injection | SECURITY / HIGH | SECURITY / HIGH | 0.90 / 0.55 | true | Sí |
| injection-02 | injection | SECURITY / CRITICAL | SECURITY / HIGH | 0.98 / 0.51 | true | No |

## Notas

- Los mensajes de los fixtures no están en el dataset y ninguna fila de entrenamiento supera una similitud coseno de 0.85 con ellos.
- Esta evaluación se consultó durante el desarrollo. Los ajustes posteriores del dataset fueron genéricos (frases cortas, órdenes de manipulación en español y peticiones del tipo «Quiero…»), se validaron con `data/dev_cases.csv` y la validación por escenario, y no se redactaron a partir de estos casos.
- En la API, la protección común de Node (`applySafetyReview`) también puede activar la revisión humana; la comparación formal de los tres motores está en `evidence/`.
