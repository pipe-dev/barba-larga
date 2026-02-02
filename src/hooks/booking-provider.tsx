"use client";

import { useBooking } from "@/hooks/use-booking";

// This is a simple wrapper to make Zustand work in Next.js App Router.
// It ensures the store is initialized on the client side.
export function BookingProvider({ children }: { children: React.ReactNode }) {
    useBooking();
    return <>{children}</>;
}
