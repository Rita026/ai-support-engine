"""Normalización de texto equivalente a normalizeText de src/safety.js."""

import re
import unicodedata

_SPACES = re.compile(r"\s+")


def normalize_text(text):
    """Quita acentos y diacríticos, pasa a minúsculas y colapsa espacios."""
    decomposed = unicodedata.normalize("NFD", str(text))
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return _SPACES.sub(" ", without_marks.lower()).strip()
