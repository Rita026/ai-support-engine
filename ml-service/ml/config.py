"""Rutas, etiquetas y parámetros compartidos por el entrenamiento y el servicio."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "tickets.csv"
DEV_CASES_PATH = ROOT / "data" / "dev_cases.csv"
MODEL_PATH = ROOT / "models" / "model.joblib"
REPORTS_DIR = ROOT / "reports"
FIXTURES_PATH = ROOT.parent / "fixtures" / "cases.json"

# Deben coincidir con src/contracts.js.
CATEGORIES = ("ACCESS", "BUG", "FEATURE", "SECURITY")
PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
TARGETS = ("category", "priority")

RANDOM_STATE = 42
TEST_FOLDS = 5          # 1 de 5 grupos de escenarios queda para prueba (~20 %).
SEARCH_FOLDS = 4
C_GRID = (1.0, 3.0, 10.0, 30.0)

# Por debajo de estas probabilidades el ticket se marca para revisión humana.
# Calibrados con predicciones fuera de muestra (validación cruzada por escenario):
# categoría < 0.50 marca ~19 % de los tickets, con 34 % de error entre los marcados
# frente a 6 % en el resto; prioridad < 0.55 marca ~10 %, con 51 % de error frente a 9 %.
CATEGORY_CONFIDENCE_THRESHOLD = 0.50
PRIORITY_CONFIDENCE_THRESHOLD = 0.55

MAX_MESSAGE_LENGTH = 5000
