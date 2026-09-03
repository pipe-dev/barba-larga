# Arquitectura de Alta Escala: 100.000 Usuarios/Mes y 500 Concurrentes - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar una arquitectura híbrida de alta escala con caché en memoria on-demand (`unstable_cache`), candados atómicos de concurrencia (`Upstash Redis` con fallback nativo a Firestore) y desvío de medios pesados a CDN (ImgBB) para soportar 100.000 usuarios/mes y 500 concurrentes a costo $0.

**Architecture:** 
1. Catálogos estáticos (`services`, `team`) leídos desde Vercel Data Cache con invalidación on-demand (`revalidateTag`).
2. Agenda de citas en tiempo real protegida con candados atómicos distribuidos (Redis `SET NX EX` y fallback a `runTransaction` en Firestore).
3. Transferencia de medios pesados a CDN externa (ImgBB) + cabeceras `Cache-Control: immutable` en `next.config.ts`.

**Tech Stack:** Next.js 15 App Router, Firebase Firestore, Upstash Redis REST API, ImgBB API, Vitest.

---

### Task 1: Desacoplamiento Multimedia a CDN y Reducción de Ancho de Banda

**Files:**
- Create: `scripts/upload-media-to-imgbb.mjs`
- Modify: `next.config.ts`
- Target: `public/multimedia/*`

**Interfaces:**
- Produces: URLs de ImgBB para cada imagen del catálogo y reglas de cabecera inmutables en `next.config.ts`.

- [ ] **Step 1: Crear script de migración automática a ImgBB**
  - Script que lee las imágenes pesadas de `public/multimedia/`, las sube vía POST a `https://api.imgbb.com/1/upload?key=ee478f85a2e97387a2e9a62d2b984e48` y genera un mapeo JSON con sus URLs seguras de CDN.
- [ ] **Step 2: Ejecutar la subida y registrar las URLs de CDN en Firestore**
  - Actualizar los 7 servicios y miembros del equipo en Firestore para que apunten a sus URLs de CDN en lugar de rutas locales pesadas.
- [ ] **Step 3: Configurar Cache-Control inmutable en `next.config.ts`**
  - Agregar cabeceras para `/(multimedia|fonts)/(.*)` con `Cache-Control: public, max-age=31536000, immutable`.
- [ ] **Step 4: Verificar reducción de peso y commit**
  - Commit: `feat(media): offload catalog images to ImgBB CDN and set immutable caching`

---

### Task 2: Caché On-Demand en Servidor (`unstable_cache` + `revalidateTag`)

**Files:**
- Modify: `src/app/actions/services.ts`
- Modify: `src/app/actions.ts`
- Test: `src/tests/cache-invalidation.test.ts`

**Interfaces:**
- Produces: `getCachedServices()`, `getCachedTeam()`, `revalidateTag('services')`, `revalidateTag('team')`.

- [ ] **Step 1: Escribir prueba unitaria para verificar la lógica de caché e invalidación**
- [ ] **Step 2: Envolver `getServicesFromDB` con `unstable_cache`**
  - Usar tag `['services']` y `revalidate: 86400`.
- [ ] **Step 3: Envolver `getTeam` con `unstable_cache`**
  - Usar tag `['team']` y `revalidate: 86400`.
- [ ] **Step 4: Agregar `revalidateTag` en todas las mutaciones administrativas**
  - `createService`, `updateService`, `deleteService` ➔ `revalidateTag('services')`.
  - `saveTeamMember`, `deleteTeamMember`, `updateTeamMemberAvailability` ➔ `revalidateTag('team')`.
- [ ] **Step 5: Ejecutar pruebas unitarias y commit**
  - Commit: `feat(cache): implement on-demand revalidated data cache for services and team`

---

### Task 3: Candados Atómicos de Citas en Tiempo Real (Redis + Firestore Fallback)

**Files:**
- Create: `src/lib/redis.ts`
- Modify: `src/app/actions.ts` (función `bookAppointment`)
- Test: `src/tests/concurrency-lock.test.ts`

**Interfaces:**
- Produces: `acquireLock(key: string, ttlSeconds: number)`, `releaseLock(key: string, token: string)`, `checkRateLimit(ip: string)`.

- [ ] **Step 1: Escribir prueba unitaria para simulación de concurrencia y candados**
- [ ] **Step 2: Crear módulo `src/lib/redis.ts`**
  - Cliente REST ligero sin dependencias pesadas que se conecta a Upstash Redis si las variables `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` existen.
  - Implementar funciones `acquireLock` y `releaseLock` con auto-expiración.
- [ ] **Step 3: Integrar el candado de turno en `bookAppointment`**
  - Al reservar, intentar adquirir `lock:slot:{barberId}:{date}:{time}`.
  - Si el candado no se obtiene (otro usuario lo tomó en ese instante), rechazar la cita con mensaje amigable.
- [ ] **Step 4: Implementar Fallback Automático a Transacción Firestore**
  - Si Redis no está configurado, ejecutar `runTransaction` en Firestore para asegurar que la cita se reserve de forma atómica y sin colisiones.
- [ ] **Step 5: Ejecutar pruebas y commit**
  - Commit: `feat(concurrency): atomic distributed locks via Redis with Firestore transaction fallback`

---

### Task 4: Verificación Integral de Rendimiento y Compilación

**Files:**
- Full project inspection

- [ ] **Step 1: Ejecutar `npm run lint`** (0 errores, 0 warnings).
- [ ] **Step 2: Ejecutar `npm run typecheck`** (0 errores de TypeScript).
- [ ] **Step 3: Ejecutar `npm run test`** (todas las pruebas aprobadas).
- [ ] **Step 4: Ejecutar `npm run build`** (12/12 páginas generadas con éxito).
- [ ] **Step 5: Push final a GitHub `origin/main`**.
