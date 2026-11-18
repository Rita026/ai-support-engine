"""Contrato HTTP del servicio FastAPI."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

KEYS = {"category", "priority", "response", "requiresHumanReview", "confidence", "modelVersion"}


@pytest.fixture(scope="module")
def client(predictor):
    with TestClient(create_app(predictor_loader=lambda: predictor)) as test_client:
        yield test_client


def post(client, body, **kwargs):
    return client.post("/predict", content=json.dumps(body), headers={"Content-Type": "application/json"}, **kwargs)


def test_health(client, predictor):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["modelVersion"] == predictor.version


def test_prediccion_cumple_el_contrato(client):
    response = post(client, {"message": "Alguien entró a mi cuenta sin autorización"})
    assert response.status_code == 200
    data = response.json()
    assert set(data) == KEYS
    assert data["category"] == "SECURITY"
    assert data["requiresHumanReview"] is True
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_no_repite_el_contenido_del_ticket(client):
    data = post(client, {"message": "Error al guardar con el código interno zq9-token-privado"}).json()
    assert "zq9-token-privado" not in json.dumps(data)


@pytest.mark.parametrize("body", [
    {}, {"message": ""}, {"message": "   "}, {"message": 10}, {"message": None},
    {"message": "x" * 5001}, {"message": "Hola", "mode": "ml"}, [], "texto",
])
def test_validacion_de_entrada(client, body):
    response = post(client, body)
    assert response.status_code == 400
    assert response.json() == {"error": {"code": "INVALID_REQUEST", "message": response.json()["error"]["message"]}}


def test_limites_de_longitud(client):
    assert post(client, {"message": "x" * 5000}).status_code == 200


def test_json_tipo_y_tamano(client):
    malformed = client.post("/predict", content="{", headers={"Content-Type": "application/json"})
    assert malformed.status_code == 400 and malformed.json()["error"]["code"] == "INVALID_JSON"
    wrong_type = client.post("/predict", content="message=x", headers={"Content-Type": "application/x-www-form-urlencoded"})
    assert wrong_type.status_code == 415
    large = post(client, {"message": "x" * 70000})
    assert large.status_code == 413 and large.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_metodo_y_rutas(client):
    response = client.get("/predict")
    assert response.status_code == 405 and response.headers["allow"] == "POST"
    assert client.get("/no-existe").json()["error"]["code"] == "NOT_FOUND"


def test_sin_modelo_responde_503():
    def failing_loader():
        raise RuntimeError("modelo ausente")

    with TestClient(create_app(predictor_loader=failing_loader)) as client:
        assert client.get("/health").status_code == 503
        response = post(client, {"message": "No puedo iniciar sesión"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "MODEL_NOT_READY"
