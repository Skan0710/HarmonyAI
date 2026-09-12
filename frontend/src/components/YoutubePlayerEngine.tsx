import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtubeIframeApi';

export interface PlaybackEngineHandle {
  seekTo: (seconds: number) => void;
}

interface YoutubePlayerEngineProps {
  videoId: string;
  isPlaying: boolean;
  volume: number; // 0..1
  isMuted: boolean;
  onTimeUpdate: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  onEnded: () => void;
  onReady: () => void;
  onError: () => void;
}

const YT_STATE_ENDED = 0;

/**
 * Real, full-length audio via the official YouTube IFrame Player API —
 * embedding YouTube's own player (not extracting/streaming audio directly),
 * which is the one way to legally play full tracks for free. YouTube's
 * terms require the player to stay visibly on screen, so this renders a
 * small real video tile rather than a hidden iframe.
 */
export const YoutubePlayerEngine = forwardRef<PlaybackEngineHandle, YoutubePlayerEngineProps>(
  ({ videoId, isPlaying, volume, isMuted, onTimeUpdate, onDuration, onEnded, onReady, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YoutubePlayer | null>(null);
    const pollRef = useRef<number | null>(null);
    const isReadyRef = useRef(false);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
      },
    }));

    // Create the player once per videoId (destroy/recreate on track change)
    useEffect(() => {
      let cancelled = false;
      isReadyRef.current = false;

      loadYoutubeIframeApi().then((YT) => {
        if (cancelled || !containerRef.current) return;

        playerRef.current?.destroy();

        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (event) => {
              isReadyRef.current = true;
              event.target.setVolume(isMuted ? 0 : volume * 100);
              onDuration(event.target.getDuration());
              onReady();
              if (isPlaying) event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === YT_STATE_ENDED) onEnded();
            },
            onError: () => onError(),
          },
        });
      });

      return () => {
        cancelled = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    // Play / pause
    useEffect(() => {
      if (!isReadyRef.current || !playerRef.current) return;
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }, [isPlaying]);

    // Volume / mute
    useEffect(() => {
      if (!isReadyRef.current || !playerRef.current) return;
      playerRef.current.setVolume(isMuted ? 0 : volume * 100);
    }, [volume, isMuted]);

    // Poll current time — the IFrame API has no timeupdate event
    useEffect(() => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(() => {
        if (isReadyRef.current && playerRef.current) {
          onTimeUpdate(playerRef.current.getCurrentTime());
        }
      }, 500);
      return () => {
        if (pollRef.current) window.clearInterval(pollRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={containerRef} className="w-full h-full bg-black" />;
  }
);

YoutubePlayerEngine.displayName = 'YoutubePlayerEngine';
