"""Definición de los pipelines de scikit-learn."""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline

from .config import RANDOM_STATE
from .preprocessing import normalize_text


def build_pipeline(C=10.0, class_weight="balanced"):
    """TF-IDF de palabras (1-2) + TF-IDF de caracteres (3-5) -> regresión logística.

    Los n-gramas de caracteres hacen al modelo tolerante a errores de dedo,
    abreviaturas y variaciones de conjugación; class_weight compensa clases
    con menos ejemplos (por ejemplo, CRITICAL).
    """
    features = FeatureUnion([
        ("words", TfidfVectorizer(
            preprocessor=normalize_text, ngram_range=(1, 2), sublinear_tf=True,
        )),
        ("chars", TfidfVectorizer(
            preprocessor=normalize_text, analyzer="char_wb", ngram_range=(3, 5),
            sublinear_tf=True, min_df=2,
        )),
    ])
    classifier = LogisticRegression(
        C=C, max_iter=2000, class_weight=class_weight, random_state=RANDOM_STATE,
    )
    return Pipeline([("features", features), ("classifier", classifier)])


def build_baseline():
    """El pipeline del ejemplo original, conservado para comparar."""
    return Pipeline([
        ("vectorizer", TfidfVectorizer(ngram_range=(1, 2))),
        ("classifier", LogisticRegression(max_iter=1000)),
    ])
