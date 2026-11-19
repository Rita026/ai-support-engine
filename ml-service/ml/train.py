"""Entrena los clasificadores de categoría y prioridad.

Uso (desde ml-service/):
    python -m ml.train

1. Valida data/tickets.csv.
2. Elige C con validación cruzada agrupada sobre el conjunto de entrenamiento.
3. Evalúa el modelo y el baseline del ejemplo con:
   - partición 80/20 aleatoria estratificada (la del ejemplo original);
   - partición 80/20 por escenario (StratifiedGroupKFold sobre template_id):
     los escenarios de prueba nunca se ven al entrenar;
   - validación cruzada de 5 folds por escenario (media y desviación);
   - data/dev_cases.csv: 30 tickets redactados aparte, sin plantillas.
4. Reentrena con todo el dataset y guarda models/model.joblib.
5. Escribe reports/training_report.json y reports/training_report.md.
"""

import hashlib
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold, train_test_split

from .config import (
    C_GRID, CATEGORIES, DATASET_PATH, DEV_CASES_PATH, MAX_MESSAGE_LENGTH, MODEL_PATH, PRIORITIES,
    RANDOM_STATE, REPORTS_DIR, SEARCH_FOLDS, TARGETS, TEST_FOLDS,
)
from .pipeline import build_baseline, build_pipeline

LABELS = {"category": CATEGORIES, "priority": PRIORITIES}
REQUIRED_COLUMNS = ("id", "message", "category", "priority", "template_id")


class DatasetError(ValueError):
    pass


def load_dataset(path=DATASET_PATH):
    if not path.exists():
        raise DatasetError(f"No existe {path}. Ejecuta: python scripts/generate_dataset.py")
    data = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")
    missing = [column for column in REQUIRED_COLUMNS if column not in data.columns]
    if missing:
        raise DatasetError(f"Faltan columnas en el dataset: {', '.join(missing)}")
    data["message"] = data["message"].str.strip()
    if (data["message"] == "").any():
        raise DatasetError("Hay mensajes vacíos en el dataset.")
    if (data["message"].str.len() > MAX_MESSAGE_LENGTH).any():
        raise DatasetError(f"Hay mensajes de más de {MAX_MESSAGE_LENGTH} caracteres.")
    if data["id"].duplicated().any():
        raise DatasetError("Hay identificadores duplicados.")
    for target, labels in LABELS.items():
        unknown = sorted(set(data[target]) - set(labels))
        if unknown:
            raise DatasetError(f"Etiquetas desconocidas en {target}: {', '.join(unknown)}")
    if set(data["category"]) != set(CATEGORIES):
        raise DatasetError("El dataset debe incluir las cuatro categorías.")
    return data


def file_sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def random_split(data):
    """Partición del ejemplo original: 80/20 aleatoria y estratificada."""
    return train_test_split(
        data.index, test_size=0.2, stratify=data["category"] + "|" + data["priority"],
        random_state=RANDOM_STATE,
    )


def group_split(data):
    """80/20 por escenario: ningún template_id aparece en ambos lados."""
    splitter = StratifiedGroupKFold(n_splits=TEST_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    train_idx, test_idx = next(splitter.split(
        data["message"], data["category"] + "|" + data["priority"], groups=data["template_id"],
    ))
    return data.index[train_idx], data.index[test_idx]


def tune(train, target):
    """Elige C con validación cruzada agrupada (macro-F1) sin tocar el conjunto de prueba."""
    search = GridSearchCV(
        build_pipeline(),
        {"classifier__C": list(C_GRID)},
        scoring="f1_macro",
        cv=StratifiedGroupKFold(n_splits=SEARCH_FOLDS, shuffle=True, random_state=RANDOM_STATE),
        n_jobs=1,
    )
    search.fit(train["message"], train[target], groups=train["template_id"])
    return float(search.best_params_["classifier__C"]), float(search.best_score_)


def metrics(y_true, y_pred, labels):
    present = [label for label in labels if label in set(y_true) | set(y_pred)]
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macroF1": round(float(f1_score(y_true, y_pred, labels=present, average="macro", zero_division=0)), 4),
        "labels": present,
        "confusionMatrix": confusion_matrix(y_true, y_pred, labels=present).tolist(),
        "report": classification_report(y_true, y_pred, labels=present, output_dict=True, zero_division=0),
        "reportText": classification_report(y_true, y_pred, labels=present, zero_division=0),
    }


def evaluate_split(data, train_idx, test_idx, best_c):
    train, test = data.loc[train_idx], data.loc[test_idx]
    result = {
        "trainSize": int(len(train)), "testSize": int(len(test)),
        "testScenarios": sorted(test["template_id"].unique().tolist()),
        "models": {},
    }
    predictions = {}
    for name in ("baseline", "model"):
        result["models"][name] = {}
        predictions[name] = {}
        for target in TARGETS:
            pipeline = build_baseline() if name == "baseline" else build_pipeline(best_c[target])
            pipeline.fit(train["message"], train[target])
            predicted = pipeline.predict(test["message"])
            predictions[name][target] = predicted
            result["models"][name][target] = metrics(test[target].to_numpy(), predicted, LABELS[target])
        joint = (predictions[name]["category"] == test["category"].to_numpy()) & (
            predictions[name]["priority"] == test["priority"].to_numpy())
        result["models"][name]["jointAccuracy"] = round(float(np.mean(joint)), 4)
    return result


def cross_validate_grouped(data, best_c):
    """Validación cruzada por escenario: cada fold deja fuera escenarios completos."""
    splitter = StratifiedGroupKFold(n_splits=TEST_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    folds = list(splitter.split(data["message"], data["category"] + "|" + data["priority"], groups=data["template_id"]))
    summary = {}
    for name in ("baseline", "model"):
        scores = {"categoryMacroF1": [], "priorityMacroF1": [], "jointAccuracy": []}
        for train_idx, test_idx in folds:
            train, test = data.iloc[train_idx], data.iloc[test_idx]
            predicted = {}
            for target in TARGETS:
                pipeline = build_baseline() if name == "baseline" else build_pipeline(best_c[target])
                predicted[target] = pipeline.fit(train["message"], train[target]).predict(test["message"])
            scores["categoryMacroF1"].append(f1_score(test["category"], predicted["category"], average="macro"))
            scores["priorityMacroF1"].append(f1_score(test["priority"], predicted["priority"], average="macro"))
            scores["jointAccuracy"].append(np.mean(
                (predicted["category"] == test["category"].to_numpy()) & (predicted["priority"] == test["priority"].to_numpy())))
        summary[name] = {key: {"mean": round(float(np.mean(v)), 4), "std": round(float(np.std(v)), 4)} for key, v in scores.items()}
    return summary


def evaluate_dev_cases(data, best_c, path=DEV_CASES_PATH):
    """Tickets redactados aparte del generador; sirven para elegir la configuración."""
    if not path.exists():
        return None
    dev = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")
    result = {"size": int(len(dev)), "models": {}}
    for name in ("baseline", "model"):
        predicted = {}
        for target in TARGETS:
            pipeline = build_baseline() if name == "baseline" else build_pipeline(best_c[target])
            predicted[target] = pipeline.fit(data["message"], data[target]).predict(dev["message"])
        category_ok = predicted["category"] == dev["category"].to_numpy()
        joint_ok = category_ok & (predicted["priority"] == dev["priority"].to_numpy())
        result["models"][name] = {
            "categoryAccuracy": round(float(np.mean(category_ok)), 4),
            "jointAccuracy": round(float(np.mean(joint_ok)), 4),
        }
    return result


def train_final(data, best_c):
    models = {}
    for target in TARGETS:
        pipeline = build_pipeline(best_c[target])
        pipeline.fit(data["message"], data[target])
        models[target] = pipeline
    return models


def render_markdown(report):
    lines = [
        "# Reporte de entrenamiento",
        "",
        f"- Fecha UTC: {report['trainedAt']}",
        f"- Versión del modelo: `{report['modelVersion']}`",
        f"- Dataset: `data/tickets.csv` ({report['dataset']['rows']} filas, {report['dataset']['scenarios']} escenarios), SHA-256 `{report['dataset']['sha256']}`",
        f"- scikit-learn {report['sklearnVersion']}",
        f"- C elegido por validación cruzada agrupada: categoría {report['bestC']['category']}, prioridad {report['bestC']['priority']}",
        "",
        "**Modelo**: TF-IDF de palabras (1-2) + TF-IDF de caracteres (3-5) y regresión logística con clases balanceadas, un modelo por objetivo.",
        "**Baseline**: el pipeline del ejemplo (TF-IDF (1-2) + LogisticRegression).",
        "Acierto conjunto = categoría y prioridad correctas a la vez, igual que en la comparación de motores.",
        "",
        "| Partición | Modelo | Categoría acc. | Categoría macro-F1 | Prioridad acc. | Prioridad macro-F1 | Acierto conjunto |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    names = {"random": "Aleatoria estratificada", "grouped": "Por escenario (estricta)"}
    for split in ("random", "grouped"):
        for model in ("baseline", "model"):
            entry = report["evaluation"][split]["models"][model]
            lines.append(
                f"| {names[split]} | {model} | {entry['category']['accuracy']:.2%} | {entry['category']['macroF1']:.4f} "
                f"| {entry['priority']['accuracy']:.2%} | {entry['priority']['macroF1']:.4f} | {entry['jointAccuracy']:.2%} |"
            )
    lines += [
        "",
        "La partición aleatoria mezcla redacciones del mismo escenario en entrenamiento y prueba, por lo que sus cifras son optimistas.",
        "La partición por escenario deja fuera escenarios completos y estima mejor la generalización a tickets redactados de otra forma.",
        "",
        "## Validación cruzada por escenario (5 folds)",
        "",
        "| Modelo | Categoría macro-F1 | Prioridad macro-F1 | Acierto conjunto |",
        "| --- | --- | --- | --- |",
    ]
    for model in ("baseline", "model"):
        entry = report["evaluation"]["groupedCrossValidation"][model]
        lines.append(
            f"| {model} | {entry['categoryMacroF1']['mean']:.4f} ± {entry['categoryMacroF1']['std']:.4f} "
            f"| {entry['priorityMacroF1']['mean']:.4f} ± {entry['priorityMacroF1']['std']:.4f} "
            f"| {entry['jointAccuracy']['mean']:.2%} ± {entry['jointAccuracy']['std']:.2%} |"
        )
    dev = report["evaluation"].get("devCases")
    if dev:
        lines += [
            "",
            f"## Conjunto de desarrollo (`data/dev_cases.csv`, {dev['size']} tickets redactados aparte)",
            "",
            "| Modelo | Categoría correcta | Acierto conjunto |",
            "| --- | --- | --- |",
        ]
        for model in ("baseline", "model"):
            entry = dev["models"][model]
            lines.append(f"| {model} | {entry['categoryAccuracy']:.2%} | {entry['jointAccuracy']:.2%} |")
    lines.append("")
    grouped = report["evaluation"]["grouped"]
    lines += [
        "## Detalle: partición por escenario, modelo final",
        "",
        f"Entrenamiento: {grouped['trainSize']} filas. Prueba: {grouped['testSize']} filas de los escenarios {', '.join(grouped['testScenarios'])}.",
        "",
    ]
    for target in TARGETS:
        entry = grouped["models"]["model"][target]
        lines += [f"### {target}", "", "```", entry["reportText"].rstrip(), "```", "",
                  "Matriz de confusión (filas = real, columnas = predicho):", "",
                  "| real \\ predicho | " + " | ".join(entry["labels"]) + " |",
                  "| --- |" + " --- |" * len(entry["labels"])]
        for label, row in zip(entry["labels"], entry["confusionMatrix"]):
            lines.append(f"| {label} | " + " | ".join(str(value) for value in row) + " |")
        lines.append("")
    lines += [
        "## Límites",
        "",
        "- Datos sintéticos: las métricas no equivalen a precisión con tickets reales.",
        "- El modelo final se reentrena con las 2 000 filas después de evaluar; las cifras anteriores provienen de modelos que no vieron el conjunto de prueba.",
        "- La evaluación externa con los 12 casos de la comparación formal está en `fixtures_eval.md`.",
        "",
    ]
    return "\n".join(lines)


def strip_text_reports(evaluation):
    """El JSON conserva el reporte estructurado; el texto solo se usa en Markdown."""
    clean = json.loads(json.dumps(evaluation))
    for split in ("random", "grouped"):
        for model in clean[split]["models"].values():
            for target in TARGETS:
                model[target].pop("reportText", None)
    return clean


def train(dataset_path=DATASET_PATH, model_path=MODEL_PATH, reports_dir=REPORTS_DIR, write_reports=True, verbose=True):
    data = load_dataset(dataset_path)
    sha256 = file_sha256(dataset_path)
    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    version = f"{trained_at[:10].replace('-', '')}-{sha256[:8]}"

    group_train, group_test = group_split(data)
    best_c, cv_scores = {}, {}
    for target in TARGETS:
        best_c[target], cv_scores[target] = tune(data.loc[group_train], target)
        if verbose:
            print(f"[{target}] C={best_c[target]} macro-F1 CV agrupada={cv_scores[target]:.4f}")

    evaluation = {
        "random": evaluate_split(data, *random_split(data), best_c),
        "grouped": evaluate_split(data, group_train, group_test, best_c),
        "groupedCrossValidation": cross_validate_grouped(data, best_c),
        "devCases": evaluate_dev_cases(data, best_c),
    }
    models = train_final(data, best_c)
    metadata = {
        "modelVersion": version,
        "trainedAt": trained_at,
        "sklearnVersion": sklearn.__version__,
        "dataset": {
            "path": "data/tickets.csv", "sha256": sha256, "rows": int(len(data)),
            "scenarios": int(data["template_id"].nunique()),
        },
        "bestC": best_c,
        "crossValidationMacroF1": {target: round(score, 4) for target, score in cv_scores.items()},
        "labels": {"category": list(CATEGORIES), "priority": list(PRIORITIES)},
        # Combinaciones categoría-prioridad presentes en el dataset (política de etiquetado).
        "allowedPriorities": {
            category: [p for p in PRIORITIES if ((data["category"] == category) & (data["priority"] == p)).any()]
            for category in CATEGORIES
        },
    }
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"models": models, "metadata": metadata}, model_path)

    report = {**metadata, "evaluation": evaluation}
    if write_reports:
        reports_dir.mkdir(parents=True, exist_ok=True)
        (reports_dir / "training_report.json").write_text(
            json.dumps({**metadata, "evaluation": strip_text_reports(evaluation)}, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        (reports_dir / "training_report.md").write_text(render_markdown(report), encoding="utf-8")
    if verbose:
        for split in ("random", "grouped"):
            for name in ("baseline", "model"):
                entry = evaluation[split]["models"][name]
                print(f"{split:8} {name:8} categoría F1={entry['category']['macroF1']:.4f} "
                      f"prioridad F1={entry['priority']['macroF1']:.4f} conjunto={entry['jointAccuracy']:.2%}")
        cv = evaluation["groupedCrossValidation"]["model"]["jointAccuracy"]
        print(f"CV por escenario (5 folds) acierto conjunto={cv['mean']:.2%} ± {cv['std']:.2%}")
        if evaluation["devCases"]:
            print(f"Casos de desarrollo: acierto conjunto={evaluation['devCases']['models']['model']['jointAccuracy']:.2%}")
        print(f"Modelo guardado en {model_path} (versión {version})")
    return report


if __name__ == "__main__":
    train()
