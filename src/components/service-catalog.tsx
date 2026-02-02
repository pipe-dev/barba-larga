
"use client";

import * as React from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { services as defaultServices, Service } from "@/lib/data";
import Autoplay from "embla-carousel-autoplay";
import { useBooking } from "@/hooks/use-booking";
import { cn } from "@/lib/utils";
import { useScissorsSound } from "@/hooks/use-scissors-sound";
import { Check, ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';

// --- TARJETA DE SERVICIO CON PARALLAX Y ESTILO FERRARI ---
const ServiceCard = ({ service, isSelected, isFeatured, onToggle }: { service: Service, isSelected: boolean, isFeatured: boolean, onToggle: (id: string) => void }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const perspectiveWrapperRef = React.useRef<HTMLDivElement>(null);

  // Animación 3D Parallax con GSAP
  useGSAP(() => {
    if (!perspectiveWrapperRef.current) return;
    const card = cardRef.current;
    const wrapper = perspectiveWrapperRef.current;

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { left, top, width, height } = wrapper.getBoundingClientRect();
      const x = (clientX - left - width / 2) / 25;
      const y = (clientY - top - height / 2) / 25;

      gsap.to(card, {
        rotationY: x,
        rotationX: -y,
        ease: 'power2.out',
        duration: 0.6
      });
    };

    const onMouseLeave = () => {
      gsap.to(card, {
        rotationY: 0,
        rotationX: 0,
        ease: 'power3.out',
        duration: 0.6
      });
    };
    
    wrapper.addEventListener('mousemove', onMouseMove);
    wrapper.addEventListener('mouseleave', onMouseLeave);

    return () => {
      wrapper.removeEventListener('mousemove', onMouseMove);
      wrapper.removeEventListener('mouseleave', onMouseLeave);
    };
  }, { scope: perspectiveWrapperRef });

  const handleToggle = () => {
    onToggle(service.id);
    // Animación de "bamboleo" para confirmación
    if (cardRef.current) {
        gsap.timeline()
            .to(cardRef.current, { scale: 1.05, rotationY: 5, duration: 0.1, ease: 'power2.out' })
            .to(cardRef.current, { rotationY: -5, duration: 0.1, ease: 'power2.inOut' })
            .to(cardRef.current, { rotationY: 3, duration: 0.1, ease: 'power2.inOut' })
            .to(cardRef.current, { scale: 1, rotationY: 0, duration: 0.2, ease: 'power2.in' });
    }
  }

  const isVariablePrice = service.name.toLowerCase().includes('keratina') || service.name.toLowerCase().includes('coloración');

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
              "glass-card-effect overflow-hidden h-full w-full transform-style-preserve-3d"
            )}
        >
          {/* FRENTE DE LA TARJETA */}
          <div className="card-face card-face-front">
              <div className="flex flex-col items-center justify-end p-0 relative h-full">
                  <div className="absolute inset-0 z-0">
                      {service.mediaType === 'image' ? (
                          <Image
                              src={service.mediaUrl}
                              alt={service.name}
                              fill
                              className="object-cover group-hover:scale-110 transition-transform duration-500 ease-in-out"
                          />
                      ) : (
                          <video
                              src={service.mediaUrl}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500 ease-in-out"
                          />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center justify-end h-full w-full p-6 text-center text-white">
                      <h3 className="text-xl font-bold mb-1">{service.name}</h3>
                      <p className="text-xs text-white/80 mb-3 min-h-[3rem]">{service.description}</p>
                      <div className="flex items-center justify-center gap-4 text-muted-foreground font-semibold">
                          <span className="text-xl font-black text-white">
                             {isVariablePrice && 'Desde '}${parseInt(service.price).toLocaleString('es-CO')}
                          </span>
                          <div className="flex items-center gap-1 text-sm text-white/80">
                            <Clock className="h-4 w-4" />
                            <span>{service.duration} min</span>
                          </div>
                      </div>
                      <button
                          onClick={handleToggle}
                          className={cn(
                            "liquid-glass-button mt-3 w-full !py-2.5 text-sm",
                            isSelected && 'phone'
                          )}
                      >
                           {isSelected ? <><Check className="mr-2 h-4 w-4" /> Elegido</> : "Elegir"}
                      </button>
                  </div>
              </div>
          </div>
        </div>
      </div>
  )
}

export function ServiceCatalog({ serviceId, onNavigate }: { serviceId?: string, onNavigate: (scene: Scene) => void }) {
  const plugin = React.useRef(Autoplay({ delay: 3000, stopOnInteraction: true }));
  const { selectedServices, toggleService, selectedBarberId } = useBooking();
  const playScissorsSound = useScissorsSound();
  const [api, setApi] = React.useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  const services = React.useMemo(() => {
    if (!serviceId) return defaultServices;
    const selected = defaultServices.find(s => s.id === serviceId);
    return selected ? [selected, ...defaultServices.filter(s => s.id !== serviceId)] : defaultServices;
  }, [serviceId]);
  
  const handleToggleService = (id: string) => {
    toggleService(id);
    playScissorsSound();
    
    // Smooth scroll to the next logical section
    setTimeout(() => {
      const hasServices = !selectedServices.includes(id) || selectedServices.length > 1;
      // If services are selected but no barber, go to team selection.
      if (hasServices && !selectedBarberId) {
        onNavigate("team");
      } 
      // If both are selected, go to booking confirmation.
      else if (hasServices && selectedBarberId) {
        onNavigate("booking");
      }
    }, 1000);
  }

  const containerRef = React.useRef<HTMLElement>(null);
  
  useGSAP(() => {
    gsap.fromTo(
      ".carousel-item-service", 
      { opacity: 0, scale: 0.9, y: 30 },
      { 
        opacity: 1, 
        scale: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.15,
        delay: 0.3
      }
    );
  }, { scope: containerRef });

  React.useEffect(() => {
    if (!api) {
      return
    }
 
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
    
    const onSelect = () => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }

    api.on('select', onSelect)
    
    return () => {
      api.off('select', onSelect)
    }
  }, [api])


  return (
    <section ref={containerRef} id="services" className="pt-0 pb-12 md:pb-24">
      <div className="flex flex-col items-center text-center">
        <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">SERVICIOS</h2>
      </div>

      <div className="relative mt-8">
        <Carousel
          setApi={setApi}
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
              )
            })}
          </CarouselContent>
        </Carousel>
        <button 
          onClick={() => api?.scrollPrev()} 
          disabled={!canScrollPrev} 
          className="thick-glass-arrow left-2 md:left-4 focus:outline-none transition-transform duration-300 ease-in-out hover:scale-110"
        >
            <div className="thick-glass-button-inner">
                <div className="thick-glass-button-content">
                    <ArrowLeft className="h-6 w-6 text-white" />
                </div>
            </div>
        </button>
        <button 
          onClick={() => api?.scrollNext()} 
          disabled={!canScrollNext}
          className="thick-glass-arrow right-2 md:right-4 focus:outline-none transition-transform duration-300 ease-in-out hover:scale-110"
        >
            <div className="thick-glass-button-inner">
                <div className="thick-glass-button-content">
                    <ArrowRight className="h-6 w-6 text-white" />
                </div>
            </div>
        </button>
      </div>
    </section>
  );
}
