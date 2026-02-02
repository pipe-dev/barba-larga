
"use client";

import Image from "next/image";
import Link from "next/link";
import { Key } from "lucide-react";

type Scene = 'home' | 'about' | 'team' | 'services' | 'booking' | 'ai-advisor' | 'location';

export const TopNav = ({ activeScene, onNavigate }: { activeScene: Scene, onNavigate: (scene: Scene) => void }) => (
    <header className="absolute top-0 left-0 right-0 p-6 z-10 animate-fade-in-down">
        <div className="flex justify-between items-center w-full">
            <button onClick={() => onNavigate('home')} className="glass-card p-1 rounded-full">
                <Image
                    src="/multimedia/logo-barber.jpg"
                    alt="Logo Barbería"
                    width={40}
                    height={40}
                    className="rounded-full"
                />
            </button>

            {activeScene === 'home' && (
                <Link href="/admin">
                    <button className="glass-card p-2 rounded-full">
                        <Key className="w-5 h-5 text-white/70 hover:text-white transition-colors" />
                    </button>
                </Link>
            )}
        </div>
    </header>
);
