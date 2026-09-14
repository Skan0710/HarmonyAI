import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { loadYoutubeIframeApi, type YoutubePlayer } from '../lib/youtubeIframeApi';

export interface PlaybackEngineHandle {
  seekTo: (seconds: number) => void;
  play: () => void;
  replay: () => void;
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
 *
 * The underlying YT.Player instance is created once and reused across track
 * changes (cueVideoById/loadVideoById swap the video in place) instead of
 * being destroyed and rebuilt every time — rebuilding re-runs the iframe's
 * full page load each track, which is the dominant source of next-song
 * startup latency. This only pays off if the component itself stays
 * mounted across the transition (see MiniPlayer's video-id resolution,
 * which avoids unmounting the portal when a video id is already cached).
 */
export const YoutubePlayerEngine = forwardRef<PlaybackEngineHandle, YoutubePlayerEngineProps>(
  ({ videoId, isPlaying, volume, isMuted, onTimeUpdate, onDuration, onEnded, onReady, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YoutubePlayer | null>(null);
    const pollRef = useRef<number | null>(null);
    const isReadyRef = useRef(false); // player instance constructed & usable
    const loadedVideoIdRef = useRef<string | null>(null); // video currently cued/loaded
    const pendingSeekRef = useRef<number | null>(null);

    const latestVideoIdRef = useRef(videoId);
    latestVideoIdRef.current = videoId;
    const latestIsPlayingRef = useRef(isPlaying);
    latestIsPlayingRef.current = isPlaying;

    const onTimeUpdateRef = useRef(onTimeUpdate);
    onTimeUpdateRef.current = onTimeUpdate;
    const onDurationRef = useRef(onDuration);
    onDurationRef.current = onDuration;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (isReadyRef.current && playerRef.current) {
          try {
            playerRef.current.seekTo(seconds, true);
          } catch {}
        } else {
          pendingSeekRef.current = seconds;
        }
      },
      play: () => {
        playerRef.current?.playVideo();
      },
      replay: () => {
        if (isReadyRef.current && playerRef.current) {
          try {
            playerRef.current.seekTo(0, true);
            playerRef.current.playVideo();
          } catch {}
        } else {
          pendingSeekRef.current = 0;
        }
      },
    }));

    // Create the player exactly once for the lifetime of this component
    // instance (component unmount/remount still happens when the portal
    // itself is torn down, e.g. cold — uncached — track resolution).
    useEffect(() => {
      let cancelled = false;

      loadYoutubeIframeApi().then((YT) => {
        if (cancelled || !containerRef.current || playerRef.current) return;

        playerRef.current = new YT.Player(containerRef.current, {
          videoId: latestVideoIdRef.current,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: (event) => {
              isReadyRef.current = true;
              loadedVideoIdRef.current = latestVideoIdRef.current;
              event.target.setVolume(isMuted ? 0 : volume * 100);
              const dur = event.target.getDuration();
              if (dur && dur > 0) onDurationRef.current(dur);
              onReadyRef.current();
              if (pendingSeekRef.current !== null) {
                event.target.seekTo(pendingSeekRef.current, true);
                pendingSeekRef.current = null;
              }
              if (latestIsPlayingRef.current) event.target.playVideo();

              // The target video may have changed while the player was still
              // initializing (fast successive skips) — catch up now.
              if (latestVideoIdRef.current !== loadedVideoIdRef.current) {
                loadedVideoIdRef.current = latestVideoIdRef.current;
                if (latestIsPlayingRef.current) {
                  event.target.loadVideoById(latestVideoIdRef.current);
                } else {
                  event.target.cueVideoById(latestVideoIdRef.current);
                }
              }
            },
            onStateChange: (event) => {
              if (event.data === YT_STATE_ENDED) onEndedRef.current();
              const dur = event.target?.getDuration?.();
              if (dur && dur > 0) {
                onDurationRef.current(dur);
                // Signals "this video's data is loaded" after a cue/load
                // swap — harmless to call repeatedly, the consumer just
                // clears a loading spinner.
                onReadyRef.current();
              }
            },
            onError: () => onErrorRef.current(),
          },
        });
      });

      return () => {
        cancelled = true;
        playerRef.current?.destroy();
        playerRef.current = null;
        isReadyRef.current = false;
        loadedVideoIdRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Swap the video on the existing, already-ready player instead of
    // rebuilding the iframe from scratch.
    useEffect(() => {
      if (!isReadyRef.current || !playerRef.current) return; // onReady above will catch up once ready
      if (loadedVideoIdRef.current === videoId) return;

      loadedVideoIdRef.current = videoId;
      pendingSeekRef.current = null;
      try {
        if (isPlaying) {
          playerRef.current.loadVideoById(videoId);
        } else {
          playerRef.current.cueVideoById(videoId);
        }
      } catch {
        onErrorRef.current();
      }
    }, [videoId, isPlaying]);

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
          const t = playerRef.current.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) {
            onTimeUpdateRef.current(t);
          }
          const dur = playerRef.current.getDuration();
          if (dur && dur > 0) {
            onDurationRef.current(dur);
          }
        }
      }, 250);
      return () => {
        if (pollRef.current) window.clearInterval(pollRef.current);
      };
    }, []);

    return <div ref={containerRef} className="w-full h-full bg-black" />;
  }
);

YoutubePlayerEngine.displayName = 'YoutubePlayerEngine';
