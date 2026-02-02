
"use client";

import { useEffect, useRef, useCallback } from "react";

// This hook preloads and plays a scissors sound effect.
// Place your sound file at /public/multimedia/scissors.mp3
export function useScissorsSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize the Audio object only on the client side
    const audio = new Audio('/multimedia/scissors.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
        // Stop any previous playback and play from the start
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(error => {
            console.error("Error playing scissors sound:", error);
        });
    }
  }, []);

  return playSound;
}
