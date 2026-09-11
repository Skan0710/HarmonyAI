import { create } from 'zustand';

interface CommandPaletteState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (value: boolean) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setOpen: (value) => set({ isOpen: value }),
}));
