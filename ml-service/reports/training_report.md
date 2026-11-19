# Reporte de entrenamiento

- Fecha UTC: 2026-11-18T23:34:29Z
- Versión del modelo: `20261118-84e6ca6e`
- Dataset: `data/tickets.csv` (2000 filas, 57 escenarios), SHA-256 `84e6ca6e94322cb86aa917506acc10148b5a302e492d45e873c9e4360b96095a`
- scikit-learn 1.6.1
- C elegido por validación cruzada agrupada: categoría 10.0, prioridad 10.0

**Modelo**: TF-IDF de palabras (1-2) + TF-IDF de caracteres (3-5) y regresión logística con clases balanceadas, un modelo por objetivo.
**Baseline**: el pipeline del ejemplo (TF-IDF (1-2) + LogisticRegression).
Acierto conjunto = categoría y prioridad correctas a la vez, igual que en la comparación de motores.

| Partición | Modelo | Categoría acc. | Categoría macro-F1 | Prioridad acc. | Prioridad macro-F1 | Acierto conjunto |
| --- | --- | --- | --- | --- | --- | --- |
| Aleatoria estratificada | baseline | 99.00% | 0.9899 | 95.75% | 0.9596 | 95.25% |
| Aleatoria estratificada | model | 99.00% | 0.9899 | 98.25% | 0.9836 | 97.75% |
| Por escenario (estricta) | baseline | 85.85% | 0.8480 | 80.49% | 0.7919 | 74.15% |
| Por escenario (estricta) | model | 90.24% | 0.8901 | 79.76% | 0.7814 | 75.85% |

La partición aleatoria mezcla redacciones del mismo escenario en entrenamiento y prueba, por lo que sus cifras son optimistas.
La partición por escenario deja fuera escenarios completos y estima mejor la generalización a tickets redactados de otra forma.

## Validación cruzada por escenario (5 folds)

| Modelo | Categoría macro-F1 | Prioridad macro-F1 | Acierto conjunto |
| --- | --- | --- | --- |
| baseline | 0.8302 ± 0.0540 | 0.8767 ± 0.0520 | 76.54% ± 6.00% |
| model | 0.8663 ± 0.0575 | 0.8850 ± 0.0645 | 80.45% ± 6.74% |

## Conjunto de desarrollo (`data/dev_cases.csv`, 30 tickets redactados aparte)

| Modelo | Categoría correcta | Acierto conjunto |
| --- | --- | --- |
| baseline | 83.33% | 73.33% |
| model | 96.67% | 86.67% |

## Detalle: partición por escenario, modelo final

Entrenamiento: 1590 filas. Prueba: 410 filas de los escenarios ACC_ACCOUNT_LOCKED, ACC_LOW_RECOVERY_SETTINGS, ACC_LOW_SESSION_TIMEOUT, ACC_ONBOARDING, BUG_CRIT_DATA_CORRUPTION, BUG_SYNC, BUG_UPLOAD_FAIL, BUG_WRONG_DATA, FEAT_BULK_IMPORT, SEC_CRIT_RANSOMWARE, SEC_DATA_EXPOSURE, SEC_INJECTION_XSS.

### category

```
              precision    recall  f1-score   support

      ACCESS       0.94      0.92      0.93       142
         BUG       0.85      0.92      0.88       111
     FEATURE       0.76      0.90      0.83        42
    SECURITY       0.99      0.87      0.93       115

    accuracy                           0.90       410
   macro avg       0.88      0.90      0.89       410
weighted avg       0.91      0.90      0.90       410
```

Matriz de confusión (filas = real, columnas = predicho):

| real \ predicho | ACCESS | BUG | FEATURE | SECURITY |
| --- | --- | --- | --- | --- |
| ACCESS | 130 | 10 | 1 | 1 |
| BUG | 4 | 102 | 5 | 0 |
| FEATURE | 0 | 4 | 38 | 0 |
| SECURITY | 5 | 4 | 6 | 100 |

### priority

```
              precision    recall  f1-score   support

         LOW       0.75      0.47      0.58        98
      MEDIUM       0.62      0.86      0.72        92
        HIGH       0.89      0.84      0.86       110
    CRITICAL       0.93      1.00      0.96       110

    accuracy                           0.80       410
   macro avg       0.80      0.79      0.78       410
weighted avg       0.81      0.80      0.79       410
```

Matriz de confusión (filas = real, columnas = predicho):

| real \ predicho | LOW | MEDIUM | HIGH | CRITICAL |
| --- | --- | --- | --- | --- |
| LOW | 46 | 44 | 5 | 3 |
| MEDIUM | 7 | 79 | 6 | 0 |
| HIGH | 8 | 5 | 92 | 5 |
| CRITICAL | 0 | 0 | 0 | 110 |

## Límites

- Datos sintéticos: las métricas no equivalen a precisión con tickets reales.
- El modelo final se reentrena con las 2 000 filas después de evaluar; las cifras anteriores provienen de modelos que no vieron el conjunto de prueba.
- La evaluación externa con los 12 casos de la comparación formal está en `fixtures_eval.md`.
