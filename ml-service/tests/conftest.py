import pytest

from app.main import load_or_train
from ml.train import load_dataset


@pytest.fixture(scope="session")
def dataset():
    return load_dataset()


@pytest.fixture(scope="session")
def predictor():
    # Usa models/model.joblib si existe y es compatible; si no, entrena como el servicio.
    return load_or_train()
