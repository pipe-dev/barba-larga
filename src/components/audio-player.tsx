
"use client";

import * as React from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAudioStore } from "@/hooks/use-audio-store";

export function AudioPlayer() {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const { isInteracted } = useAudioStore();

  const playAudio = React.useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.paused) {
      audio.volume = 0.35;
      audio.play().catch(error => {
        console.log("Playback was prevented by the browser until user interaction.", error);
        setIsPlaying(false);
      });
    }
  }, []);
  
  React.useEffect(() => {
    if (isInteracted) {
      playAudio();
    }
  }, [isInteracted, playAudio]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        playAudio();
      }
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  return (
    <>
      <audio 
        ref={audioRef}
        src="/multimedia/ambiente.mp3"
        loop
        preload="auto"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handlePause}
        className="hidden" 
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
                onClick={togglePlay}
                className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-full p-2 md:p-3 hover:bg-white/10 transition-colors"
                aria-label={isPlaying ? "Pausar música" : "Reproducir música"}
            >
                {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 text-primary" /> : <Play className="w-4 h-4 md:w-5 md:h-5 text-white" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPlaying ? "Pausar música" : "Música de ambiente"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
