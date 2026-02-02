
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { MapPin, LocateFixed } from "lucide-react";

const barbershopAddress = "Calle 22N #6A-30 Ciudad Jardín, Popayán, Cauca, Colombia";
const embedMapSrc = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d249.13472620422888!2d-76.59370508089602!3d2.455246144254636!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30039e6cd7a23d%3A0x83fc232b8521482d!2sCl.%2022%20Nte.%20%236a-30%2C%20Popay%C3%A1n%2C%20Cauca!5e0!3m2!1ses!2sco!4v1760464742200!5m2!1ses!2sco";

const MapActions = () => {
    const handleDirections = () => {
        const destination = encodeURIComponent(barbershopAddress);
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
        window.open(url, "_blank");
    };

    return (
        <div className="absolute top-4 right-4 z-10">
            <Button onClick={handleDirections} size="sm" variant="default" className="bg-black hover:bg-gray-800 text-white shadow-md">
                <LocateFixed className="mr-2 h-4 w-4" />
                Cómo llegar
            </Button>
        </div>
    );
};


export function LocationSection() {
  return (
    <section id="location" className="py-12 md:py-24 text-center">
      <Dialog>
        <DialogTrigger asChild>
          <button aria-label="Abrir mapa de ubicación">
            <MapPin className="mx-auto h-12 w-12 text-primary cursor-pointer transition-transform hover:scale-110" />
          </button>
        </DialogTrigger>
        <h2 className="mt-4 font-headline text-3xl font-bold tracking-tight">Encuéntranos</h2>
        <p className="mt-2 max-w-md mx-auto text-muted-foreground">
          {barbershopAddress.split(',').slice(0, 2).join(', ')}
        </p>
        <DialogTrigger asChild>
          <Button className="mt-6">Ver Mapa y Cómo Llegar</Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl h-[80vh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>Nuestra Ubicación</DialogTitle>
            <DialogDescription>{barbershopAddress}</DialogDescription>
          </DialogHeader>
          <div className="flex-grow relative">
             <iframe
                src={embedMapSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación de Barba Larga"
            ></iframe>
            <MapActions />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
