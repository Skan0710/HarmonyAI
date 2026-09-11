import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Plus,
  Check,
  RefreshCw,
  Heart,
  X,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  generateAIPlaylistApi,
  createPlaylistApi,
  addSongToPlaylistApi,
} from '../services/playlistService';
import type {
  DedicatedAIPlaylistResponseData,
  GeneratedPlaylistTrackDTO,
  GenerateAIPlaylistRequestParams,
} from '../services/playlistService';
import { usePlayer } from '../hooks/usePlayer';
import { useLikedSongsStore } from '../store/useLikedSongsStore';
import { Button } from '../components/ui/Button';
import { GenerateButton } from '../components/ui/generate-button';

const PRESET_PROMPTS = [
  { text: 'High-energy 80s synthwave workout mix for running', mood: 'Energetic', genre: 'Synthwave', duration: 45 },
  { text: 'Late night chill acoustic & lo-fi study session', mood: 'Chill', genre: 'Lofi', duration: 30 },
  { text: 'Rainy day melancholic indie rock & ambient soundscapes', mood: 'Melancholic', genre: 'Indie', duration: 40 },
  { text: 'Upbeat dance pop party hits for weekend vibes', mood: 'Upbeat', genre: 'Pop', duration: 60 },
  { text: 'Deep focus ambient & classical piano concentration', mood: 'Focus', genre: 'Ambient', duration: 45 },
];

const DURATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
];

const MOOD_OPTIONS = ['Any', 'Chill', 'Energetic', 'Focus', 'Melancholic', 'Upbeat', 'Workout', 'Party'];

const GENRE_OPTIONS = ['All', 'Synthwave', 'Pop', 'Rock', 'Hip-Hop', 'Indie', 'Electronic', 'Ambient', 'Jazz', 'Classical'];

const DISCOVERY_LEVELS = [
  { label: 'Familiar', value: 20, desc: 'Known hits & favorites' },
  { label: 'Balanced', value: 50, desc: 'Mix of hits & new tracks' },
  { label: 'High discovery', value: 80, desc: 'Fresh & adventurous' },
  { label: 'Maximum', value: 100, desc: 'Uncharted underground songs' },
];

const SEQUENCING_OPTIONS: { label: string; value: 'balanced' | 'energetic' | 'gradual' | 'discovery'; desc: string }[] = [
  { label: 'Balanced flow', value: 'balanced', desc: 'Seamless transitions with a hook opener' },
  { label: 'High momentum', value: 'energetic', desc: 'Front-loaded peak energy' },
  { label: 'Gradual warm-up', value: 'gradual', desc: 'Smooth ascending energy ramp' },
  { label: 'Discovery mix', value: 'discovery', desc: 'Interleaved familiar & novel tracks' },
];

const formatDuration = (seconds?: number): string => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const fallbackCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

export const AIPlaylistGeneratorPage: React.FC = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [selectedMood, setSelectedMood] = useState<string>('Any');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [discoveryLevel, setDiscoveryLevel] = useState<number>(50);
  const [sequencingStrategy, setSequencingStrategy] = useState<'balanced' | 'energetic' | 'gradual' | 'discovery'>('balanced');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DedicatedAIPlaylistResponseData | null>(null);
  const [activeTracks, setActiveTracks] = useState<GeneratedPlaylistTrackDTO[]>([]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { currentSong, isPlaying, playSong, togglePlay } = usePlayer();
  const { isLiked, toggleLikeSong } = useLikedSongsStore();

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    setError(null);
    setSaveSuccessId(null);
    setSaveError(null);

    const params: GenerateAIPlaylistRequestParams = {
      prompt: prompt.trim() || undefined,
      targetDurationMinutes: selectedDuration,
      mood: selectedMood !== 'Any' ? selectedMood : undefined,
      genre: selectedGenre !== 'All' ? selectedGenre : undefined,
      discoveryPercentage: discoveryLevel,
      sequencingStrategy,
    };

    const { result: apiResult, error: apiError } = await generateAIPlaylistApi(params);

    setLoading(false);

    if (apiError) {
      setError(apiError);
    } else if (apiResult) {
      setResult(apiResult);
      setActiveTracks(apiResult.tracks || []);
    }
  };

  const handlePresetClick = (preset: (typeof PRESET_PROMPTS)[0]) => {
    setPrompt(preset.text);
    setSelectedMood(preset.mood);
    setSelectedGenre(preset.genre);
    setSelectedDuration(preset.duration);
  };

  const handleRemoveTrack = (indexToRemove: number) => {
    setActiveTracks((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePlayAll = () => {
    if (activeTracks.length > 0) {
      const songList = activeTracks.map((t) => t.song);
      playSong(songList[0], songList);
    }
  };

  const handlePlayTrack = (track: GeneratedPlaylistTrackDTO) => {
    const songList = activeTracks.map((t) => t.song);
    if (currentSong?._id === track.song._id) {
      togglePlay();
    } else {
      playSong(track.song, songList);
    }
  };

  const handleSavePlaylist = async () => {
    if (!result || activeTracks.length === 0) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const { playlist, error: createError } = await createPlaylistApi({
        name: result.title || 'AI Generated Playlist',
        description: result.description || 'Curated with HarmonyAI',
        visibility: 'public',
      });

      if (createError || !playlist) {
        setSaveError(createError || 'Failed to save playlist');
        setIsSaving(false);
        return;
      }

      for (const track of activeTracks) {
        const songId = track.song._id ? String(track.song._id) : (track.song as any).id;
        if (songId) {
          await addSongToPlaylistApi(playlist._id, songId);
        }
      }

      setIsSaving(false);
      setSaveSuccessId(playlist._id);
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err.message || 'An unexpected error occurred while saving.');
    }
  };

  const currentTotalSeconds = activeTracks.reduce(
    (acc, t) => acc + (t.durationSeconds || t.song.duration || 210),
    0
  );
  const currentMins = Math.floor(currentTotalSeconds / 60);
  const currentSecs = currentTotalSeconds % 60;
  const liveDurationFormatted = `${currentMins}m ${currentSecs < 10 ? '0' : ''}${currentSecs}s`;

  return (
    <div className="max-w-4xl mx-auto pb-16 px-5 sm:px-8 pt-10">
      <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">AI Playlist Studio</p>
      <h1 className="font-display text-2xl sm:text-3xl text-text-primary leading-snug mt-3">
        Describe a moment. We'll sequence the soundtrack.
      </h1>
      <p className="text-sm text-text-secondary mt-2 max-w-xl">
        A mood, a place, an activity — write it in your own words and HarmonyAI will translate it into mood, energy,
        genre, and discovery targets, then sequence a playlist to match.
      </p>

      <form onSubmit={handleGenerate} className="mt-8 space-y-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Chill lofi synthwave for coding late at night with smooth transitions…"
          rows={3}
          className="w-full px-4 py-3.5 bg-surface-1 rounded-[var(--radius-md)] text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:ring-1 focus:ring-border-strong transition-shadow resize-none"
        />

        <div className="flex flex-wrap gap-1.5">
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className="px-4 py-2 rounded-[var(--radius-pill)] bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text-primary text-sm font-medium transition-all duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.45)] active:translate-y-0 active:scale-95 cursor-pointer"
            >
              {preset.text}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
          <div>
            <label className="block text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">Duration</label>
            <div className="grid grid-cols-5 gap-1 bg-surface-1 p-1 rounded-[var(--radius-sm)]">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedDuration(opt.value)}
                  className={`py-1.5 text-2xs font-medium rounded-[4px] transition-colors text-center cursor-pointer ${
                    selectedDuration === opt.value ? 'bg-accent text-text-on-accent font-semibold' : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">Mood</label>
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="w-full px-3 py-2 bg-surface-1 rounded-[var(--radius-sm)] text-text-secondary text-xs font-medium focus:outline-none cursor-pointer"
            >
              {MOOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-2">Genre</label>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="w-full px-3 py-2 bg-surface-1 rounded-[var(--radius-sm)] text-text-secondary text-xs font-medium focus:outline-none cursor-pointer"
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>{showAdvanced ? 'Hide fine-tuning' : 'Fine-tune discovery & flow'}</span>
          <ChevronDown size={13} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-[var(--radius-md)] bg-surface-1">
                <div>
                  <label className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary block mb-2">
                    Discovery level
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DISCOVERY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setDiscoveryLevel(level.value)}
                        className={`px-2.5 py-2 rounded-[var(--radius-sm)] text-left text-xs transition-colors cursor-pointer ${
                          discoveryLevel === level.value ? 'bg-gold-wash text-gold' : 'bg-surface-2 text-text-tertiary hover:text-text-secondary'
                        }`}
                      >
                        <div className="font-medium">{level.label}</div>
                        <div className="text-2xs opacity-70 mt-0.5 truncate">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary block mb-2">
                    Sequencing
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SEQUENCING_OPTIONS.map((seq) => (
                      <button
                        key={seq.value}
                        type="button"
                        onClick={() => setSequencingStrategy(seq.value)}
                        className={`px-2.5 py-2 rounded-[var(--radius-sm)] text-left text-xs transition-colors cursor-pointer ${
                          sequencingStrategy === seq.value ? 'bg-accent-wash text-accent' : 'bg-surface-2 text-text-tertiary hover:text-text-secondary'
                        }`}
                      >
                        <div className="font-medium">{seq.label}</div>
                        <div className="text-2xs opacity-70 mt-0.5 truncate">{seq.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-end pt-2">
          <GenerateButton type="submit" disabled={loading} isGenerating={loading} />
        </div>
      </form>

      {loading && (
        <div className="mt-10 rounded-[var(--radius-lg)] bg-surface-1 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent-wash text-accent flex items-center justify-center mx-auto">
            <RefreshCw size={20} className="animate-spin" />
          </div>
          <h3 className="font-display text-lg text-text-primary">Curating your playlist</h3>
          <p className="text-sm text-text-tertiary max-w-md mx-auto">
            Extracting acoustic preferences, scoring candidates against your taste, and sequencing for smooth
            transitions…
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="mt-8 p-4 bg-danger-wash rounded-[var(--radius-md)] text-danger text-sm">{error}</div>
      )}

      {result && !loading && (
        <div className="mt-10 space-y-6">
          <div className="space-y-4">
            <h2 className="font-display text-2xl text-text-primary">{result.title}</h2>
            <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">{result.description}</p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-surface-2 text-text-secondary">
                {activeTracks.length} tracks · {liveDurationFormatted}
              </span>
              {result.sequencingDiagnostics && (
                <span className="text-2xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-accent-wash text-accent capitalize">
                  {result.sequencingDiagnostics.strategy} flow
                </span>
              )}
              {result.diversityDiagnostics && (
                <span className="text-2xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-gold-wash text-gold">
                  {result.diversityDiagnostics.discoveryPercentage}% discovery
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button size="sm" onClick={handlePlayAll} disabled={activeTracks.length === 0}>
                <Play size={13} fill="currentColor" />
                Play all
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSavePlaylist}
                disabled={isSaving || activeTracks.length === 0 || Boolean(saveSuccessId)}
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-text-tertiary/30 border-t-text-primary rounded-full animate-spin" />
                    Saving…
                  </>
                ) : saveSuccessId ? (
                  <>
                    <Check size={13} className="text-success" />
                    <span className="text-success">Saved</span>
                  </>
                ) : (
                  <>
                    <Plus size={13} />
                    Save playlist
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => handleGenerate()}
                className="p-2 text-text-tertiary hover:text-text-primary rounded-[var(--radius-sm)] hover:bg-surface-2 transition-colors cursor-pointer"
                title="Regenerate with current settings"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            {saveSuccessId && (
              <div className="p-3 bg-success/10 rounded-[var(--radius-sm)] text-success text-xs flex items-center justify-between">
                <span>Saved to your music library.</span>
                <button onClick={() => navigate(`/playlists/${saveSuccessId}`)} className="font-semibold underline cursor-pointer">
                  View playlist →
                </button>
              </div>
            )}
            {saveError && <div className="p-3 bg-danger-wash rounded-[var(--radius-sm)] text-danger text-xs">{saveError}</div>}
          </div>

          <div className="rounded-[var(--radius-lg)] bg-surface-1 overflow-hidden">
            <div className="p-4 sm:p-5 flex items-center justify-between">
              <h3 className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">
                Sequenced tracks
              </h3>
              <span className="text-2xs text-text-tertiary">Acoustically matched for smooth flow</span>
            </div>

            <div className="divide-y divide-border-subtle">
              {activeTracks.map((item, index) => {
                const song = item.song;
                const isCurrent = currentSong?._id === song._id;
                const isPlayingThis = isCurrent && isPlaying;
                const liked = isLiked(song._id);
                const isDiscovery = typeof item.noveltyScore === 'number' && item.noveltyScore >= 0.7;

                return (
                  <div
                    key={song._id || index}
                    className={`group p-3.5 sm:p-4 flex items-center justify-between gap-4 transition-colors ${
                      isCurrent ? 'bg-accent-wash' : 'hover:bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative w-10 h-10 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0">
                        <img
                          src={song.coverImage || fallbackCover}
                          alt={song.title}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallbackCover;
                          }}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handlePlayTrack(item)}
                          className="absolute inset-0 bg-surface-0/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-text-primary transition-opacity cursor-pointer"
                        >
                          {isPlayingThis ? <Pause size={14} fill="currentColor" strokeWidth={0} /> : <Play size={14} fill="currentColor" strokeWidth={0} />}
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm truncate ${isCurrent ? 'text-accent' : 'text-text-primary'}`}>
                            {song.title}
                          </span>
                          {isDiscovery && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-gold-wash text-gold shrink-0">
                              <Sparkles size={9} />
                              Discovery
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-text-tertiary truncate mt-0.5">
                          <span>{item.artist || 'Unknown Artist'}</span>
                          <span>·</span>
                          <span>{item.genre || 'Music'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xs text-text-tertiary font-mono tabular-nums hidden sm:inline">
                        {item.durationFormatted || formatDuration(song.duration)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleLikeSong(song)}
                        className={`p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${liked ? 'text-accent' : 'text-text-tertiary hover:text-accent'}`}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <Heart size={14} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(index)}
                        className="p-1.5 text-text-tertiary hover:text-danger rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                        title="Remove track"
                      >
                        <X size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
