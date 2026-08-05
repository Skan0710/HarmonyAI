import { usePlayerStore } from '../store/usePlayerStore';

export const usePlayer = () => {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const queue = usePlayerStore((state) => state.queue);
  const queueIndex = usePlayerStore((state) => state.queueIndex);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const isShuffle = usePlayerStore((state) => state.isShuffle);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const isQueueOpen = usePlayerStore((state) => state.isQueueOpen);

  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const play = usePlayerStore((state) => state.play);
  const pause = usePlayerStore((state) => state.pause);
  const stop = usePlayerStore((state) => state.stop);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const toggleRepeatMode = usePlayerStore((state) => state.toggleRepeatMode);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const nextSong = usePlayerStore((state) => state.nextSong);
  const previousSong = usePlayerStore((state) => state.previousSong);
  const handleSongEnd = usePlayerStore((state) => state.handleSongEnd);
  const toggleQueueOpen = usePlayerStore((state) => state.toggleQueueOpen);
  const setQueueOpen = usePlayerStore((state) => state.setQueueOpen);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    queue,
    queueIndex,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isQueueOpen,

    playSong,
    togglePlay,
    play,
    pause,
    stop,
    setCurrentTime,
    setDuration,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatMode,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setQueue,
    playQueueIndex,
    nextSong,
    previousSong,
    handleSongEnd,
    toggleQueueOpen,
    setQueueOpen,
  };
};
