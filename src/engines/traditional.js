import { hasSecuritySignals, normalizeText } from '../safety.js';

const REPLIES = {
  ACCESS: 'Lamentamos el inconveniente de acceso. Verifica tu usuario y utiliza la recuperación de contraseña si es necesario. Si persiste, contacta a soporte indicando el mensaje de error, sin compartir contraseñas ni códigos de verificación.',
  BUG: 'Lamentamos la falla. Comparte los pasos para reproducirla, el resultado esperado y el mensaje de error, sin incluir datos sensibles, para que soporte pueda revisarla.',
  FEATURE: 'Gracias por tu sugerencia. Describe el objetivo de la funcionalidad y cómo ayudaría a tu trabajo para que el equipo de producto pueda evaluarla.',
  SECURITY: 'Gracias por reportar este posible incidente. Escálalo al equipo de seguridad para revisión humana y comparte el contexto por un canal seguro. No envíes contraseñas, tokens ni datos sensibles en este formulario.',
};

function hasCriticalImpact(text, security) {
  const outage = /\b(caida (general|total)|sistema completamente caido|servicio completamente caido|toda la plataforma esta caida|todo el sistema esta caido|ningun usuario puede (acceder|entrar|trabajar)|nadie puede (acceder|entrar|trabajar))\b/.test(text)
    || /\b(todos los usuarios|toda la empresa)\b.{0,60}\b(no pueden|sin servicio|bloquead[oa]s)\b/.test(text);
  const uncertain = /\b(posible|posibles|podria|sospecho|sospecha)\b/.test(text);
  const activeIncident = security && !uncertain && /\b(ransomware|ataque activo|filtracion de datos|datos (expuestos|robados|publicados)|estan (robando|filtrando)|cifraron los archivos)\b/.test(text);
  return outage || activeIncident;
}

export function analyzeTraditional(message) {
  const text = normalizeText(message);
  let category;
  if (hasSecuritySignals(text)) category = 'SECURITY';
  else if (/\b(agregar|anadir|incorporar|nueva funcionalidad|nuevas funcionalidades|modo oscuro|solicitud de mejora|integracion con)\b/.test(text)
    || /\b(me gustaria|seria util|quisiera)\b.{0,70}\b(exportar|integrar|personalizar|funcion|funcionalidad)\b/.test(text)) category = 'FEATURE';
  else if (/\b(iniciar sesion|inicio de sesion|inicios de sesion|login|contrasena|credenciales|acceso|acceder|cuenta bloqueada|no puedo entrar|no puedo ingresar|autenticacion|codigo de verificacion)\b/.test(text)) category = 'ACCESS';
  else if (/\b(error|errores|falla|fallas|fallo|fallos|bug|no funciona|no carga|se cierra|se congela|se cuelga|lento|lentitud|caido|caida|boton|pantalla|desalineado|desalineada|tipografia)\b/.test(text)) category = 'BUG';

  if (!category) {
    return {
      category: 'BUG', priority: 'MEDIUM',
      response: 'Necesitamos más información para clasificar tu solicitud. Describe qué intentabas hacer, qué ocurrió y si hay un mensaje de error, sin compartir datos sensibles. El caso requiere revisión humana.',
      requiresHumanReview: true, mode: 'traditional',
    };
  }
  let priority = category === 'FEATURE' ? 'LOW' : 'MEDIUM';
  const cosmetic = /\b(cosmetico|cosmetica|desalineado|desalineada|tipografia|color incorrecto|error de ortografia)\b/.test(text);
  const blocked = /\b(no puedo trabajar|no podemos trabajar|bloquea mi trabajo|bloquea el trabajo|impide trabajar|sin alternativa|no puedo completar|no podemos completar|bloqueo total)\b/.test(text);
  if (category === 'BUG' && cosmetic) priority = 'LOW';
  if (blocked || category === 'SECURITY') priority = 'HIGH';
  if (hasCriticalImpact(text, category === 'SECURITY')) priority = 'CRITICAL';
  return {
    category, priority, response: REPLIES[category],
    requiresHumanReview: category === 'SECURITY', mode: 'traditional',
  };
}
