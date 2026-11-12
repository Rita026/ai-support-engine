# Referencias de la comparación

`cases.json` contiene 12 mensajes sintéticos: ocho normales, dos ambiguos y dos intentos de manipulación. Las referencias se definieron antes de ejecutar ambos motores y no se cambiaron después de observar resultados.

El criterio combina tipo de problema e impacto descrito. Las justificaciones están junto a cada referencia. El caso ambiguous-02 interpreta una carga que no termina como BUG/HIGH; reconoce que su causa no está confirmada y necesita revisión humana. Esta decisión humana se mantiene fija aunque un motor tenga otra interpretación.

El conjunto se preparó después de las comprobaciones exploratorias de las partes 1 y 2, que ya habían motivado un ajuste del prompt de seguridad. Antes de la comparación formal, una prueba automática detectó y permitió corregir la expresión «cuenta está bloqueada». No se ajustaron reglas ni prompts a partir de los resultados de la comparación formal.

El comparador valida cantidad, distribución, identificadores y cobertura. Persiste las referencias y su hash antes de la primera petición y comprueba que no cambiaron al terminar. Ambos motores reciben exactamente los mismos mensajes. Una primera ejecución se interrumpió al descubrir que el puerto 3000 pertenecía a otra instancia; sus intentos permanecen archivados y la ejecución completa usa la instancia controlada del puerto 3101.

Git conserva `cases.json` con finales de línea LF mediante .gitattributes para que su hash sea reproducible al clonar en distintos sistemas.

El acierto principal exige categoría y prioridad correctas. La revisión humana se informa aparte y no suma ni resta a esa métrica. La redacción libre se conserva como evidencia, sin una valoración automática subjetiva. El conjunto es pequeño y exploratorio, no una prueba de generalización.
