
'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPwaButton() {
  const [installPromptEvent, setInstallPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    // 1. Register the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => console.log('Service Worker registered with scope:', registration.scope))
        .catch((error) => console.error('Service Worker registration failed:', error));
    }

    // 2. Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      event.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setIsInstallable(true); // The app is installable, show the button
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (installPromptEvent) {
      // Show the install prompt
      installPromptEvent.prompt();
      // Wait for the user to respond to the prompt
      installPromptEvent.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        // The prompt can only be used once.
        setInstallPromptEvent(null);
        setIsInstallable(false); // Hide button after interaction
      });
    } else {
        // This case should ideally not be hit if the button is only visible when installable,
        // but it's a good fallback.
        toast({
            title: "Instalación no disponible",
            description: "Tu navegador o dispositivo no es compatible en este momento. Inténtalo de nuevo más tarde.",
            variant: "destructive",
        })
    }
  };

  if (!isInstallable) {
    return null; // Don't render the button if the app isn't installable
  }


  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleInstallClick}
            aria-label="Instalar aplicación"
          >
            <Download className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Instalar en tu dispositivo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
