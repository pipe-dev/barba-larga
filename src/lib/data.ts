
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
    mediaUrl: "/multimedia/haircut-eyebrows.png",
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

  // Uniform schedule: 8:00 AM - 9:00 PM every day (Mon-Sat)
  // Admin controls availability via time blocking
  const morningTimes = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];
  const afternoonTimes = ["12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
  const nightTimes = ["06:00 PM", "07:00 PM", "08:00 PM"];

  return { morning: morningTimes, afternoon: afternoonTimes, night: nightTimes };
};

export const getEndTimeOptions = (date: Date): string[] => {
  const { morning, afternoon, night } = getBaseAvailableTimes(date);
  const allTimes = [...morning, ...afternoon, ...night];

  // Add 9:00 PM as the final end-time option for blocking
  if (allTimes.length > 0) {
    allTimes.push("09:00 PM");
  }

  return allTimes;
};

export const getServiceDetails = (ids: string) => {
  if (!ids) return { names: 'Servicio Desconocido', totalPrice: 0 };
  const serviceIds = ids.split(',');
  const chosenServices = services.filter(s => serviceIds.includes(s.id.trim()));

  const names = chosenServices.map(s => s.name).join(', ');
  const totalPrice = chosenServices.reduce((total, s) => {
    const price = parseInt(s.price.replace(/\D/g, ''), 10) || 0;
    return total + price;
  }, 0);

  return { names, totalPrice };
};
