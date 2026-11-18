"""Evalúa el modelo entrenado con los 12 casos de la comparación formal.

Uso (desde ml-service/):
    python scripts/evaluate_fixtures.py

Usa el predictor directamente, sin HTTP, para separar la calidad del modelo de
la integración. Los casos de fixtures/cases.json no forman parte del dataset de
entrenamiento (ver data/README.md) y sus referencias no se modifican.
Escribe reports/fixtures_eval.json y reports/fixtures_eval.md.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.config import FIXTURES_PATH, MODEL_PATH, REPORTS_DIR  # noqa: E402
from ml.predictor import Predictor  # noqa: E402


def evaluate(predictor, cases):
    rows = []
    for case in cases:
        result = predictor.predict(case["message"])
        expected = case["expected"]
        rows.append({
            "id": case["id"],
            "kind": case["kind"],
            "expected": expected,
            "category": result["category"],
            "priority": result["priority"],
            "requiresHumanReview": result["requiresHumanReview"],
            "confidence": result["confidence"],
            "categoryCorrect": result["category"] == expected["category"],
            "priorityCorrect": result["priority"] == expected["priority"],
            "humanReviewCorrect": result["requiresHumanReview"] == expected["requiresHumanReview"],
            "correct": result["category"] == expected["category"] and result["priority"] == expected["priority"],
        })
    total = len(rows)
    summary = {
        "cases": total,
        "correct": sum(row["correct"] for row in rows),
        "accuracyPercent": round(sum(row["correct"] for row in rows) / total * 100, 2),
        "correctCategory": sum(row["categoryCorrect"] for row in rows),
        "correctPriority": sum(row["priorityCorrect"] for row in rows),
        "correctHumanReview": sum(row["humanReviewCorrect"] for row in rows),
    }
    return rows, summary


def render_markdown(model_version, rows, summary):
    lines = [
        "# Evaluación del modelo con los casos de la comparación",
        "",
        f"Modelo `{model_version}` evaluado sin HTTP con los {summary['cases']} casos de `fixtures/cases.json`.",
        "",
        f"- Acierto (categoría y prioridad): **{summary['correct']}/{summary['cases']} ({summary['accuracyPercent']}%)**",
        f"- Categoría correcta: {summary['correctCategory']}/{summary['cases']}",
        f"- Prioridad correcta: {summary['correctPriority']}/{summary['cases']}",
        f"- Revisión humana según la referencia (sin la protección común de Node): {summary['correctHumanReview']}/{summary['cases']}",
        "",
        "| Caso | Tipo | Referencia | Resultado | Confianza cat./prio. | Revisión | Acierto |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in rows:
        expected = row["expected"]
        lines.append(
            f"| {row['id']} | {row['kind']} | {expected['category']} / {expected['priority']} "
            f"| {row['category']} / {row['priority']} | {row['confidence']['category']:.2f} / {row['confidence']['priority']:.2f} "
            f"| {str(row['requiresHumanReview']).lower()} | {'Sí' if row['correct'] else 'No'} |"
        )
    lines += [
        "",
        "## Notas",
        "",
        "- Los mensajes de los fixtures no están en el dataset y ninguna fila de entrenamiento supera una similitud coseno de 0.85 con ellos.",
        "- Esta evaluación se consultó durante el desarrollo. Los ajustes posteriores del dataset fueron genéricos (frases cortas, órdenes de manipulación en español y peticiones del tipo «Quiero…»), se validaron con `data/dev_cases.csv` y la validación por escenario, y no se redactaron a partir de estos casos.",
        "- En la API, la protección común de Node (`applySafetyReview`) también puede activar la revisión humana; la comparación formal de los tres motores está en `evidence/`.",
        "",
    ]
    return "\n".join(lines)


def main():
    predictor = Predictor.load(MODEL_PATH)
    cases = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
    rows, summary = evaluate(predictor, cases)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "fixtures_eval.json").write_text(
        json.dumps({"modelVersion": predictor.version, "summary": summary, "rows": rows}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (REPORTS_DIR / "fixtures_eval.md").write_text(render_markdown(predictor.version, rows, summary), encoding="utf-8")
    print(f"Acierto {summary['correct']}/{summary['cases']} ({summary['accuracyPercent']}%), "
          f"revisión {summary['correctHumanReview']}/{summary['cases']}")


if __name__ == "__main__":
    main()
