import { useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { useKeyboardShortcutsModalStore } from '../store/useKeyboardShortcutsModalStore';

export const usePlayerKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Ignore standard browser shortcuts with Ctrl / Cmd (e.g. Ctrl+R, Ctrl+T, Ctrl+K, etc.)
      if (e.ctrlKey || e.metaKey) {
        return;
      }

      const key = e.key;
      const code = e.code;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // Modal toggle shortcut: '?' or Shift + '/'
      if (key === '?' || (isShift && (key === '/' || code === 'Slash'))) {
        e.preventDefault();
        useKeyboardShortcutsModalStore.getState().toggle();
        return;
      }

      const playerState = usePlayerStore.getState();

      // Backward-compatible Alt + Arrow shortcuts
      if (isAlt) {
        if (code === 'ArrowRight') {
          e.preventDefault();
          playerState.nextSong();
          return;
        }
        if (code === 'ArrowLeft') {
          e.preventDefault();
          playerState.previousSong();
          return;
        }
        return;
      }

      // If no song is active, don't execute playback shortcuts
      if (!playerState.currentSong) return;

      // 1. Next Track (Skip): 'j' or Shift + N
      if (
        (!isShift && (code === 'KeyJ' || key.toLowerCase() === 'j')) ||
        (isShift && (code === 'KeyN' || key.toLowerCase() === 'n'))
      ) {
        e.preventDefault();
        playerState.nextSong();
        return;
      }

      // 2. Previous Track: 'k' or Shift + P
      if (
        (!isShift && (code === 'KeyK' || key.toLowerCase() === 'k')) ||
        (isShift && (code === 'KeyP' || key.toLowerCase() === 'p'))
      ) {
        e.preventDefault();
        playerState.previousSong();
        return;
      }

      // 3. Play / Pause: Space or ';'
      if (code === 'Space' || code === 'Semicolon' || key === ';') {
        e.preventDefault();
        playerState.togglePlay();
        return;
      }

      // 4. Seek forward 10 seconds: 'l' or Shift + Right Arrow or Right Arrow
      if (
        (!isShift && (code === 'KeyL' || key.toLowerCase() === 'l')) ||
        code === 'ArrowRight'
      ) {
        e.preventDefault();
        const duration = playerState.duration || Infinity;
        const targetTime = Math.min(duration, playerState.currentTime + 10);
        playerState.seekTo(targetTime);
        return;
      }

      // 5. Seek back 10 seconds: 'h' or Shift + Left Arrow or Left Arrow
      if (
        (!isShift && (code === 'KeyH' || key.toLowerCase() === 'h')) ||
        code === 'ArrowLeft'
      ) {
        e.preventDefault();
        const targetTime = Math.max(0, playerState.currentTime - 10);
        playerState.seekTo(targetTime);
        return;
      }

      // 6. Volume Up: '=' or '+' or ArrowUp
      if (
        code === 'ArrowUp' ||
        key === '=' ||
        key === '+' ||
        (!isShift && code === 'Equal')
      ) {
        e.preventDefault();
        const currentVol = playerState.volume;
        const newVol = Math.min(1, Math.round((currentVol + 0.05) * 100) / 100);
        playerState.setVolume(newVol);
        return;
      }

      // 7. Volume Down: '-' or ArrowDown
      if (
        code === 'ArrowDown' ||
        (!isShift && (key === '-' || code === 'Minus'))
      ) {
        e.preventDefault();
        const currentVol = playerState.volume;
        const newVol = Math.max(0, Math.round((currentVol - 0.05) * 100) / 100);
        playerState.setVolume(newVol);
        return;
      }

      // 8. Mute / Unmute: 'm'
      if (!isShift && (code === 'KeyM' || key.toLowerCase() === 'm')) {
        e.preventDefault();
        playerState.toggleMute();
        return;
      }

      // 9. Toggle Shuffle: 's'
      if (!isShift && (code === 'KeyS' || key.toLowerCase() === 's')) {
        e.preventDefault();
        playerState.toggleShuffle();
        return;
      }

      // 10. Toggle Repeat Mode: 'r'
      if (!isShift && (code === 'KeyR' || key.toLowerCase() === 'r')) {
        e.preventDefault();
        playerState.toggleRepeatMode();
        return;
      }

      // 11. Like song: '+' or Shift + '='
      if ((isShift && (key === '+' || code === 'Equal')) || key === '+') {
        e.preventDefault();
        if (playerState.currentSong) {
          useLikedSongsStore.getState().toggleLikeSong(playerState.currentSong);
        }
        return;
      }

      // 12. Toggle Queue: 'q'
      if (!isShift && (code === 'KeyQ' || key.toLowerCase() === 'q')) {
        e.preventDefault();
        playerState.toggleQueueOpen();
        return;
      }

      // 13. Toggle Full Player: 'f'
      if (!isShift && (code === 'KeyF' || key.toLowerCase() === 'f')) {
        e.preventDefault();
        playerState.setFullPlayerOpen(!playerState.isFullPlayerOpen);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
};
