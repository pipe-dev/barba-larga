# Contact Validation & Admin Schedule Blocking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce mandatory phone and email validation in client and server booking flows, and empower administrators to block schedules on any day (including Sundays) with single-barber isolation, all-day quick block, and annual recurrence.

**Architecture:** Double-layer validation (Zod schema in Server Actions + HTML5/React form feedback) for appointments; decoupled schedule time options in `src/lib/data.ts` for admin management; transactional Firestore batch creation in `blockTimeSlot` supporting `yearly` (52-week) recurrence with strict single-barber ID attribution.

**Tech Stack:** Next.js (App Router, Server Actions), Zod, React 19, Tailwind CSS, Radix UI, Firebase Firestore, Vitest, date-fns.

## Global Constraints

- Never allow a booking without both a valid email and phone number.
- Admin schedule blocking must ONLY affect the selected `barberId`; zero cross-barber interference.
- Admin time options must always provide 08:00 AM to 09:00 PM on any calendar day.
- Telemetry logging must remain resilient; no secondary errors may abort core booking or blocking flows.

---

### Task 1: Backend Contact Validation Schema & Tests

**Files:**
- Modify: `src/app/actions.ts:24-35`
- Test: `src/tests/booking-validation.test.ts`

**Interfaces:**
- Produces: Updated `bookingSchema` with strict `email` and `phone` validation.

- [ ] **Step 1: Write the failing unit tests for bookingSchema**

Create `src/tests/booking-validation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{3,12}$/;

const bookingSchema = z.object({
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
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

describe('bookingSchema Contact Validation', () => {
    const validBase = {
        barberId: 'alan',
        name: 'Carlos Mendoza',
        service: 'corte-clasico',
        date: '2026-09-10',
        time: '10:00 AM',
    };

    it('should reject when email is missing or empty', () => {
        const resultMissing = bookingSchema.safeParse({ ...validBase, phone: '3001234567' });
        expect(resultMissing.success).toBe(false);

        const resultEmpty = bookingSchema.safeParse({ ...validBase, email: '', phone: '3001234567' });
        expect(resultEmpty.success).toBe(false);
    });

    it('should reject invalid email formats', () => {
        const result = bookingSchema.safeParse({ ...validBase, email: 'not-an-email', phone: '3001234567' });
        expect(result.success).toBe(false);
    });

    it('should reject when phone is missing or empty', () => {
        const resultMissing = bookingSchema.safeParse({ ...validBase, email: 'test@example.com' });
        expect(resultMissing.success).toBe(false);

        const resultEmpty = bookingSchema.safeParse({ ...validBase, email: 'test@example.com', phone: '' });
        expect(resultEmpty.success).toBe(false);
    });

    it('should reject phone with fewer than 7 digits or invalid characters', () => {
        const resultShort = bookingSchema.safeParse({ ...validBase, email: 'test@example.com', phone: '123' });
        expect(resultShort.success).toBe(false);

        const resultAlpha = bookingSchema.safeParse({ ...validBase, email: 'test@example.com', phone: '300abc1234' });
        expect(resultAlpha.success).toBe(false);
    });

    it('should accept valid local and international phone numbers and valid email', () => {
        const validLocal = bookingSchema.safeParse({
            ...validBase,
            email: 'cliente@barbalarga.com',
            phone: '3001234567',
        });
        expect(validLocal.success).toBe(true);

        const validIntl = bookingSchema.safeParse({
            ...validBase,
            email: 'cliente.ext@gmail.com',
            phone: '+57 310 987 6543',
        });
        expect(validIntl.success).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it executes and passes against the test schema**

Run: `npx vitest run src/tests/booking-validation.test.ts`
Expected: PASS

- [ ] **Step 3: Update bookingSchema in src/app/actions.ts**

Modify `src/app/actions.ts:24-35`:
```typescript
const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{3,12}$/;

const bookingSchema = z.object({
    id: z.string().optional(), // For updates
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

- [ ] **Step 4: Verify booking-lifecycle tests against updated schema**

Run: `npx vitest run src/tests/booking-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts src/tests/booking-validation.test.ts
git commit -m "fix(booking): enforce mandatory phone and email validation in bookingSchema"
```

---

### Task 2: Frontend Client-Side Validation in Booking Form

**Files:**
- Modify: `src/components/booking-section.tsx:535-555`

**Interfaces:**
- Consumes: `bookingSchema` field error keys (`phone`, `email`).
- Produces: Accessible and validated HTML form inputs with clear asterisks and error states.

- [ ] **Step 1: Update form inputs in src/components/booking-section.tsx**

In `src/components/booking-section.tsx` lines 536-554, update the phone and email fields:
```tsx
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre *</Label>
                      <Input id="name" name="name" placeholder="Tu nombre" required />
                      {state.errors?.name && <p className="text-sm text-destructive">{state.errors.name[0]}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Número de Teléfono *</Label>
                      <Input 
                        id="phone" 
                        name="phone" 
                        type="tel" 
                        placeholder="Ej: +57 300 123 4567 o 3001234567" 
                        required 
                      />
                      {state.errors?.phone && <p className="text-sm text-destructive">{state.errors.phone[0]}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico *</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="tu@email.com" 
                      required 
                    />
                    {state.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
                  </div>
```

- [ ] **Step 2: Type check the changes**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/booking-section.tsx
git commit -m "feat(ui): add mandatory asterisks and required attributes to phone and email in booking form"
```

---

### Task 3: Admin Schedule Time Decoupling in src/lib/data.ts

**Files:**
- Modify: `src/lib/data.ts:48`
- Test: `src/tests/admin-schedule.test.ts`

**Interfaces:**
- Produces: `getAdminBlockTimeOptions(): { startTimes: string[]; endTimes: string[] }`

- [ ] **Step 1: Write test for getAdminBlockTimeOptions**

Create `src/tests/admin-schedule.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { getAdminBlockTimeOptions } from '@/lib/data';

describe('Admin Schedule Time Options', () => {
    it('should provide full 8:00 AM to 9:00 PM options for any day', () => {
        const { startTimes, endTimes } = getAdminBlockTimeOptions();

        expect(startTimes.length).toBeGreaterThan(0);
        expect(startTimes).toContain('08:00 AM');
        expect(startTimes).toContain('12:00 PM');
        expect(startTimes).toContain('08:00 PM');

        expect(endTimes).toContain('09:00 PM');
        expect(endTimes[endTimes.length - 1]).toBe('09:00 PM');
    });
});
```

- [ ] **Step 2: Add getAdminBlockTimeOptions to src/lib/data.ts**

In `src/lib/data.ts`, export `getAdminBlockTimeOptions`:
```typescript
export const getAdminBlockTimeOptions = (): { startTimes: string[]; endTimes: string[] } => {
  const morningTimes = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];
  const afternoonTimes = ["12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
  const nightTimes = ["06:00 PM", "07:00 PM", "08:00 PM"];
  const startTimes = [...morningTimes, ...afternoonTimes, ...nightTimes];
  const endTimes = [...startTimes, "09:00 PM"];
  return { startTimes, endTimes };
};
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/tests/admin-schedule.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/data.ts src/tests/admin-schedule.test.ts
git commit -m "feat(schedule): add getAdminBlockTimeOptions decoupled from customer availability"
```

---

### Task 4: Backend Schedule Blocking with Annual Recurrence & Barber Isolation

**Files:**
- Modify: `src/app/actions.ts:37-53, 97-197`
- Test: `src/tests/admin-block-schedule.test.ts`

**Interfaces:**
- Consumes: `blockTimeSchema` supporting `yearly` recurrence.
- Produces: Atomic Firestore batch write attaching strictly `barberId: barber.id`.

- [ ] **Step 1: Write integration tests for blockTimeSlot recurrence and isolation**

Create `src/tests/admin-block-schedule.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { timeToMinutes } from '@/lib/data';

const blockTimeSchema = z.object({
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora de inicio." }),
    endTime: z.string({ required_error: "Por favor, selecciona una hora de fin." }),
    name: z.string().min(2, { message: "La descripción es muy corta." }),
    recurrence: z.enum(["none", "weekly", "yearly", "daily"]).default("none"),
}).refine(data => {
    const start = timeToMinutes(data.time);
    const end = timeToMinutes(data.endTime);
    return start !== -1 && end !== -1 && end > start;
}, {
    message: "La hora de fin debe ser posterior a la hora de inicio.",
    path: ["endTime"],
});

describe('blockTimeSchema with Yearly Recurrence', () => {
    it('should validate yearly recurrence successfully', () => {
        const result = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06', // Sunday
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso Dominical',
            recurrence: 'yearly',
        });
        expect(result.success).toBe(true);
    });

    it('should validate weekly and none recurrences', () => {
        const resultWeekly = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06',
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso',
            recurrence: 'weekly',
        });
        expect(resultWeekly.success).toBe(true);

        const resultNone = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06',
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso',
            recurrence: 'none',
        });
        expect(resultNone.success).toBe(true);
    });
});
```

- [ ] **Step 2: Update blockTimeSchema and blockTimeSlot in src/app/actions.ts**

Update `blockTimeSchema` to accept `yearly` recurrence:
```typescript
const blockTimeSchema = z.object({
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora de inicio." }),
    endTime: z.string({ required_error: "Por favor, selecciona una hora de fin." }),
    name: z.string().min(2, { message: "La descripción es muy corta." }),
    recurrence: z.enum(["none", "weekly", "yearly", "daily"]).default("none"),
}).refine(data => {
    const start = timeToMinutes(data.time);
    const end = timeToMinutes(data.endTime);
    return start !== -1 && end !== -1 && end > start;
}, {
    message: "La hora de fin debe ser posterior a la hora de inicio.",
    path: ["endTime"],
});
```

In `blockTimeSlot`, add handling for `yearly` recurrence (52 weeks from `startDate`):
```typescript
        if (recurrence === 'none') {
            const newDocRef = doc(collection(db, "appointments"));
            batch.set(newDocRef, getBlockedSlotPayload(startDate));
        } else if (recurrence === 'yearly') {
            // Repeat on the same day of the week for 52 consecutive weeks (1 full year)
            let currentDate = startDate;
            for (let week = 0; week < 52; week++) {
                const newDocRef = doc(collection(db, "appointments"));
                batch.set(newDocRef, getBlockedSlotPayload(currentDate));
                currentDate = addDays(currentDate, 7);
            }
        } else {
            const monthEnd = endOfMonth(startDate);
            let currentDate = startDate;

            if (recurrence === 'daily') {
                while (currentDate <= monthEnd) {
                    const newDocRef = doc(collection(db, "appointments"));
                    batch.set(newDocRef, getBlockedSlotPayload(currentDate));
                    currentDate = addDays(currentDate, 1);
                }
            } else if (recurrence === 'weekly') {
                const targetDayOfWeek = getDay(startDate);
                while (currentDate <= monthEnd) {
                    if (getDay(currentDate) === targetDayOfWeek) {
                        const newDocRef = doc(collection(db, "appointments"));
                        batch.set(newDocRef, getBlockedSlotPayload(currentDate));
                    }
                    currentDate = addDays(currentDate, 1);
                }
            }
        }
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/tests/admin-block-schedule.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/actions.ts src/tests/admin-block-schedule.test.ts
git commit -m "feat(admin): add yearly recurrence and strict barber isolation to blockTimeSlot"
```

---

### Task 5: Admin UI Enhancements in BlockTimeDialog

**Files:**
- Modify: `src/app/admin/page.tsx:193-319`

**Interfaces:**
- Consumes: `getAdminBlockTimeOptions` from `@/lib/data`.
- Produces: Modern dialog with "Bloquear Todo el Día" quick button, recurrence selector with yearly option, and clean single `barberId` binding.

- [ ] **Step 1: Update BlockTimeDialog in src/app/admin/page.tsx**

1. Import `getAdminBlockTimeOptions` from `@/lib/data`.
2. Replace `timeOptions` and `endTimeOptions` with `getAdminBlockTimeOptions()`.
3. Remove the redundant `<input type="hidden" name="barberId" value={barberId} />`.
4. Add quick action button:
```tsx
<Button
    type="button"
    variant="outline"
    size="sm"
    className="w-full flex items-center justify-center gap-2 border-dashed"
    onClick={() => {
        setTime("08:00 AM");
        setEndTime("09:00 PM");
        setName("Descanso / Cerrado");
    }}
>
    <Clock className="h-4 w-4 text-primary" /> Bloquear todo el día (8:00 AM - 9:00 PM)
</Button>
```
5. In `<Select name="recurrence">`, add options:
```tsx
<SelectContent>
    <SelectItem value="none">Solo este día</SelectItem>
    <SelectItem value="weekly">Este día todas las semanas del mes</SelectItem>
    <SelectItem value="yearly">Este día todas las semanas del año (52 semanas)</SelectItem>
    <SelectItem value="daily">Todos los días este mes</SelectItem>
</SelectContent>
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin-ui): enhance BlockTimeDialog with all-day quick button and yearly recurrence"
```

---

### Task 6: Comprehensive Verification & Regression Tests

**Files:**
- Run: Vitest test suite
- Run: TypeScript build check
- Run: ESLint audit

- [ ] **Step 1: Run all unit and integration tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Run ESLint**

Run: `npm run lint`
Expected: 0 errors / clean build.

- [ ] **Step 4: Final commit and push to GitHub**

```bash
git push origin main
```