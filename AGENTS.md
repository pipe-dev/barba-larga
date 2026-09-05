# Reglas de Telemetría y Resiliencia del Proyecto

## 1. Aislamiento de Fallos en Servicios Secundarios
- Ningún fallo en servicios secundarios (correos SMTP con nodemailer, SMS, notificaciones externas o analíticas) debe abortar o cancelar transacciones críticas de base de datos (creación de citas, pagos o cancelaciones).
- Todo servicio externo debe estar envuelto en bloques try/catch que capturen el error y lo reporten mediante `logSystemEvent` de `@/lib/telemetry`.

## 2. Telemetría y Registro de Errores (System Logs)
- Toda excepción no controlada o fallo de servicio debe registrarse con:
  - Nivel: `info`, `warning`, `error`, `critical`.
  - Fuente (`source`) y Acción (`action`) clara.
  - Stack trace completo serializado.
  - Metadatos relevantes sanitizados (sin contraseñas ni tokens).
- El sistema de telemetría debe ser silencioso y jamás arrojar excepciones que rompan la aplicación.

## 3. Consola de Diagnóstico
- La ruta `/admin/system-logs` mantiene la visibilidad de los registros del sistema protegida por PIN y muestra la versión activa (ej. Versión 2.1).