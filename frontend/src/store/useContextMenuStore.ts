import { create } from 'zustand';
import type { Song } from '../types/music';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  song: Song | null;
  openContextMenu: (e: React.MouseEvent, song: Song) => void;
  closeContextMenu: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  song: null,
  openContextMenu: (e, song) => {
    e.preventDefault();
    e.stopPropagation();

    // Clamp coordinates so menu doesn't spawn offscreen
    const menuWidth = 240;
    const menuHeight = 320;
    const padding = 12;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > screenWidth - padding) {
      x = Math.max(padding, screenWidth - menuWidth - padding);
    }
    if (y + menuHeight > screenHeight - padding) {
      y = Math.max(padding, screenHeight - menuHeight - padding);
    }

    set({
      isOpen: true,
      x,
      y,
      song,
    });
  },
  closeContextMenu: () => {
    set({ isOpen: false, song: null });
  },
}));
