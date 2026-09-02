# Design Document: Server-First Booking Flow and WhatsApp Deferral

## Context & Problem Statement
Previously, the booking flow in `src/components/booking-section.tsx` opened a WhatsApp link directly in `onSubmit` before the server transaction executed or verified availability. When another client booked a dynamic or regular slot simultaneously (or if there was a collision for a 75-minute service), the client was redirected to WhatsApp believing the appointment was reserved, while the server rejected it.

## Architectural Design

### 1. Pre-Validation on Slot Click
When the user clicks a time slot button:
- A brief pre-validation runs against fresh availability data.
- If valid, the user proceeds to `fill-details`.
- If no longer valid (e.g. taken by another client in the last few seconds), a notification is shown, slots are refreshed from the DB, and the user remains on the slot selection step.

### 2. Elimination of Premature WhatsApp Redirection
- Remove client-side `window.open(waUrl)` from the `form.onSubmit` handler.
- The form action executes `bookAppointment` (Server Action).
- Server performs transactional overlap checking and commits the appointment to Firestore.
- Server constructs the official WhatsApp message and returns `{ success: true, whatsappUrl: string }`.

### 3. Server-Confirmed Success Transition
- If `state.success === true`:
  - Advance to `confirmed` step (`ConfirmationStep`).
  - Open or offer the official WhatsApp URL returned by the server.
- If `state.success === false`:
  - Show error toast with the server message.
  - Automatically re-fetch `getAvailableTimesForDate(date, barberId)` to clear stale dynamic and regular slots.
  - User remains on the page to pick a valid alternative.
