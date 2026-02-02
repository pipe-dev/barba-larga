
"use client";

import { Button } from "@/components/ui/button";
import { useShaverSound } from "@/hooks/use-shaver-sound";

export function HeroSection() {
  const vimeoVideoUrl = "https://player.vimeo.com/video/1120402470?autoplay=1&loop=1&muted=1&background=1&autopause=0&badge=0&player_id=0&app_id=58479";
  const playShaverSound = useShaverSound();

  const handleScrollToBooking = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    playShaverSound();
    const bookingSection = document.getElementById("booking");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative h-[60vh] md:h-[70vh] w-full overflow-hidden bg-[#1c1411]">
      <div className="absolute top-0 left-0 w-full h-full">
        <iframe
          src={vimeoVideoUrl}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          className="absolute top-1/2 left-1/2 w-full h-full min-w-full min-h-full -translate-x-1/2 -translate-y-1/2 object-cover"
          title="Fondo de video de barbería"
        ></iframe>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div className="relative px-4 text-background-foreground">
          <h1 className="font-headline text-5xl md:text-7xl lg:text-8xl font-black text-white drop-shadow-lg">
            Estilo que Define
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-white/90 drop-shadow-md">
            Experimenta la maestría de la barbería elegante con un toque moderno. Tu look perfecto te espera.
          </p>
          <div className="mt-8">
            <Button size="lg" variant="3d" className="font-bold text-lg" onClick={handleScrollToBooking}>
                Reservar Cita
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
