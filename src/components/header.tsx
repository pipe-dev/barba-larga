
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useShaverSound } from "@/hooks/use-shaver-sound";

const BarberPoleIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
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

const navLinks = [
  { href: "#about", text: "Nosotros" },
  { href: "#team", text: "Equipo" },
  { href: "#services", text: "Servicios" },
  { href: "#booking", text: "Reservar" },
  { href: "#location", text: "Ubicación" },
];


export function Header() {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const playShaverSound = useShaverSound();

  const handleBookingClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    playShaverSound();
    setIsSheetOpen(false);
    const bookingSection = document.getElementById("booking");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    setIsSheetOpen(false);
    const section = document.getElementById(href.substring(1));
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/admin" className="flex items-center gap-3 group" aria-label="Acceso de administrador">
            <div className="group-hover:scale-110 transition-transform">
              <BarberPoleIcon />
            </div>
            <h1 className="font-headline text-2xl font-black text-foreground group-hover:text-primary transition-colors">
                Barba Larga
            </h1>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navLinks.filter(link => link.href !== "#booking").map((link) => (
                <Link key={link.href} href={link.href} onClick={(e) => handleLinkClick(e, link.href)} className="text-muted-foreground transition-colors hover:text-primary">
                    {link.text}
                </Link>
            ))}
             <Link href="#booking" passHref onClick={handleBookingClick}>
                <Button variant="3d">Reservar Cita</Button>
            </Link>
             <AudioPlayer />
        </nav>


        {/* Mobile Navigation */}
        <div className="flex items-center gap-2 md:hidden">
            <AudioPlayer />
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Abrir menú</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right">
                    <nav className="grid gap-6 text-lg font-medium mt-8">
                         <SheetClose asChild>
                            <Link href="/admin" className="flex items-center gap-3 group mb-4" aria-label="Acceso de administrador">
                                <BarberPoleIcon />
                                <h1 className="font-headline text-xl font-black text-foreground">
                                    Barba Larga
                                </h1>
                            </Link>
                        </SheetClose>
                        {navLinks.map((link) => (
                             <SheetClose asChild key={link.href}>
                                <Link href={link.href} className="text-muted-foreground hover:text-foreground" onClick={(e) => handleLinkClick(e, link.href)}>
                                    {link.text}
                                </Link>
                            </SheetClose>
                        ))}
                         <SheetClose asChild>
                             <Link href="#booking" passHref onClick={handleBookingClick}>
                                <Button variant="3d" size="lg" className="w-full mt-4">Reservar Cita</Button>
                            </Link>
                        </SheetClose>
                    </nav>
                </SheetContent>
            </Sheet>
        </div>

      </div>
    </header>
  );
}
