"""Calidad del dataset: formato, etiquetas, política, duplicados y fuga hacia los fixtures."""

import csv
import importlib.util
import json

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ml.config import CATEGORIES, DATASET_PATH, DEV_CASES_PATH, FIXTURES_PATH, PRIORITIES, ROOT
from ml.preprocessing import normalize_text


def load_generator():
    spec = importlib.util.spec_from_file_location("generate_dataset", ROOT / "scripts" / "generate_dataset.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_columnas_tamano_e_identificadores(dataset):
    assert list(dataset.columns) == ["id", "message", "category", "priority", "template_id", "source"]
    assert len(dataset) == 2000
    assert dataset["id"].is_unique
    assert (dataset["message"].str.len() > 0).all()
    assert (dataset["message"].str.len() <= 5000).all()


def test_etiquetas_validas_y_balance_de_categorias(dataset):
    assert set(dataset["category"]) == set(CATEGORIES)
    assert set(dataset["priority"]) == set(PRIORITIES)
    assert dataset["category"].value_counts().to_dict() == {category: 500 for category in CATEGORIES}
    assert dataset["priority"].value_counts().min() >= 300


def test_politica_de_prioridades(dataset):
    combos = set(zip(dataset["category"], dataset["priority"]))
    assert ("FEATURE", "HIGH") not in combos and ("FEATURE", "CRITICAL") not in combos
    assert ("SECURITY", "LOW") not in combos
    for category in ("ACCESS", "BUG"):
        assert {(category, priority) for priority in PRIORITIES} <= combos


def test_variantes_dificiles_presentes(dataset):
    counts = dataset["source"].value_counts()
    for source in ("base", "injection", "mixed", "negation"):
        assert counts.get(source, 0) >= 30
    # Las órdenes de manipulación se etiquetan por el problema real, en todas las categorías.
    assert set(dataset.loc[dataset["source"] == "injection", "category"]) == set(CATEGORIES)
    assert set(dataset.loc[dataset["source"] == "mixed", "category"]) == {"SECURITY"}


def test_sin_duplicados_normalizados(dataset):
    assert dataset["message"].map(normalize_text).is_unique


def test_escenarios_suficientes_para_particion_por_grupo(dataset):
    per_category = dataset.groupby("category")["template_id"].nunique()
    assert per_category.min() >= 10
    assert dataset.groupby("template_id")["category"].nunique().max() == 1


def test_sin_fuga_hacia_los_casos_de_la_comparacion(dataset):
    fixtures = [entry["message"] for entry in json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))]
    assert not set(dataset["message"].map(normalize_text)) & {normalize_text(m) for m in fixtures}
    vectorizer = TfidfVectorizer(preprocessor=normalize_text, ngram_range=(1, 2)).fit(list(dataset["message"]) + fixtures)
    similarity = cosine_similarity(vectorizer.transform(dataset["message"]), vectorizer.transform(fixtures))
    assert similarity.max() < 0.85


def test_casos_de_desarrollo_independientes(dataset):
    with DEV_CASES_PATH.open(encoding="utf-8") as handle:
        dev = list(csv.DictReader(handle))
    assert len(dev) == 30
    assert {row["category"] for row in dev} == set(CATEGORIES)
    assert not {normalize_text(row["message"]) for row in dev} & set(dataset["message"].map(normalize_text))


def test_el_csv_coincide_con_el_generador_determinista():
    rows, _dropped, _similarity = load_generator().generate()
    with DATASET_PATH.open(encoding="utf-8") as handle:
        stored = list(csv.DictReader(handle))
    assert [dict(row) for row in stored] == [
        {key: row[key] for key in ("id", "message", "category", "priority", "template_id", "source")} for row in rows
    ]
