
import type { LucideIcon } from "lucide-react";
import { Scissors, Droplets, Paintbrush, Sparkles, User, PencilRuler, Gem } from "lucide-react";

export interface Service {
    id: string;
    name: string;
    description: string;
    price: string;
    duration: number; // Duration in minutes
    icon: LucideIcon | 'BeardIcon';
    mediaUrl: string;
    mediaType: 'image' | 'video';
    imageHint: string;
}

export const services: Service[] = [
  {
    id: "haircut",
    name: "Corte de cabello",
    description: "Un corte preciso que define tu estilo y resalta tus mejores rasgos. Sal con una nueva actitud.",
    price: "25000",
    duration: 60,
    icon: Scissors,
    mediaUrl: "/multimedia/corte-autoridad.jpg",
    mediaType: 'image',
    imageHint: "male classic haircut"
  },
  {
    id: "haircut-eyebrows",
    name: "Corte de cabello con ceja",
    description: "El look completo. Un corte impecable complementado con un perfilado de cejas profesional para enmarcar tu mirada.",
    price: "26000",
    duration: 70,
    icon: Scissors,
    mediaUrl: "/multimedia/haircut-eyebrows.png",
    mediaType: 'image',
    imageHint: "haircut and eyebrows"
  },
  {
    id: "haircut-beard",
    name: "Corte de cabello con Barba",
    description: "La transformación total. Un corte de precisión y un diseño de barba que proyectan poder y sofisticación.",
    price: "35000",
    duration: 90,
    icon: 'BeardIcon',
    mediaUrl: "/multimedia/experiencia-dominante.jpg",
    mediaType: 'image',
    imageHint: "beard trim"
  },
  {
    id: "haircut-design",
    name: "Corte de cabello con diseño",
    description: "Tu estilo, tu lienzo. Un corte de precisión acompañado de un diseño creativo para expresar tu individualidad.",
    price: "30000",
    duration: 80,
    icon: PencilRuler,
    mediaUrl: "/multimedia/corte-diseño-cejas.jpg",
    mediaType: 'image',
    imageHint: "hair design"
  },
  {
    id: "haircut-facial-mask",
    name: "Corte de cabello más mascarilla de exfoliación",
    description: "Renueva tu look y tu piel. Un corte perfecto junto con una mascarilla que elimina impurezas y revitaliza tu rostro.",
    price: "32000",
    duration: 75,
    icon: Droplets,
    mediaUrl: "/multimedia/rostro-impecable.jpg",
    mediaType: 'image',
    imageHint: "facial treatment"
  },
  {
    id: "beard-combo",
    name: "Barba combo",
    description: "Una barba impecable es tu mejor carta de presentación. Incluye limpieza, exfoliación y un delineado perfecto.",
    price: "16000",
    duration: 40,
    icon: User,
    mediaUrl: "/multimedia/barba.jpg",
    mediaType: 'image',
    imageHint: "beard detailing"
  },
  {
    id: "eyebrows",
    name: "Cejas con cuchilla",
    description: "Define y perfecciona tus cejas con la precisión de la cuchilla para una mirada más nítida y marcada.",
    price: "4000",
    duration: 20,
    icon: PencilRuler,
    mediaUrl: "/multimedia/eyebrow.jpg",
    mediaType: 'image',
    imageHint: "eyebrow shaping"
  }
];

export const getBaseAvailableTimes = (date: Date): { morning: string[], afternoon: string[], night: string[] } => {
  const day = date.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6

  // Sunday is closed
  if (day === 0) {
    return { morning: [], afternoon: [], night: [] };
  }

  // Base times are consistent for all working days
  const morningTimes = ["10:00 AM", "11:00 AM"];
  const afternoonTimes = ["02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
  
  let nightTimes: string[] = [];

  // Monday (1) to Thursday (4)
  if (day >= 1 && day <= 4) {
    nightTimes = ["06:00 PM", "07:00 PM"];
  }
  
  // Friday (5) and Saturday (6)
  if (day === 5 || day === 6) {
    nightTimes = ["06:00 PM", "07:00 PM", "08:00 PM"];
  }

  return { morning: morningTimes, afternoon: afternoonTimes, night: nightTimes };
};

export const getEndTimeOptions = (date: Date): string[] => {
    const day = date.getDay(); // Sunday: 0, Monday: 1, ..., Saturday: 6
    const { morning, afternoon, night } = getBaseAvailableTimes(date);
    const allTimes = [...morning, ...afternoon, ...night];
    
    // Add an extra hour at the end for blocking
    if (day >= 1 && day <= 4) { // Weekdays
        allTimes.push("08:00 PM");
    } else if (day === 5 || day === 6) { // Weekends
        allTimes.push("09:00 PM");
    }
    
    return allTimes;
};
