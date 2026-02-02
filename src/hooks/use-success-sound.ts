"use client";

import { useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

export function useSuccessSound() {
  const synth = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    synth.current = new Tone.Synth({
        oscillator: {
            type: "sine"
        },
        envelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.3,
            release: 1
        }
    }).toDestination();
    
    return () => {
      synth.current?.dispose();
    };
  }, []);

  const playSound = useCallback(() => {
    if (Tone.context.state !== "running") {
      Tone.context.resume();
    }
    
    if (synth.current) {
      // A pleasant, bell-like chime
      const now = Tone.now();
      synth.current.triggerAttackRelease("C5", "8n", now);
      synth.current.triggerAttackRelease("G5", "8n", now + 0.2);
    }
  }, []);

  return playSound;
}
