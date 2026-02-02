import { create } from 'zustand';

type AudioState = {
  isInteracted: boolean;
  setInteracted: () => void;
  welcomeModalDismissed: boolean;
  setWelcomeModalDismissed: () => void;
};

const useAudioStore = create<AudioState>((set) => ({
  isInteracted: false,
  setInteracted: () => set({ isInteracted: true }),
  welcomeModalDismissed: typeof window !== 'undefined' ? !!localStorage.getItem('welcomeModalDismissed') : false,
  setWelcomeModalDismissed: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('welcomeModalDismissed', 'true');
    }
    set({ welcomeModalDismissed: true });
  },
}));

// Function to check initial state from localStorage on the client
export const initializeAudioStore = () => {
  if (typeof window !== 'undefined') {
    const dismissed = !!localStorage.getItem('welcomeModalDismissed');
    useAudioStore.setState({ welcomeModalDismissed: dismissed });
  }
};

export { useAudioStore };
