
import type { LucideIcon } from "lucide-react";
import { User, Group } from "lucide-react";

export interface TeamMember {
    id: string;
    name: string;
    role: string;
    description: string;
    icon: string; // Storing icon name as string
    imageUrl: string;
    imageHint: string;
}

export const team: TeamMember[] = [
  {
    id: "alan-martinez",
    name: "Alan Martinez",
    role: "Barbero",
    description: "Te brindamos una experiencia única y personalizada 💫💇‍♂️.",
    icon: 'User',
    imageUrl: "/multimedia/nuestro-equipo-alan.jpg",
    imageHint: "barber portrait"
  },
   {
    id: "stiven-dorado",
    name: "Stiven Dorado",
    role: "Barbero",
    description: "Dicen por ahí que conmigo es pura buena energía. Es conocido por su atención a todos los detalles y un resultado impecable.",
    icon: 'User',
    imageUrl: "/multimedia/nuestro-equipo-stiven.png",
    imageHint: "barber portrait smiling"
  },
  {
    id: "barba-larga-brand",
    name: "Barba Larga",
    role: "Nuestra Filosofía",
    description: "Más que una barbería, un lugar donde el estilo y la confianza se forjan con maestría y dedicación.",
    icon: 'Group',
    imageUrl: "/multimedia/logo-barber.jpg",
    imageHint: "company logo"
  }
];

    