
import { create } from 'zustand';

type BookingState = {
  selectedServices: string[];
  selectedBarberId: string | null;
  setSelectedServices: (serviceIds: string[]) => void;
  toggleService: (serviceId: string) => void;
  setSelectedBarberId: (barberId: string | null) => void;
  resetBooking: () => void;
};

export const useBooking = create<BookingState>((set) => ({
  selectedServices: [],
  selectedBarberId: null,
  setSelectedServices: (serviceIds) => set({ selectedServices: serviceIds }),
  toggleService: (serviceId) => set((state) => {
    const selectedServices = state.selectedServices.includes(serviceId)
      ? state.selectedServices.filter(id => id !== serviceId)
      : [...state.selectedServices, serviceId];
    return { selectedServices };
  }),
  setSelectedBarberId: (barberId) => set({ selectedBarberId: barberId }),
  resetBooking: () => set({ selectedServices: [], selectedBarberId: null }),
}));
