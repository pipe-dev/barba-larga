
import type { LucideIcon } from "lucide-react";
import { Scissors, Droplets, Paintbrush, Sparkles, User, PencilRuler, Gem } from "lucide-react";

export interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: number; // Duration in minutes
  icon?: LucideIcon | 'BeardIcon' | any;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  imageHint?: string;
}

export const SLOT_INTERVAL_MINUTES = 10;
export const MIN_GAP_MINUTES = 20;

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

export const getAdminBlockTimeOptions = (): { startTimes: string[]; endTimes: string[] } => {
  const morningTimes = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM"];
  const afternoonTimes = ["12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"];
  const nightTimes = ["06:00 PM", "07:00 PM", "08:00 PM"];
  const startTimes = [...morningTimes, ...afternoonTimes, ...nightTimes];
  const endTimes = [...startTimes, "09:00 PM"];
  return { startTimes, endTimes };
};

export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return -1;
  const normalized = timeStr.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3];
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return -1;
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const minutesToTimeStr = (totalMins: number): string => {
  if (totalMins < 0) return "00:00 AM";
  const h24 = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export const doIntervalsOverlap = (startA: number, endA: number, startB: number, endB: number): boolean => {
  return Math.max(startA, startB) < Math.min(endA, endB);
};

export const getServiceDuration = (ids: string, customServices?: Service[]): number => {
  if (!ids) return 60; // Safe default
  const list = customServices && customServices.length > 0 ? customServices : [];
  if (list.length === 0) return 60;
  const serviceIds = ids.split(',').map(id => id.trim()).filter(Boolean);
  const chosenServices = list.filter(s => serviceIds.includes(s.id));
  const total = chosenServices.reduce((acc, s) => acc + (s.duration || 60), 0);
  return total > 0 ? total : 60;
};

export const getServiceDetails = (ids: string, customServices?: Service[]) => {
  if (!ids) return { names: 'Servicio', totalPrice: 0, totalDuration: 60 };
  const list = customServices && customServices.length > 0 ? customServices : [];
  const serviceIds = ids.split(',').map(id => id.trim()).filter(Boolean);
  const chosenServices = list.filter(s => serviceIds.includes(s.id));

  if (chosenServices.length === 0) {
    return { names: ids, totalPrice: 0, totalDuration: 60 };
  }

  const names = chosenServices.map(s => s.name).join(', ');
  const totalPrice = chosenServices.reduce((total, s) => {
    const rawPrice = s.price !== undefined && s.price !== null ? String(s.price) : '0';
    const price = parseInt(rawPrice.replace(/\D/g, ''), 10) || 0;
    return total + price;
  }, 0);
  const totalDuration = chosenServices.reduce((total, s) => total + (s.duration || 60), 0);

  return { names, totalPrice, totalDuration };
};

