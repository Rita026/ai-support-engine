export function normalizeText(message) {
  return message.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// Conservative triage, not a complete incident detector. See docs/contracts.md.
export function hasSecuritySignals(message) {
  const text = normalizeText(message);
  return /\b(vulnerabilidad(?:es)?|ransomware|malware|phishing|hacke\w*|hackeo|brecha|inyeccion sql|sql injection|xss|exfiltr\w*|filtracion|filtraron|filtrando|robo de datos|datos robados|acceso no autorizado|accesos no autorizados|sesion desconocida|actividad sospechosa|incidente de seguridad|ataque(?:s)?|comprometid[oa]s?)\b/.test(text)
    || /\b(alguien|otra persona|un tercero)\b.{0,60}\b(entro|accedio|accede|ingreso)\b.{0,50}\b(cuenta|datos|sistema)\b/.test(text)
    || /\b(datos|credenciales|contrasenas)\b.{0,35}\b(expuest[oa]s?|public[oa]s?|filtrad[oa]s?)\b/.test(text);
}

export function applySafetyReview(message, result) {
  return {
    ...result,
    requiresHumanReview: result.requiresHumanReview || result.category === 'SECURITY' || hasSecuritySignals(message),
  };
}
