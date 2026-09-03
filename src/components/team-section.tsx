
"use client";

import React from "react";
import Image from "next/image";
import { useBooking } from "@/hooks/use-booking";
import { cn } from "@/lib/utils";
import { Check, Lock, ArrowLeft, ArrowRight, User, Group, Loader2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { getTeam, type TeamMember as TeamMemberType } from "@/app/actions";
import { useScissorsSound } from "@/hooks/use-scissors-sound";
import { getSafeImageUrl } from "@/lib/image-validation";

type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';

const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'User': return User;
    case 'Group': return Group;
    default: return User;
  }
}

const TeamMemberCard = ({ member, isSelected, onSelect }: { member: TeamMemberType & { icon: string, imageHint: string }, isSelected: boolean, onSelect: (id: string) => void }) => {
  const Icon = getIcon(member.icon);

  return (
    <div className={cn(
      "group perspective w-full h-[360px]",
      !member.isAvailable && "opacity-60"
    )}>
      <div className={cn("relative transform-style-preserve-3d w-full h-full transition-transform duration-700")}>
        {/* CARA FRONTAL */}
        <div className="card-face card-face-front glass-card-effect overflow-hidden">
          <Image
            src={getSafeImageUrl(member.imageUrl)}
            alt={member.name}
            fill
            className={cn(
              "object-cover",
              !member.isAvailable && "grayscale blur-sm"
            )}
            data-ai-hint={member.imageHint}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://i.ibb.co/k2TL19sp/logo-barber.jpg";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <h3 className="text-2xl font-bold">{member.name}</h3>
            <p className="text-primary">{member.role}</p>
          </div>
          {isSelected && member.isAvailable && (
            <div className="absolute top-4 right-4 bg-black text-white rounded-full p-2">
              <Check className="h-5 w-5" />
            </div>
          )}
          {!member.isAvailable && (
            <div className="absolute top-4 right-4 bg-muted text-muted-foreground rounded-full p-2">
              <Lock className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* CARA TRASERA CON EFECTO LIQUID GLASS */}
        <div className="card-face card-face-back overflow-hidden">
          <div className="relative w-full h-full">
            {/* Fondo con imagen borrosa */}
            <Image
              src={getSafeImageUrl(member.imageUrl)}
              alt={member.name}
              fill
              className="object-cover scale-125 blur-lg brightness-50"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://i.ibb.co/k2TL19sp/logo-barber.jpg";
              }}
            />
            {/* Contenedor con efecto de vidrio */}
            <div className="absolute inset-0 glass-card-effect flex flex-col justify-between p-6">
              <div className="flex-grow flex flex-col items-center justify-center text-center">
                <Icon className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">{member.name}</h3>
                <p className="text-white/80 flex-grow text-sm">
                  {member.description}
                </p>
              </div>
              <button
                onClick={() => member.isAvailable && onSelect(member.id)}
                disabled={!member.isAvailable}
                className={cn(
                  "liquid-glass-button mt-4 w-full",
                  isSelected && member.isAvailable ? "phone" : "bg-black/20",
                  !member.isAvailable && "opacity-50 cursor-not-allowed"
                )}
              >
                {member.isAvailable ? (
                  isSelected ? <><Check className="mr-2 h-4 w-4" /> Seleccionado</> : "Elegir"
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> No disponible</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function TeamSection({ onNavigate }: { onNavigate: (scene: Scene) => void }) {
  const { selectedBarberId, setSelectedBarberId, selectedServices } = useBooking();
  const plugin = React.useRef(Autoplay({ delay: 4000, stopOnInteraction: true }));
  const [api, setApi] = React.useState<CarouselApi>()
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)
  const [team, setTeam] = React.useState<Array<TeamMemberType & { icon: string, imageHint: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const playScissorsSound = useScissorsSound();

  const containerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const fetchTeam = async () => {
      try {
        const teamData = await getTeam();
        // Statically add icon and imageHint for design purposes as they are not in DB
        const extendedTeamData = teamData.map(member => ({
          ...member,
          icon: member.role === "Nuestra Filosofía" ? 'Group' : 'User',
          imageHint: member.role === "Nuestra Filosofía" ? 'company logo' : (member.name.toLowerCase().includes("próximamente") && member.role === 'Estilista' ? 'female placeholder' : 'barber portrait')
        }));

        // Sort team members: active ones first
        extendedTeamData.sort((a, b) => {
          if (a.isAvailable && !b.isAvailable) return -1;
          if (!a.isAvailable && b.isAvailable) return 1;
          return 0;
        });

        setTeam(extendedTeamData);
      } catch (error) {
        console.error("Failed to fetch team:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);


  const teamMembers = React.useMemo(() => {
    if (!selectedBarberId) return team;
    const selected = team.find(m => m.id === selectedBarberId);
    if (!selected) return team;
    return [selected, ...team.filter(m => m.id !== selectedBarberId)];
  }, [selectedBarberId, team]);

  const handleSelectBarber = (id: string) => {
    const isDeselecting = selectedBarberId === id;
    const newBarberId = isDeselecting ? null : id;
    setSelectedBarberId(newBarberId);
    playScissorsSound();

    if (!isDeselecting) {
      setTimeout(() => {
        api?.scrollTo(0, true);
        if (selectedServices.length > 0) {
          onNavigate('booking');
        } else {
          onNavigate('services');
        }
      }, 300);
    }
  }

  useGSAP(() => {
    if (loading) return;
    gsap.fromTo(
      ".carousel-item-team",
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
  }, { scope: containerRef, dependencies: [loading] });

  React.useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    api.on('select', onSelect);
    api.on('reInit', onSelect);
    onSelect();

    return () => {
      api.off('select', onSelect);
    };
  }, [api]);


  return (
    <section ref={containerRef} id="team" className="w-full max-w-7xl mx-auto flex flex-col justify-center px-4 pt-0 pb-12 md:pb-24">
      <div className="flex flex-col items-center text-center mb-8">
        <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">EQUIPO</h2>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          {selectedServices.length > 0 ? "Elige con quién quieres tu servicio." : "Conoce a nuestros expertos en estilo."}
        </p>
      </div>
      {loading ? (
        <div className="flex justify-center items-center h-[360px]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="relative">
          <Carousel
            setApi={setApi}
            plugins={[plugin.current]}
            className="w-full"
            opts={{ align: "start", loop: team.length > 2 }}
            key={selectedBarberId}
          >
            <CarouselContent className="-ml-4">
              {teamMembers.map((member) => (
                <CarouselItem
                  key={member.id}
                  className="carousel-item-team md:basis-1/2 lg:basis-1/3 pl-4"
                >
                  <TeamMemberCard
                    member={member}
                    isSelected={selectedBarberId === member.id}
                    onSelect={handleSelectBarber}
                  />
                </CarouselItem>
              ))}
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
      )}
    </section>
  );
}
