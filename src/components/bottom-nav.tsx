
"use client";

import Link from "next/link";
import { Home, Scissors, Users, Sparkles, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location' | 'contact';

interface BottomNavProps {
  activeScene: Scene;
  onNavigate: (scene: Scene) => void;
}

export const BottomNav = ({ activeScene, onNavigate }: BottomNavProps) => {

  const getIconClass = (scene: Scene) =>
    cn(
      "w-6 h-6 text-gray-400 group-hover:text-white transition-colors",
      activeScene === scene && "text-primary"
    );
  
  const getButtonClass = (scene: Scene) => 
    cn(
      "group bg-black/80 rounded-full p-1 transition-all",
      activeScene === scene && "active-glow"
    );
    
  const NavButton = ({ scene, children }: { scene: Scene, children: React.ReactNode }) => (
    <button onClick={() => onNavigate(scene)} className={getButtonClass(scene)}>
        {children}
    </button>
  );

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-28 z-30 pointer-events-none animate-fade-in-up">
      <div className="relative h-full w-full">
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-16">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1440 64"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 12 C 200 12, 280 52, 480 52 L 960 52 C 1160 52, 1240 12, 1440 12"
              stroke="url(#line-gradient)"
              strokeWidth="2"
              strokeDashoffset="0"
            />
            <defs>
              <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00ffff" stopOpacity="0" />
                <stop offset="20%" stopColor="#00ffff" stopOpacity="1" />
                <stop offset="80%" stopColor="#00ffff" stopOpacity="1" />
                <stop offset="100%" stopColor="#00ffff" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
  
        <div className="absolute inset-0 flex justify-center items-center pt-4 pointer-events-auto">
            <div className="flex justify-center items-center gap-6 md:gap-10">
              <NavButton scene="home">
                <Home className={getIconClass('home')} />
              </NavButton>
              <NavButton scene="services">
                <Scissors className={getIconClass('services')} />
              </NavButton>
              <NavButton scene="team">
                <Users className={getIconClass('team')} />
              </NavButton>
              <NavButton scene="ai-advisor">
                <Sparkles className={getIconClass('ai-advisor')} />
              </NavButton>
              <NavButton scene="location">
                <MapPin className={getIconClass('location')} />
              </NavButton>
               <NavButton scene="contact">
                <Phone className={getIconClass('contact')} />
              </NavButton>
            </div>
        </div>
      </div>
    </footer>
  );
}

    