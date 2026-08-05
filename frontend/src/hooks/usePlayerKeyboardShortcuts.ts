import { useEffect } from 'react';
import { usePlayer } from './usePlayer';

export const usePlayerKeyboardShortcuts = () => {
  const { currentSong, togglePlay, previousSong, nextSong } = usePlayer();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if no song is active
      if (!currentSong) return;

      // Ignore keyboard shortcuts when user is focused on interactive inputs
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          previousSong();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextSong();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentSong, togglePlay, previousSong, nextSong]);
};
