"""Servicio FastAPI del motor de machine learning.

Uso (desde ml-service/):
    uvicorn app.main:app --host 127.0.0.1 --port 8000

Endpoints:
    GET  /health   estado y versión del modelo
    POST /predict  {"message": "..."} -> categoría, prioridad, respuesta,
                   revisión humana, confianza y versión del modelo

El servicio no guarda ni registra el contenido de los tickets.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from ml.config import MODEL_PATH
from ml.predictor import ModelError, Predictor

from .schemas import PredictRequest, PredictResponse

MAX_BODY_BYTES = 64 * 1024
NO_STORE = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
logger = logging.getLogger("ml-service")


def error_response(status, code, message, headers=None):
    return JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status,
        headers={**NO_STORE, **(headers or {})},
    )


def load_or_train(model_path=MODEL_PATH):
    """Carga el modelo; si falta o no es compatible, lo entrena una vez."""
    try:
        return Predictor.load(model_path)
    except ModelError as error:
        logger.warning("Modelo no disponible (%s). Entrenando...", error)
    from ml.train import train  # Importación diferida: solo se necesita si no hay modelo.
    train(model_path=model_path, write_reports=False, verbose=False)
    return Predictor.load(model_path)


class PayloadTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    """Rechaza cuerpos mayores a MAX_BODY_BYTES, con o sin Content-Length."""

    def __init__(self, app, max_bytes=MAX_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        too_large = error_response(413, "PAYLOAD_TOO_LARGE", "La solicitud supera el tamaño permitido.")
        length = dict(scope["headers"]).get(b"content-length")
        if length is not None and length.isdigit() and int(length) > self.max_bytes:
            return await too_large(scope, receive, send)
        received = 0
        started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise PayloadTooLarge()
            return message

        async def tracked_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except PayloadTooLarge:
            if not started:
                await too_large(scope, receive, send)


def create_app(predictor_loader=load_or_train):
    @asynccontextmanager
    async def lifespan(app):
        try:
            app.state.predictor = predictor_loader()
        except Exception:  # El servicio arranca y responde 503 en lugar de caerse.
            logger.exception("No fue posible cargar ni entrenar el modelo.")
            app.state.predictor = None
        yield

    app = FastAPI(
        title="AI Support Engine - ML service",
        description="Clasificación de tickets con TF-IDF y regresión logística.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(BodySizeLimitMiddleware)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request, error):
        if error.status_code == 405:
            return error_response(405, "METHOD_NOT_ALLOWED", "Método no permitido.", {"Allow": "POST"})
        if error.status_code == 404:
            return error_response(404, "NOT_FOUND", "Recurso no encontrado.")
        return error_response(error.status_code, "HTTP_ERROR", "No fue posible procesar la solicitud.")

    @app.exception_handler(Exception)
    async def unexpected_error(_request, _error):
        logger.error("Error inesperado en el servicio ML.")  # Sin detalles del ticket.
        return error_response(500, "INTERNAL_ERROR", "Ocurrió un error inesperado en el servicio ML.")

    @app.get("/health")
    async def health(request: Request):
        predictor = request.app.state.predictor
        if predictor is None:
            return JSONResponse({"status": "unavailable"}, status_code=503, headers=NO_STORE)
        return JSONResponse(
            {"status": "ok", "modelVersion": predictor.version, "trainedAt": predictor.metadata["trainedAt"]},
            headers=NO_STORE,
        )

    @app.post("/predict", response_model=PredictResponse)
    async def predict(request: Request):
        content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type != "application/json":
            return error_response(415, "UNSUPPORTED_MEDIA_TYPE", "Envía la solicitud como application/json.")
        try:
            payload = await request.json()
        except ValueError:
            return error_response(400, "INVALID_JSON", "El cuerpo de la solicitud no es JSON válido.")
        try:
            body = PredictRequest.model_validate(payload)
        except ValidationError:
            return error_response(
                400, "INVALID_REQUEST",
                "Envía message como texto de 1 a 5000 caracteres, sin campos adicionales.",
            )
        predictor = request.app.state.predictor
        if predictor is None:
            return error_response(503, "MODEL_NOT_READY", "El modelo no está disponible. Revisa el entrenamiento.")
        result = await run_in_threadpool(predictor.predict, body.message)
        checked = PredictResponse.model_validate(result)
        return JSONResponse(checked.model_dump(), headers=NO_STORE)

    return app


app = create_app()
