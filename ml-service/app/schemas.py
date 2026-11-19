"""Contratos de entrada y salida del servicio."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from ml.config import MAX_MESSAGE_LENGTH

Message = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_MESSAGE_LENGTH)]


class PredictRequest(BaseModel):
    # strict: un número no se convierte en texto; extra: se rechazan campos desconocidos.
    model_config = ConfigDict(extra="forbid", strict=True)
    message: Message


class Confidence(BaseModel):
    category: float = Field(ge=0, le=1)
    priority: float = Field(ge=0, le=1)


class PredictResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal["ACCESS", "BUG", "FEATURE", "SECURITY"]
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    response: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    requiresHumanReview: bool
    confidence: Confidence
    modelVersion: str
