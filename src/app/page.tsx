

"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { cn } from "@/lib/utils";
import { Play, Pause, Loader2, Scissors, Sparkles, LogOut } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { AboutSection } from "@/components/about-section";
import { TeamSection } from "@/components/team-section";
import { ServiceCatalog } from "@/components/service-catalog";
import { BookingSection } from "@/components/booking-section";
import { StyleAdvisorSection } from "@/components/style-advisor-section";
import { LocationSection } from "@/components/location-section";
import { ContactSection } from "@/components/contact-section";

import { BottomNav } from "@/components/bottom-nav";
import { AudioPlayer } from "@/components/audio-player";
import { getNotifications, type Notification as NotificationType } from "@/app/actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';

const LeftSidebar = ({ onNavigate }: { onNavigate: (scene: Scene) => void }) => (
  <aside className="absolute top-24 left-6 z-20 space-y-4 animate-fade-in-left">
    <div>
      <h1 className="font-headline text-[2.6rem] md:text-6xl font-bold tracking-wider text-white flex flex-col leading-none">
        <span>BARBA</span>
        <span>LARGA</span>
      </h1>
    </div>
    <nav className="flex flex-col space-y-3">
      <button onClick={() => onNavigate('team')} className="thick-glass-button animate-pulse-glow-cyan w-[9.5rem] text-left">
        <div className="thick-glass-button-inner">
          <div className="thick-glass-button-content !py-2 !text-base justify-start px-4">
            <span>Agendar cita</span>
          </div>
        </div>
      </button>
      <button className="glass-button w-28 text-left" onClick={() => onNavigate('services')}>Servicios</button>
      <button className="glass-button w-28 text-left" onClick={() => onNavigate('ai-advisor')}>Asesor IA</button>
    </nav>
    <div className="text-white relative pt-4">
      <p className="w-40">Popayán, Colombia</p>
      <div className="relative w-[100px] h-[60px] mt-2">
        <Image
          src="/multimedia/Ubicación.png"
          alt="Ubicación"
          width={100}
          height={60}
          className="animate-spin"
        />
        <div className="absolute top-[43px] left-[40px] w-3 h-3 rounded-full bg-red-500 animate-pulse-glow-red"></div>
      </div>
    </div>
  </aside>
);

const Notifications = ({ notifications, isLoading }: { notifications: NotificationType[], isLoading: boolean }) => {
  const plugin = React.useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true })
  );

  if (isLoading) {
    return (
      <div className="glass-card p-4 h-24 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/70" />
      </div>
    )
  }

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full"
      opts={{
        loop: true,
      }}
    >
      <CarouselContent>
        {notifications.map((notification, index) => (
          <CarouselItem key={index}>
            <div className="glass-card p-4">
              <p className="text-sm font-bold">{notification.title}</p>
              <p className="text-xs">{notification.description}</p>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};

const ClockAndMusic = () => {
  const [time, setTime] = useState("");
  const [seconds, setSeconds] = useState("");
  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: "America/Bogota",
        hour12: !isMobile, // Use 24-hour format on mobile
        hour: '2-digit',
        minute: '2-digit',
      };

      const bogotaTime = now.toLocaleTimeString("en-US", timeOptions);
      const bogotaSeconds = now.toLocaleTimeString("en-US", {
        timeZone: "America/Bogota",
        second: '2-digit',
      });
      setTime(bogotaTime.replace(isMobile ? '' : ' ', '')); // Remove space before AM/PM on desktop
      setSeconds(bogotaSeconds);
    }, 1000);
    return () => clearInterval(timer);
  }, [isMobile]);

  return (
    <div className="glass-card p-4 flex flex-col items-center justify-center">
      <div className="text-center">
        <p className="font-headline text-3xl md:text-4xl font-bold text-white">{time}</p>
        <p className="text-xs text-gray-400 -mt-1">{seconds} seg</p>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <AudioPlayer />
      </div>
    </div>
  );
};

const RightSidebar = ({ notifications, isLoading }: { notifications: NotificationType[], isLoading: boolean }) => {

  const plugin = React.useRef(
    Autoplay({ delay: 2000, stopOnInteraction: false })
  );

  return (
    <aside className="absolute top-10 right-6 z-10 space-y-4 w-[140px] md:w-[200px] animate-fade-in-right">
      <Carousel
        plugins={[plugin.current]}
        className="w-full"
        opts={{
          loop: true,
        }}
      >
        <CarouselContent>
          <CarouselItem>
            <div>
              <div className="glass-card flex items-center justify-center">
                <video
                  src={"/multimedia/keratina-mujer.mp4"}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-xl aspect-square"
                >
                  Tu navegador no soporta el tag de video.
                </video>
              </div>
            </div>
          </CarouselItem>
          <CarouselItem>
            <div>
              <div className="glass-card flex items-center justify-center">
                <Image
                  src={"/multimedia/corte-autoridad.jpg"}
                  alt={"Corte de Autoridad"}
                  width={150}
                  height={150}
                  className="w-full h-full object-cover rounded-xl aspect-square"
                />
              </div>
            </div>
          </CarouselItem>
        </CarouselContent>
      </Carousel>
      <Notifications notifications={notifications} isLoading={isLoading} />
      <ClockAndMusic />
    </aside>
  );
};


const SCENE_HASH_MAP: Record<Scene, string> = {
  home: 'inicio',
  services: 'servicios',
  team: 'equipo',
  booking: 'agendar',
  'ai-advisor': 'asesor-ia',
  about: 'nosotros',
  location: 'ubicacion',
  contact: 'contacto',
};

const HASH_SCENE_MAP: Record<string, Scene> = {
  '': 'home',
  inicio: 'home',
  home: 'home',
  servicios: 'services',
  services: 'services',
  equipo: 'team',
  team: 'team',
  barberos: 'team',
  agendar: 'booking',
  booking: 'booking',
  reservar: 'booking',
  citas: 'booking',
  'asesor-ia': 'ai-advisor',
  'ai-advisor': 'ai-advisor',
  asesor: 'ai-advisor',
  nosotros: 'about',
  about: 'about',
  ubicacion: 'location',
  location: 'location',
  contacto: 'contact',
  contact: 'contact',
};

function getSceneFromHash(): Scene {
  if (typeof window === 'undefined') return 'home';
  const rawHash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
  return HASH_SCENE_MAP[rawHash] || 'home';
}

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeScene, setActiveScene] = useState<Scene>('home');
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const currentSceneRef = useRef<Scene>('home');
  const allowExitRef = useRef<boolean>(false);

  // Keep ref synchronized with state
  useEffect(() => {
    currentSceneRef.current = activeScene;
  }, [activeScene]);

  useEffect(() => {
    setIsLoaded(true);
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        if (error.name !== 'AbortError') {
          console.error("Error al intentar reproducir el video:", error);
        }
      });
    }

    // Initialize scene from URL hash on load
    const initialScene = getSceneFromHash();
    if (initialScene !== 'home') {
      setActiveScene(initialScene);
      currentSceneRef.current = initialScene;
    } else if (typeof window !== 'undefined') {
      // Set baseline state in history for the root home page
      window.history.replaceState({ scene: 'home' }, '', window.location.pathname);
    }

    // Handle browser back and forward buttons
    const handlePopState = (event: PopStateEvent) => {
      const prevScene = currentSceneRef.current;
      const sceneFromState = event.state?.scene as Scene | undefined;
      const nextScene = sceneFromState || getSceneFromHash();

      // If user was ALREADY on the home scene and tries to back out of the site:
      if (prevScene === 'home' && (nextScene === 'home' || !sceneFromState)) {
        if (!allowExitRef.current) {
          // Push baseline back to prevent leaving immediately
          window.history.pushState({ scene: 'home' }, '', window.location.pathname);
          setIsExitModalOpen(true);
          return;
        }
      }

      setActiveScene(nextScene);
      currentSceneRef.current = nextScene;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);

    async function loadNotifications() {
      setIsLoadingNotifications(true);
      try {
        const fetchedNotifications = await getNotifications();
        setNotifications(fetchedNotifications as NotificationType[]);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoadingNotifications(false);
      }
    }
    loadNotifications();

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (scene: Scene, replace: boolean = false) => {
    setActiveScene(scene);
    currentSceneRef.current = scene;
    const hashTag = SCENE_HASH_MAP[scene] || scene;
    const newUrl = scene === 'home' ? window.location.pathname : `#${hashTag}`;

    if (typeof window !== 'undefined') {
      const currentHash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
      if (replace) {
        window.history.replaceState({ scene }, '', newUrl);
      } else if (currentHash !== hashTag && !(scene === 'home' && !currentHash)) {
        window.history.pushState({ scene }, '', newUrl);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmExit = () => {
    setIsExitModalOpen(false);
    allowExitRef.current = true;
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.go(-2);
      } else {
        window.close();
      }
    }
  };

  const handleCancelExit = () => {
    setIsExitModalOpen(false);
  };

  const HeroScene = () => (
    <div id="inicio" className="relative h-screen w-screen">
      <TopNav activeScene={activeScene} onNavigate={handleNavigate} />
      <div className="absolute inset-0 bg-black">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className={cn("w-full h-full object-cover transition-opacity duration-1000", isLoaded ? "opacity-40" : "opacity-0")}
        >
          <source src="/multimedia/Background-logo.mp4" type="video/mp4" />
        </video>
      </div>
      <LeftSidebar onNavigate={handleNavigate} />
      <RightSidebar notifications={notifications} isLoading={isLoadingNotifications} />
    </div>
  );

  return (
    <div className="font-sans min-h-screen w-full overflow-x-hidden bg-background relative">

      {activeScene === 'home' ? (
        <HeroScene />
      ) : (
        <>
          <TopNav activeScene={activeScene} onNavigate={handleNavigate} />
          <main className="pt-24 pb-28"> {/* Padding to avoid overlap with navbars */}
            <div className="container px-4 md:px-6 max-w-7xl mx-auto">
              {activeScene === 'about' && (
                <section id="nosotros">
                  <AboutSection />
                </section>
              )}
              {activeScene === 'team' && (
                <section id="equipo">
                  <TeamSection onNavigate={handleNavigate} />
                </section>
              )}
              {activeScene === 'services' && (
                <section id="servicios">
                  <ServiceCatalog onNavigate={handleNavigate} />
                </section>
              )}
              {activeScene === 'booking' && (
                <section id="agendar">
                  <BookingSection onNavigate={handleNavigate} />
                </section>
              )}
              {activeScene === 'ai-advisor' && (
                <section id="asesor-ia">
                  <StyleAdvisorSection onNavigate={handleNavigate} />
                </section>
              )}
              {activeScene === 'location' && (
                <section id="ubicacion">
                  <LocationSection />
                </section>
              )}
              {activeScene === 'contact' && (
                <section id="contacto">
                  <ContactSection />
                </section>
              )}
            </div>
          </main>
        </>
      )}

      <BottomNav
        activeScene={activeScene}
        onNavigate={handleNavigate}
      />

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={isExitModalOpen} onOpenChange={setIsExitModalOpen}>
        <AlertDialogContent className="bg-neutral-950/95 border border-primary/20 text-white backdrop-blur-2xl max-w-md mx-auto p-6 md:p-8 rounded-2xl shadow-2xl shadow-primary/5">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-4 animate-pulse-glow-cyan">
              <Scissors className="w-7 h-7" />
            </div>
            <AlertDialogHeader className="space-y-2">
              <AlertDialogTitle className="text-2xl font-headline font-bold text-center tracking-wide text-white">
                ¿Ya te vas? ¡Tu estilo te espera! 💈
              </AlertDialogTitle>
              <AlertDialogDescription className="text-neutral-300 text-center text-sm leading-relaxed">
                Estás a un paso de renovar tu look con los mejores barberos de Popayán. ¿Deseas quedarte para explorar los servicios o agendar tu cita?
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
            <AlertDialogAction
              onClick={handleConfirmExit}
              className="sm:w-1/3 bg-transparent hover:bg-white/10 text-neutral-400 hover:text-white border border-white/10 transition-colors py-2.5 font-normal text-sm"
            >
              <LogOut className="w-4 h-4 mr-1.5 opacity-70" />
              Salir
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={handleCancelExit}
              className="sm:w-2/3 bg-primary text-black hover:bg-primary/90 font-bold shadow-lg shadow-primary/25 border-none transition-all py-2.5 text-sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Quedarme y Explorar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
