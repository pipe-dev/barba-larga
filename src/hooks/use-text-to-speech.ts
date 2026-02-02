
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const isMounted = useRef(true);

  const updateVoices = useCallback(() => {
    if (synth) {
      const availableVoices = synth.getVoices().filter(voice => voice.lang.startsWith('es') && voice.lang !== 'es-ES');
      setVoices(availableVoices);
    }
  }, [synth]);

  useEffect(() => {
    isMounted.current = true;
    if (!synth) return;

    updateVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = updateVoices;
    }

    return () => {
      isMounted.current = false;
      if (synth) {
        synth.onvoiceschanged = null; // Clean up listener
        synth.cancel(); // Cancel any ongoing speech
      }
    };
  }, [synth, updateVoices]);

  const speak = useCallback((text: string) => {
    if (!synth || !isMounted.current) {
      console.error("Speech Synthesis no es soportado o el componente está desmontado.");
      return;
    }

    if (synth.speaking) {
      synth.cancel();
    }
    
    setTimeout(() => {
        if (!isMounted.current) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-MX';

        let selectedVoice: SpeechSynthesisVoice | undefined;

        if (voices.length > 0) {
            const priorityNames = ['Paulina', 'Juan', 'Google español de Estados Unidos'];
            selectedVoice = voices.find(voice => priorityNames.some(name => voice.name.includes(name)));

            if (!selectedVoice) {
                const latamCodes = ['es-MX', 'es-US', 'es-CO', 'es-AR'];
                selectedVoice = voices.find(voice => latamCodes.includes(voice.lang));
            }

            if (!selectedVoice) {
                selectedVoice = voices[0];
            }
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.rate = 1.15;
        utterance.pitch = 1.2;

        utterance.onstart = () => {
            if (isMounted.current) setIsSpeaking(true);
        };
        utterance.onend = () => {
            if (isMounted.current) setIsSpeaking(false);
        };
        utterance.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
               console.error("Error en la síntesis de voz:", e);
            }
            if (isMounted.current) setIsSpeaking(false);
        };

        synth.speak(utterance);
    }, 100);
  }, [synth, voices]);

  const cancel = useCallback(() => {
    if (synth) {
      synth.cancel();
      if (isMounted.current) setIsSpeaking(false);
    }
  }, [synth]);

  return { speak, cancel, isSpeaking, isReady: voices.length > 0 };
};
