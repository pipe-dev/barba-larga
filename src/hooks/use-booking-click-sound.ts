
"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

export function useBookingClickSound() {
  const synth = useRef<Tone.MembraneSynth | null>(null);

  useEffect(() => {
    // Initialize the synth only once
    synth.current = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 2,
        envelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0.01,
            release: 0.1,
            attackCurve: "exponential"
        }
    }).toDestination();
    
    // Cleanup on unmount
    return () => {
      synth.current?.dispose();
    };
  }, []);

  const playSound = useCallback(() => {
    // Ensure Tone.js context is running (starts on first user interaction)
    if (Tone.context.state !== "running") {
      Tone.context.resume();
    }
    
    if (synth.current) {
      // A short, sharp "click" or "snip" like sound
      synth.current.triggerAttackRelease("C4", "32n");
    }
  }, []);

  return playSound;
}
