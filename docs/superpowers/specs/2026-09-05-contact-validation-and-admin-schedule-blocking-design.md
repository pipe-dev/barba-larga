# Especificación de Diseño: Validación Estricta de Contacto y Bloqueo Preciso de Agenda en Admin

**Fecha**: 2026-09-05  
**Estado**: Validado con el usuario / Pendiente de Plan de Implementación  
**Autor**: Antigravity & Equipo de Barbería Barba Larga  

---

## 1. Contexto y Objetivos

### 1.1 Problemas Actuales
1. **Falta de Validación Obligatoria de Teléfono y Correo**:
   - En el cliente y en el backend (`bookingSchema`), el campo de teléfono era opcional y el correo permitía cadenas vacías (`.optional().or(z.literal(""))`).
   - Clientes podían agendar citas sin suministrar número telefónico ni email, impidiendo el envío de confirmaciones y dejando citas huérfanas sin datos de contacto.
2. **Imposibilidad de Bloquear Domingos y Horarios en el Admin**:
   - El diálogo de bloqueo de horarios del Admin (`BlockTimeDialog`) consumía la función `getBaseAvailableTimes(watchDate)`, la cual devolvía un array vacío `[]` para los domingos (`day === 0`).
   - Por esta razón, al seleccionar un domingo en el Admin, los selectores de *"Hora de Inicio"* y *"Hora de Fin"* quedaban completamente en blanco, imposibilitando guardar cualquier bloqueo dominical.
   - Existía un campo oculto `<input type="hidden" name="barberId" />` duplicado con el selector de Radix UI, enviando valores inconsistentes al servidor y generando errores esporádicos de validación.
   - No existía un botón rápido de "Bloquear todo el día" ni opciones para proyectar bloqueos recurrentes para todo el año.

### 1.2 Objetivos de la Solución
1. Exigir **teléfono** (7-15 dígitos numéricos, compatible con números nacionales e internacionales) y **correo electrónico** válidos de forma obligatoria en cliente y servidor antes de cualquier creación de cita.
2. Desacoplar las opciones de horarios del Admin para que siempre muestre la franja operativa completa (**08:00 AM a 09:00 PM**) en cualquier fecha del año (incluyendo domingos).
3. Garantizar el **aislamiento estricto por barbero**: todo bloqueo se asigna única y exclusivamente al `barberId` seleccionado, sin afectar bajo ninguna circunstancia a los demás colaboradores.
4. Agregar en el modal de bloqueo:
   - Botón de 1 clic: **"Bloquear Día Completo"** (configura automáticamente 08:00 AM a 09:00 PM con descripción "Descanso").
   - Selector de recurrencia avanzado: **Solo este día**, **Todos los [días de la semana] de este mes**, y **Todos los [días de la semana] de todo el año (próximos 12 meses)**.

---

## 2. Arquitectura y Componentes

### 2.1 Validación de Contacto en Reserva (Doble Capa)

#### Backend: `src/app/actions.ts` (`bookingSchema`)
```typescript
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-s.]?[0-9]{3,12}$/;

const bookingSchema = z.object({
  id: z.string().optional(),
  barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
  name: z.string()
    .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
    .regex(/^[a-zA-Z\u00C0-\u017F\s'-]+$/, { message: "El nombre solo puede contener letras, espacios y guiones." }),
  email: z.string({ required_error: "El correo electrónico es obligatorio." })
    .email({ message: "Por favor, introduce un correo electrónico válido." }),
  phone: z.string({ required_error: "El número de teléfono es obligatorio." })
    .min(7, { message: "El número de teléfono debe tener al menos 7 dígitos." })
    .max(15, { message: "El número de teléfono no puede exceder 15 dígitos." })
    .regex(phoneRegex, { message: "Introduce un número de teléfono válido (ej: +57 300 123 4567 o 3001234567)." }),
  service: z.string().min(1, { message: "Por favor, selecciona al menos un servicio." }),
  date: z.string({ required_error: "Por favor, selecciona una fecha." }),
  time: z.string({ required_error: "Por favor, selecciona una hora." }),
});
```

#### Frontend: `src/components/booking-section.tsx`
- Inputs en el paso `fill-details`:
  - `<Input id="phone" name="phone" type="tel" required placeholder="Ej: +57 300 123 4567" />`
  - `<Input id="email" name="email" type="email" required placeholder="tu@email.com" />`
- Etiquetas con asterisco visible de obligatoriedad: `Número de Teléfono *` y `Correo Electrónico *`.
- Visualización de mensajes de error devueltos por `state.errors.phone` y `state.errors.email`.

---

### 2.2 Bloqueo de Horarios en Admin (`BlockTimeDialog` & `blockTimeSlot`)

#### Desacoplamiento de Horas en Admin (`src/lib/data.ts`)
Crear una función utilitaria específica para administradores que no filtre domingos:
```typescript
export const getAdminBlockTimeOptions = (): { startTimes: string[]; endTimes: string[] } => {
  const morning = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];
  const afternoon = ["12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
  const night = ["06:00 PM", "07:00 PM", "08:00 PM"];
  const startTimes = [...morning, ...afternoon, ...night];
  const endTimes = [...startTimes, "09:00 PM"];
  return { startTimes, endTimes };
};
```
Esto asegura que el selector en el Admin siempre cuente con opciones válidas de 8am a 9pm independientemente del día seleccionado.

#### Limpieza del Formulario en `BlockTimeDialog` (`src/app/admin/page.tsx`)
- Eliminar el `<input type="hidden" name="barberId" />` sobrante.
- Mantener un único control de barbero vinculado a la selección del usuario.
- Incorporar botón **"Bloquear Día Completo"**:
  - Al hacer clic: establece `time = "08:00 AM"`, `endTime = "09:00 PM"`, `name = "Descanso / Cerrado"`.

#### Recurrencia por Año y Aislamiento por Barbero (`src/app/actions.ts`)
Actualizar `blockTimeSchema` para soportar recurrencia anual:
```typescript
const blockTimeSchema = z.object({
  barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
  date: z.string({ required_error: "Por favor, selecciona una fecha." }),
  time: z.string({ required_error: "Por favor, selecciona una hora de inicio." }),
  endTime: z.string({ required_error: "Por favor, selecciona una hora de fin." }),
  name: z.string().min(2, { message: "La descripción es muy corta." }),
  recurrence: z.enum(["none", "weekly", "yearly", "daily"]).default("none"),
});
```

#### Manejo del Batch de Firestore y Verificación de Aislamiento:
1. **Aislamiento Estricto**:
   - Cada documento creado en la colección `appointments` lleva:
     ```typescript
     {
       barberId: barber.id, // ID exacto y validado del barbero seleccionado
       type: 'blocked',
       date: formattedDate,
       time,
       endTime,
       name,
       status: 'pending',
       createdAt: new Date(),
     }
     ```
   - Ningún otro barbero es modificado o consultado.
2. **Cálculo de Fechas para `yearly`**:
   - Se toma la fecha base (`startDate`).
   - Se itera sumando 7 días (`addDays(currentDate, 7)`) durante 52 semanas (1 año hacia adelante).
   - Firestore admite hasta 500 escrituras por `writeBatch`. 52 semanas representan exactamente 52 documentos, ejecutándose de forma atómica en un único batch sin saturar cuotas.

---

## 3. Plan de Verificación y Pruebas Automatizadas

1. **Pruebas Unitarias de Validación (`Vitest`)**:
   - Intentar reservar cita sin teléfono ➡️ Rechazo esperado con error de validación.
   - Intentar reservar cita sin correo o con correo inválido ➡️ Rechazo esperado.
   - Reservar con teléfono y correo válidos ➡️ Aceptación del esquema.
2. **Pruebas de Bloqueo en Domingo y Aislamiento (`Vitest`)**:
   - Bloquear un domingo para el barbero A.
   - Verificar que el barbero A tiene el domingo bloqueado en `getAvailableTimesForDate`.
   - Verificar que el barbero B **NO** tiene ningún bloqueo en ese domingo (aislamiento 100% confirmado).
   - Probar la recurrencia `yearly` y confirmar que se generan los 52 domingos para ese barbero.
3. **Verificación de Compilación y Calidad**:
   - Ejecutar `npx tsc --noEmit` (cero errores de TypeScript).
   - Ejecutar `npm run lint`.

---

## 4. Revisión y Aprobación del Usuario
Este diseño cumple estrictamente con el enfoque aprobado y con la regla de oro: **un bloqueo solo y exclusivamente afecta al barbero seleccionado**.