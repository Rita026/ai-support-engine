"""Carga el modelo entrenado y construye la respuesta con el contrato del proyecto."""

import joblib
import sklearn

from .config import (
    CATEGORIES, CATEGORY_CONFIDENCE_THRESHOLD, MODEL_PATH, PRIORITIES,
    PRIORITY_CONFIDENCE_THRESHOLD,
)

# Respuestas predefinidas: el motor ML clasifica, no redacta texto libre.
REPLIES = {
    "ACCESS": (
        "Lamentamos el problema de acceso. Revisa que tu usuario esté bien escrito y usa la opción "
        "de recuperación de contraseña si es necesario. Si continúa, comparte el mensaje que aparece "
        "en pantalla, sin enviar contraseñas ni códigos de verificación."
    ),
    "BUG": (
        "Gracias por reportar la falla. Indícanos los pasos para reproducirla, qué esperabas que "
        "ocurriera y el mensaje de error que aparece, sin incluir datos sensibles, para que soporte "
        "pueda revisarla."
    ),
    "FEATURE": (
        "Gracias por tu propuesta. Cuéntanos qué problema resolvería y a quién beneficiaría para que "
        "el equipo de producto pueda evaluarla."
    ),
    "SECURITY": (
        "Gracias por avisarnos de este posible incidente de seguridad. El caso debe escalarse al equipo "
        "de seguridad para revisión humana. No compartas contraseñas, tokens ni datos sensibles por "
        "este medio."
    ),
}
PRIORITY_NOTES = {
    "HIGH": " Por el impacto que describes, el caso se clasificó con prioridad alta.",
    "CRITICAL": " Por el impacto descrito, el caso se clasificó como crítico y se recomienda escalarlo de inmediato.",
}
LOW_CONFIDENCE_NOTE = (
    "No tenemos suficiente certeza sobre tu solicitud. Describe qué intentabas hacer, qué ocurrió y "
    "si aparece algún mensaje de error. "
)


class ModelError(RuntimeError):
    """El archivo del modelo falta, está dañado o no es compatible."""


def build_response(category, priority, low_confidence):
    text = REPLIES[category] + PRIORITY_NOTES.get(priority, "")
    # SECURITY ya se escala a revisión humana; la nota solo pide detalles en los demás casos.
    return (LOW_CONFIDENCE_NOTE + text) if low_confidence and category != "SECURITY" else text


class Predictor:
    def __init__(self, bundle):
        try:
            self.category_model = bundle["models"]["category"]
            self.priority_model = bundle["models"]["priority"]
            self.metadata = bundle["metadata"]
        except (KeyError, TypeError) as error:
            raise ModelError("El archivo del modelo no tiene el formato esperado.") from error
        if self.metadata.get("sklearnVersion") != sklearn.__version__:
            raise ModelError(
                f"El modelo se entrenó con scikit-learn {self.metadata.get('sklearnVersion')} "
                f"y está instalada la versión {sklearn.__version__}. Vuelve a entrenar."
            )
        if set(self.category_model.classes_) != set(CATEGORIES) or not set(self.priority_model.classes_) <= set(PRIORITIES):
            raise ModelError("Las etiquetas del modelo no coinciden con el contrato.")

    @classmethod
    def load(cls, path=MODEL_PATH):
        if not path.exists():
            raise ModelError(f"No existe {path}. Ejecuta: python -m ml.train")
        try:
            bundle = joblib.load(path)
        except Exception as error:  # joblib puede lanzar varios tipos al leer un archivo dañado.
            raise ModelError("No fue posible leer el archivo del modelo.") from error
        return cls(bundle)

    @property
    def version(self):
        return self.metadata["modelVersion"]

    @staticmethod
    def _top(model, text):
        probabilities = model.predict_proba([text])[0]
        best = int(probabilities.argmax())
        return str(model.classes_[best]), float(probabilities[best])

    def _priority(self, text, category):
        """Prioridad más probable entre las que la política permite para la categoría.

        Las probabilidades se renormalizan sobre las prioridades permitidas; así un
        ticket FEATURE nunca recibe HIGH/CRITICAL ni uno SECURITY recibe LOW.
        """
        probabilities = self.priority_model.predict_proba([text])[0]
        classes = [str(label) for label in self.priority_model.classes_]
        allowed = set(self.metadata.get("allowedPriorities", {}).get(category, classes))
        scores = {label: float(p) for label, p in zip(classes, probabilities) if label in allowed}
        total = sum(scores.values())
        if not scores or total <= 0:
            best = int(probabilities.argmax())
            return classes[best], float(probabilities[best])
        priority = max(scores, key=scores.get)
        return priority, scores[priority] / total

    def predict(self, message):
        text = str(message).strip()
        if not text:
            raise ValueError("El mensaje está vacío.")
        category, category_confidence = self._top(self.category_model, text)
        priority, priority_confidence = self._priority(text, category)
        low_confidence = (
            category_confidence < CATEGORY_CONFIDENCE_THRESHOLD
            or priority_confidence < PRIORITY_CONFIDENCE_THRESHOLD
        )
        return {
            "category": category,
            "priority": priority,
            "response": build_response(category, priority, low_confidence),
            "requiresHumanReview": category == "SECURITY" or low_confidence,
            "confidence": {
                "category": round(category_confidence, 4),
                "priority": round(priority_confidence, 4),
            },
            "modelVersion": self.version,
        }
