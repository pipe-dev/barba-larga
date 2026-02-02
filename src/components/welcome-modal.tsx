
"use client";

import * as React from "react";
import { useAudioStore } from "@/hooks/use-audio-store";
import { Button } from "@/components/ui/button";

const BarberPoleIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin-slow"
    >
      <path d="M4 2v20" />
      <path d="M20 2v20" />
      <path d="M4 7h16" stroke="hsl(var(--accent))" />
      <path d="M4 12h16" />
      <path d="M4 17h16" stroke="hsl(var(--accent))" />
      <path d="M12 2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2Z" fill="hsl(var(--primary))" stroke="none" />
      <path d="M12 18a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2Z" fill="hsl(var(--primary))" stroke="none" />
    </svg>
);


export function WelcomeModal() {
  const { welcomeModalDismissed, setWelcomeModalDismissed, setInteracted } = useAudioStore();
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    // This ensures the modal state is only evaluated on the client
    const dismissed = !!localStorage.getItem('welcomeModalDismissed');
    if (!dismissed) {
        setIsVisible(true);
    }
  }, []);

  const handleEnter = () => {
    setInteracted();
    setWelcomeModalDismissed();
    setIsVisible(false);
  };
  
  if (!isVisible || welcomeModalDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in-0 duration-500">
      <div className="text-center p-8 max-w-md mx-auto">
        <div className="flex justify-center mb-6">
            <BarberPoleIcon />
        </div>
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-foreground">
            Bienvenido a Barba Larga
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
            Estás a punto de entrar en una experiencia de estilo superior.
        </p>
        <Button onClick={handleEnter} variant="3d" size="lg" className="mt-8">
            Entrar
        </Button>
      </div>
       <style jsx>{`
        @keyframes spin-slow {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }
        .animate-spin-slow {
            animation: spin-slow 10s linear infinite;
        }
    `}</style>
    </div>
  );
}
