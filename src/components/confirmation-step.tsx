
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LocateFixed } from "lucide-react";

interface CheckmarkIconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
}

const CheckmarkIcon: React.FC<CheckmarkIconProps> = ({ size = 100, ...props }) => (
  <svg
    {...props}
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    className="checkmark"
  >
    <style>{`
      .checkmark__circle {
        stroke-dasharray: 166;
        stroke-dashoffset: 166;
        stroke-width: 4;
        stroke: hsl(var(--primary));
        fill: none;
        animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
      }
      .checkmark__check {
        transform-origin: 50% 50%;
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
        stroke-width: 5;
        stroke: hsl(var(--primary));
        stroke-linecap: round;
        fill: none;
        animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
      }
      @keyframes stroke {
        100% {
          stroke-dashoffset: 0;
        }
      }
    `}</style>
    <circle className="checkmark__circle" cx="50" cy="50" r="46" />
    <path className="checkmark__check" d="M34,50 l12,12 l20,-20" />
  </svg>
);


interface ConfirmationStepProps {
    barberName: string;
    serviceName: string;
    date: string;
    time: string;
    whatsappUrl?: string;
    onBookAnother: () => void;
}

export function ConfirmationStep({ barberName, serviceName, date, time, whatsappUrl, onBookAnother }: ConfirmationStepProps) {
  
  const handleDirections = () => {
    const barbershopAddress = "Calle 22N #6A-30 Ciudad Jardín, Popayán, Cauca, Colombia";
    const destination = encodeURIComponent(barbershopAddress);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
    window.open(url, "_blank");
  };

  const handleBookAnother = () => {
    onBookAnother();
  };

  return (
    <div className="p-8 md:p-12 text-center animate-in fade-in-0 duration-500 flex flex-col items-center justify-center min-h-[400px]">
        <CheckmarkIcon />
        <h2 className="font-headline text-3xl md:text-4xl font-bold tracking-tight mt-6">¡Reserva Confirmada!</h2>
        <p className="mt-4 max-w-md mx-auto text-muted-foreground">
            Tu cita con <strong>{barberName}</strong> para <strong>{serviceName}</strong> el día <strong>{date}</strong> a las <strong>{time}</strong> ha sido agendada con éxito.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
            Recibirás un correo electrónico con los detalles. ¡Te esperamos!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-8 flex-wrap justify-center">
            {whatsappUrl && (
                <Button 
                    variant="outline" 
                    onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                    className="border-green-500 text-green-500 hover:bg-green-500 hover:text-black"
                >
                    Abrir WhatsApp
                </Button>
            )}
            <Button onClick={handleDirections} variant="secondary">
                <LocateFixed className="mr-2 h-4 w-4" />
                Cómo llegar
            </Button>
            <Button variant="3d" onClick={handleBookAnother}>
                Reservar otra cita
            </Button>
        </div>
    </div>
  );
}
