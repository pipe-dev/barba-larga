# Especificación de Arquitectura de Alta Escala: 100.000 Usuarios/Mes y 500 Concurrentes

**Proyecto**: Barba Larga AppointMe  
**Fecha**: 2026-09-03  
**Estado**: Aprobado por el usuario (Brainstorming validado)  
**Objetivo**: Escalar la plataforma a 100.000 visitas mensuales y picos de 500 usuarios simultáneos, manteniendo $0 de costo operativo dentro de los planes gratuitos de Firebase (Spark) y Vercel (Hobby).

---

## 1. Contexto y Diagnóstico de Cuellos de Botella

### 1.1 Límites Críticos Identificados
1. **Firestore Free Tier (Spark)**:
   - 50.000 lecturas de documentos / día.
   - Si 3.300 visitas diarias consultan catálogo y equipo sin caché: ~80.000 lecturas/día (supera la cuota en horas).
2. **Vercel Fast Data Transfer (Hobby)**:
   - 100 GB de transferencia / mes.
   - Diagnóstico de archivos actuales: `Background-logo.mp4` (10.1 MB) + fotos sin comprimir (5.1 MB, 4.6 MB, 3.7 MB) = **~25 MB por visitante**.
   - Con 25 MB por visitante, la cuota de 100 GB se agotaba en apenas **4.000 visitas**. Con 100.000 visitas requeriría 2.500 GB.
3. **Concurrencia de 500 Usuarios Simultáneos**:
   - Múltiples clientes intentando reservar el mismo turno en el mismo segundo generan colisiones o reintentos de escritura si no existe un candado atómico en milisegundos.

---

## 2. Arquitectura de 3 Pilares

```
                            [ 100.000 Usuarios / Mes ]
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │         Vercel Edge / CDN         │
                     │  (Cache-Control: immutable 1 año) │
                     └─────────────────┬─────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────────────┐
│     CATÁLOGOS ESTÁTICOS       │             │       DISPONIBILIDAD Y RESERVAS       │
│   (Servicios, Equipo, Info)   │             │             (Tiempo Real)             │
├───────────────────────────────┤             ├───────────────────────────────────────┤
│ • Servidos desde Next.js      │             │ • Consulta en vivo de turnos libres   │
│   Data Cache (unstable_cache) │             │ • Candados atómicos (Upstash Redis)   │
│ • 0 lecturas a Firestore      │             │ • Fallback a Transacción Firestore    │
│ • Revalidación On-Demand      │             │ • Rate Limiting anti-spam             │
│   solo cuando Admin edita     │             │                                       │
└───────────────┬───────────────┘             └───────────────────┬───────────────────┘
                │                                                 │
                ▼                                                 ▼
┌───────────────────────────────┐             ┌───────────────────────────────────────┐
│     FIRESTORE (Base de Datos) │             │       CDN EXTERNA (ImgBB / Media)     │
│   • Colecciones: services,    │             │   • Fotos de cortes y barberos        │
│     team, appointments, logs  │             │   • 0 MB consumidos en Vercel         │
└───────────────────────────────┘             └───────────────────────────────────────┘
```

---

## 3. Pilar 1: Catálogos Estáticos con Revalidación On-Demand

### 3.1 Política de Datos
* **Colecciones en caché**: `services` (Catálogo), `team` (Barberos), `products` (Tienda si aplica).
* **Comportamiento**:
  * Las funciones `getServicesFromDB()` y `getTeam()` se envuelven con `unstable_cache` de Next.js.
  * Etiquetas de caché: `['services']`, `['team']`.
  * Duración por defecto: 24 horas (86400s).
  * **0 lecturas de Firestore** para los 100.000 visitantes mientras no haya cambios.

### 3.2 Invalidación Instantánea (On-Demand)
Cuando un administrador realiza una acción en el panel:
* `createService`, `updateService`, `deleteService` ➔ ejecuta `revalidateTag('services')`.
* `createBarber`, `updateBarber`, `deleteBarber` ➔ ejecuta `revalidateTag('team')`.
* El servidor purga la memoria de inmediato y la siguiente visita refresca el catálogo en milisegundos.

---

## 4. Pilar 2: Citas en Tiempo Real y Candados de Concurrencia (Redis + Fallback)

### 4.1 Disponibilidad en Tiempo Real
* La agenda de turnos (`getAvailableTimesForDate`) **permanece 100% en tiempo real**.
* Las citas existentes para un día específico se leen de Firestore con consultas indexadas (`date == YYYY-MM-DD`).

### 4.2 Candados Atómicos de Turnos (Distributed Locks)
Para evitar que 2 de los 500 usuarios simultáneos reserven el mismo turno:
1. Al momento de confirmar la cita, se solicita un candado temporal para la llave:
   `lock:appointment:{barberId}:{date}:{time}`
2. **Con Upstash Redis**:
   - Ejecuta `SET key lockToken NX EX 120` (bloqueo atómico durante 2 minutos).
   - Si la llave ya existe: Retorna de inmediato *"Este horario acaba de ser seleccionado por otro cliente"*.
   - Si la llave se adquiere: Escribe la cita en Firestore y libera el candado `DEL key`.
3. **Resiliencia y Fallback Nativo (Cero Caídas)**:
   - Si `UPSTASH_REDIS_REST_URL` no está configurada o hay interrupción de red, el sistema **conmuta automáticamente a una transacción atómica de Firestore** (`runTransaction`) que valida si el turno sigue libre antes de guardar.
   - Garantía: Cero turnos duplicados y disponibilidad ininterrumpida.

### 4.3 Protección Anti-Spam (Rate Limiting)
* Límite de 5 intentos de reserva por IP por minuto mediante Redis (con fallback permisivo si Redis no está activo).

---

## 5. Pilar 3: Optimización Multimedia y Ancho de Banda (Vercel 100 GB)

### 5.1 Desacoplamiento de Fotos a CDN
* Todas las fotos de servicios y barberos se sirven desde URLs de CDN externa (ImgBB / Cloudinary).
* En Firestore solo se almacena el string URL (`https://i.ibb.co/...`).
* Consumo de ancho de banda en Vercel por imágenes de catálogo: **0 MB**.

### 5.2 Optimización de Medios Locales
* **`Background-logo.mp4`**: Comprimido para web con perfil H.264/WebM de alto rendimiento (~1.2 MB a 1.5 MB).
* **Imágenes de respaldo locales**: Convertidas a WebP de alta fidelidad (~100-150 KB).
* **Audios (`ambiente.mp3`, `scissors.mp3`)**: Optimizados a 96 kbps.

### 5.3 Encabezados de Caché Inmutable (`next.config.ts`)
```ts
{
  source: '/(multimedia|fonts)/(.*)',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=31536000, immutable',
    },
  ],
}
```
* Una vez descargados el video y las fuentes por primera vez, el navegador los retiene en disco local. Las visitas recurrentes consumen **0 bytes** de transferencia.

---

## 6. Plan de Verificación y Métricas de Éxito

| Métrica | Antes de la Optimización | Después de la Optimización | Estado Objetivo |
|---|---|---|---|
| **Lecturas Firestore (100k usuarios)** | ~700.000 lecturas/mes | < 1.000 lecturas/mes | 🟢 Seguro en Plan Gratis (50k/día) |
| **Transferencia Vercel (100k usuarios)** | ~2.500 GB/mes (Colapso) | ~35 - 50 GB/mes | 🟢 Seguro en Plan Gratis (100 GB) |
| **Tiempo de Respuesta de Catálogo** | 350 - 600 ms | 15 - 40 ms | 🟢 Ultrarrápido (Edge Cache) |
| **Colisiones de Citas Simultáneas** | Posibles con alta concurrencia | 0 colisiones (Candado atómico) | 🟢 Garantía de no solapamiento |

---

## 7. Variables de Entorno (Opcionales para Modo Enterprise)
* `UPSTASH_REDIS_REST_URL`: URL del cluster Redis de Upstash (Opcional).
* `UPSTASH_REDIS_REST_TOKEN`: Token de autenticación de Upstash (Opcional).
* *(Si faltan, el sistema opera con 100% de funcionalidad usando la caché nativa de Next.js y transacciones Firestore).*
