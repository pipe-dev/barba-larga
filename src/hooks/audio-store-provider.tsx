"use client";

import { useEffect } from "react";
import { useAudioStore, initializeAudioStore } from "@/hooks/use-audio-store";

// This wrapper ensures the Zustand store is initialized on the client side for Next.js App Router.
export function AudioStoreProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        initializeAudioStore();
    }, []);
    
    return <>{children}</>;
}
