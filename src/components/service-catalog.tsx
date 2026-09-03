
"use client";

import * as React from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Service } from "@/lib/data";
import { getServicesFromDB } from "@/app/actions/services";
import Autoplay from "embla-carousel-autoplay";
import { useBooking } from "@/hooks/use-booking";
import { cn } from "@/lib/utils";
import { useScissorsSound } from "@/hooks/use-scissors-sound";
import { Check, ArrowLeft, ArrowRight, Clock, Loader2, Sparkles, Scissors, Droplets, PencilRuler, User } from "lucide-react";
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { getSafeImageUrl } from "@/lib/image-validation";

type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';

// --- MAPA DE IMÁGENES OFICIALES PARA LOS 7 SERVICIOS ---
const officialServiceImages: Record<string, string> = {
  "haircut": "https://i.ibb.co/Ps2YzTHZ/corte-autoridad.webp",
  "haircut-eyebrows": "https://i.ibb.co/1YCyX60S/haircut-eyebrows.png",
  "haircut-beard": "https://i.ibb.co/j9zYsTHH/experiencia-dominante.jpg",
  "haircut-design": "https://i.ibb.co/PGKgQDLH/corte-dise-o-cejas.jpg",
  "haircut-facial-mask": "https://i.ibb.co/TD9mLsWr/rostro-impecable.png",
  "beard-combo": "https://i.ibb.co/21fHYQfG/barba.png",
  "eyebrows": "https://i.ibb.co/1YCyX60S/haircut-eyebrows.png",
};

// --- MAPA DE ICONOS ---
const getServiceIcon = (id: string, iconName?: string) => {
  if (id === "haircut-facial-mask") return Droplets;
  if (id === "haircut-design" || id === "eyebrows") return PencilRuler;
  if (id === "beard-combo") return User;
  if (id === "haircut-beard") return Sparkles;
  return Scissors;
};

// --- TARJETA DE SERVICIO CON DISEÑO GLASS CARD EFFECT EXACTO ---
const ServiceCard = ({
  service,
  isSelected,
  isFeatured,
  onToggle,
}: {
  service: Service;
  isSelected: boolean;
  isFeatured: boolean;
  onToggle: (id: string) => void;
}) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const perspectiveWrapperRef = React.useRef<HTMLDivElement>(null);

  // Imagen del servicio con fallback a la ruta oficial
  const imageSrc = service.mediaUrl || officialServiceImages[service.id] || "https://i.ibb.co/Ps2YzTHZ/corte-autoridad.webp";
  const isVariablePrice = service.name?.toLowerCase().includes('keratina') || service.name?.toLowerCase().includes('coloración');

  // Animación 3D Parallax interactiva con GSAP
  useGSAP(() => {
    if (!perspectiveWrapperRef.current) return;
    const card = cardRef.current;
    const wrapper = perspectiveWrapperRef.current;

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = wrapper.getBoundingClientRect();
      const x = (clientX - left - width / 2) / 20;
      const y = (clientY - top - height / 2) / 20;

      gsap.to(card, {
        rotationY: x,
        rotationX: -y,
        ease: 'power2.out',
        duration: 0.5,
      });
    };

    const onMouseLeave = () => {
      gsap.to(card, {
        rotationY: 0,
        rotationX: 0,
        ease: 'power3.out',
        duration: 0.6,
      });
    };

    wrapper.addEventListener('mousemove', onMouseMove);
    wrapper.addEventListener('mouseleave', onMouseLeave);

    return () => {
      wrapper.removeEventListener('mousemove', onMouseMove);
      wrapper.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div
      ref={perspectiveWrapperRef}
      className={cn(
        "relative p-1 h-[380px] w-full transition-transform duration-300",
        isFeatured && 'animate-bounce-twice'
      )}
      style={{ perspective: '1200px' }}
    >
      <div
        ref={cardRef}
        className={cn(
          "glass-card-effect overflow-hidden h-full w-full transform-style-preserve-3d",
          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-black"
        )}
      >
        <div className="card-face card-face-front">
          <div className="flex flex-col items-center justify-end p-0 relative h-full">
            <div className="absolute inset-0 z-0">
              <Image
                src={getSafeImageUrl(imageSrc)}
                alt={service.name}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500 ease-in-out"
                priority={isFeatured}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = officialServiceImages[service.id] || "https://i.ibb.co/Ps2YzTHZ/corte-autoridad.webp";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
            </div>

            <div className="relative z-10 flex flex-col items-center justify-end h-full w-full p-6 text-center text-white">
              <h3 className="text-xl font-bold mb-1">{service.name}</h3>
              <p className="text-xs text-white/80 mb-3 min-h-[3rem] line-clamp-2">
                {service.description}
              </p>
              <div className="flex items-center justify-center gap-4 text-muted-foreground font-semibold">
                <span className="text-xl font-black text-white">
                  {isVariablePrice && 'Desde '}${parseInt(service.price?.toString().replace(/\D/g, '') || "0", 10).toLocaleString('es-CO')}
                </span>
                <div className="flex items-center gap-1 text-sm text-white/80">
                  <Clock className="h-4 w-4" />
                  <span>{service.duration} min</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggle(service.id)}
                className={cn(
                  "liquid-glass-button mt-3 w-full !py-2.5 text-sm",
                  isSelected && "phone"
                )}
              >
                {isSelected ? (
                  <span className="flex items-center justify-center">
                    <Check className="mr-2 h-4 w-4" /> Elegido
                  </span>
                ) : (
                  "Elegir"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function ServiceCatalog({
  serviceId,
  onNavigate,
}: {
  serviceId?: string;
  onNavigate: (scene: Scene) => void;
}) {
  const plugin = React.useRef(Autoplay({ delay: 3500, stopOnInteraction: true }));
  const { selectedServices, toggleService, selectedBarberId } = useBooking();
  const playScissorsSound = useScissorsSound();
  const [api, setApi] = React.useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [dbServices, setDbServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Cargar 100% de la información desde Firestore
  React.useEffect(() => {
    let isMounted = true;
    getServicesFromDB()
      .then((data) => {
        if (isMounted) {
          setDbServices(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error al cargar servicios desde Firestore:", err);
        if (isMounted) {
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const services = React.useMemo(() => {
    if (!serviceId) return dbServices;
    const selected = dbServices.find((s) => s.id === serviceId);
    return selected ? [selected, ...dbServices.filter((s) => s.id !== serviceId)] : dbServices;
  }, [serviceId, dbServices]);

  const handleToggleService = (id: string) => {
    toggleService(id);
    playScissorsSound();

    setTimeout(() => {
      const hasServices = !selectedServices.includes(id) || selectedServices.length > 1;
      if (hasServices && !selectedBarberId) {
        onNavigate("team");
      } else if (hasServices && selectedBarberId) {
        onNavigate("booking");
      }
    }, 800);
  };

  const containerRef = React.useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (loading) return;
      gsap.fromTo(
        ".carousel-item-service",
        { opacity: 0, scale: 0.9, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.12,
          delay: 0.2,
        }
      );
    },
    { scope: containerRef, dependencies: [loading] }
  );

  React.useEffect(() => {
    if (!api) return;

    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());

    const onSelect = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <section ref={containerRef} id="services" className="pt-0 pb-12 md:pb-24">
      <div className="flex flex-col items-center text-center">
        <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-white">
          SERVICIOS
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-[380px] gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando servicios...</p>
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/20 rounded-2xl p-8">
          <p className="text-muted-foreground text-lg">No hay servicios disponibles en la base de datos.</p>
        </div>
      ) : (
        <div className="relative mt-8">
          <Carousel
            setApi={setApi}
            plugins={[plugin.current]}
            className="w-full"
            opts={{ align: "start", loop: services.length > 2 }}
          >
            <CarouselContent className="-ml-4">
              {services.map((service, index) => {
                const isSelected = selectedServices.includes(service.id);
                const isFeatured = service.id === serviceId && index === 0;

                return (
                  <CarouselItem
                    key={service.id}
                    className="carousel-item-service md:basis-1/2 lg:basis-1/3 pl-4"
                  >
                    <ServiceCard
                      service={service}
                      isSelected={isSelected}
                      isFeatured={isFeatured}
                      onToggle={handleToggleService}
                    />
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>

          {services.length > 3 && (
            <>
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                disabled={!canScrollPrev}
                className="carousel-arrow left-2 md:left-4 focus:outline-none transition-transform duration-300 ease-in-out hover:scale-110"
                aria-label="Servicio anterior"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                disabled={!canScrollNext}
                className="carousel-arrow right-2 md:right-4 focus:outline-none transition-transform duration-300 ease-in-out hover:scale-110"
                aria-label="Servicio siguiente"
              >
                <ArrowRight className="h-5 w-5 text-white" />
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
