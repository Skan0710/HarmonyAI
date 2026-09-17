import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Sparkles,
  Fingerprint,
  Compass,
  TrendingUp,
  LogIn,
  ChevronRight,
  Wand2,
  Heart,
  Volume2,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Zap,
  Menu,
  X,
  Search,
  Music,
  Check,
  SlidersHorizontal,
  Home,
  LayoutGrid,
  Library,
  ListMusic,
} from 'lucide-react';
import { AmbientBackground } from '../components/ui/AmbientBackground';
import { Wordmark } from '../components/Wordmark';
import { MediaCarousel } from '../components/MediaCarousel';
import { SongRow } from '../components/SongRow';
import { Meter } from '../components/ui/Meter';
import { Button } from '../components/ui/Button';
import { Seo } from '../components/Seo';
import { PublicFooter } from '../components/PublicFooter';
import { fetchTrendingSongsApi } from '../services/songService';
import { searchGlobal, type GroupedSearchResults } from '../services/searchService';
import { SearchSuggestionsDropdown } from '../components/SearchSuggestionsDropdown';
import { useAuthStore } from '../store/useAuthStore';
import type { Song } from '../types/music';

const getTimeGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good evening';
};

const WaveformMark: React.FC = () => (
  <svg viewBox="0 0 240 48" className="w-full h-auto" aria-hidden="true">
    {Array.from({ length: 48 }).map((_, i) => {
      const heights = [10, 22, 14, 34, 18, 44, 26, 16, 30, 12, 38, 20];
      const h = heights[i % heights.length];
      return (
        <rect
          key={i}
          x={i * 5}
          y={(48 - h) / 2}
          width={2.4}
          height={h}
          rx={1.2}
          fill="currentColor"
          opacity={0.18 + (i % 5) * 0.07}
        />
      );
    })}
  </svg>
);

const FALLBACK_DEMO_TRACKS: Song[] = [
  {
    _id: 'a7d61fbb-1e4c-45f6-9748-a7710e8c340c',
    title: 'Rockstar Made',
    artist: { _id: 'artist-playboi-carti', id: 'artist-playboi-carti', name: 'Playboi Carti' } as any,
    album: { _id: 'album-whole-lotta-red', id: 'album-whole-lotta-red', title: 'Whole Lotta Red' } as any,
    genre: { _id: 'genre-hip-hop', id: 'genre-hip-hop', name: 'Hip-Hop' } as any,
    duration: 194,
    playCount: 14230,
    coverImage: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ba/1e/05/ba1e058e-5637-e53c-563c-f5b9a1a6c344/20UM1IM18331.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    _id: '3ee1daa4-9a71-4174-aaa6-b18fc74638c0',
    title: 'I Knew It, I Knew You',
    artist: { _id: 'artist-taylor-swift', id: 'artist-taylor-swift', name: 'Taylor Swift' } as any,
    album: { _id: 'album-toy-story-5', id: 'album-toy-story-5', title: 'I Knew It, I Knew You - Single' } as any,
    genre: { _id: 'genre-pop', id: 'genre-pop', name: 'Pop' } as any,
    duration: 176,
    playCount: 28400,
    coverImage: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/38/e4/6d/38e46daf-d479-996a-118f-0357082b1941/26UMGIM72467.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    _id: '022e8f1e-47a1-4d55-aaab-2d823aba833f',
    title: 'ILoveUIHateU',
    artist: { _id: 'artist-playboi-carti', id: 'artist-playboi-carti', name: 'Playboi Carti' } as any,
    album: { _id: 'album-whole-lotta-red', id: 'album-whole-lotta-red', title: 'Whole Lotta Red' } as any,
    genre: { _id: 'genre-hip-hop', id: 'genre-hip-hop', name: 'Hip-Hop' } as any,
    duration: 135,
    playCount: 19820,
    coverImage: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ba/1e/05/ba1e058e-5637-e53c-563c-f5b9a1a6c344/20UM1IM18331.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    _id: '061517d7-0630-427d-b499-a7347f2dda28',
    title: 'the ends',
    artist: { _id: 'artist-travis-scott', id: 'artist-travis-scott', name: 'Travis Scott' } as any,
    album: { _id: 'album-birds-in-the-trap', id: 'album-birds-in-the-trap', title: 'Birds In The Trap Sing McKnight' } as any,
    genre: { _id: 'genre-hip-hop', id: 'genre-hip-hop', name: 'Hip-Hop' } as any,
    duration: 201,
    playCount: 42100,
    coverImage: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/50/f7/a3/50f7a39d-3bd5-28e9-0264-532f08b5b810/886446074726.jpg/600x600bb.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
  {
    _id: '87c51bba-bf1f-4163-a1c7-240ed84cc128',
    title: '2024',
    artist: { _id: 'artist-playboi-carti', id: 'artist-playboi-carti', name: 'Playboi Carti' } as any,
    album: { _id: 'album-music-sorry-4-da-wait', id: 'album-music-sorry-4-da-wait', title: 'MUSIC - SORRY 4 DA WAIT' } as any,
    genre: { _id: 'genre-hip-hop', id: 'genre-hip-hop', name: 'Hip-Hop' } as any,
    duration: 209,
    playCount: 16750,
    coverImage: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fe/fc/f3/fefcf31a-4a86-9cc7-8e8e-9b777e6c6a40/25UMGIM46212.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
  {
    _id: 'ba02ce9f-92ff-48d9-bef2-5de1be6d5c3d',
    title: 'COCAINE NOSE',
    artist: { _id: 'artist-playboi-carti', id: 'artist-playboi-carti', name: 'Playboi Carti' } as any,
    album: { _id: 'album-music-sorry-4-da-wait', id: 'album-music-sorry-4-da-wait', title: 'MUSIC - SORRY 4 DA WAIT' } as any,
    genre: { _id: 'genre-hip-hop', id: 'genre-hip-hop', name: 'Hip-Hop' } as any,
    duration: 151,
    playCount: 31050,
    coverImage: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fe/fc/f3/fefcf31a-4a86-9cc7-8e8e-9b777e6c6a40/25UMGIM46212.rgb.jpg/600x600bb.jpg',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
];

const AI_PROMPT_PREVIEWS = [
  {
    prompt: 'Rainy Sunday morning neo-soul with warm Rhodes & slow tempo',
    title: 'Sunday Morning Solitude',
    trackCount: 12,
    vibe: 'Warm & Contemplative',
    genres: ['Neo-Soul', 'Lo-Fi Jazz', 'Warm Rhodes'],
  },
  {
    prompt: 'Late night coding sprint — deep synthwave and driving basslines',
    title: 'Syntax & Neon',
    trackCount: 16,
    vibe: 'Hyperfocus & Kinetic',
    genres: ['Synthwave', 'Dark Electro', 'Cyberpunk'],
  },
  {
    prompt: 'Golden hour sunset transition from acoustic indie into deep ambient',
    title: 'Amber Horizon Drift',
    trackCount: 14,
    vibe: 'Ethereal & Melodic',
    genres: ['Indie Folk', 'Ambient Electronic', 'Downtempo'],
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading: authLoading } = useAuthStore();

  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState<boolean>(true);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  // Sign-in modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [selectedSongForAuth, setSelectedSongForAuth] = useState<Song | null>(null);

  // Navbar search state
  const [navSearch, setNavSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<GroupedSearchResults | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // AI Prompt interactive glimpse
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number>(0);

  // Load public trending songs
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingSongs(true);
      try {
        const res = await fetchTrendingSongsApi(10);
        if (isMounted) {
          if (res.songs && res.songs.length > 0) {
            setTrendingSongs(res.songs);
          } else {
            setTrendingSongs(FALLBACK_DEMO_TRACKS);
          }
        }
      } catch {
        if (isMounted) {
          setTrendingSongs(FALLBACK_DEMO_TRACKS);
        }
      } finally {
        if (isMounted) setLoadingSongs(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Search autocomplete
  useEffect(() => {
    const trimmed = navSearch.trim();
    if (!trimmed) {
      setSearchSuggestions(null);
      setIsSearchLoading(false);
      return;
    }

    setIsSearchLoading(true);
    const handler = setTimeout(async () => {
      try {
        const { results } = await searchGlobal(trimmed, 5);
        setSearchSuggestions(results);
      } catch {
        setSearchSuggestions(null);
      } finally {
        setIsSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [navSearch]);

  // Handle outside click for search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Intercept Play attempt on any song
  const handlePlayAttempt = (song?: Song) => {
    setSelectedSongForAuth(song || trendingSongs[0] || FALLBACK_DEMO_TRACKS[0]);
    setIsAuthModalOpen(true);
  };

  // Quick Demo Login from modal
  const handleQuickDemoLogin = async () => {
    const success = await login({ email: 'demo@harmonyai.com', password: 'password123' });
    if (success) {
      setIsAuthModalOpen(false);
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  const activeSongs = trendingSongs.length > 0 ? trendingSongs : FALLBACK_DEMO_TRACKS;
  const currentPreviewSong = selectedSongForAuth || activeSongs[0];

  const getArtistName = (song: Song): string => {
    if (!song.artist) return 'HarmonyAI Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) {
      return song.artist.name;
    }
    return String(song.artist);
  };

  return (
    <div className="flex flex-col min-h-screen text-text-primary bg-surface-0 relative selection:bg-accent/20 selection:text-accent">
      <AmbientBackground />
      <Seo
        title="HarmonyAI — Intelligent AI Music Discovery & Music DNA"
        description="Experience personalized AI music streaming, subconscious Music DNA profiling, and global Music Twin matching with HarmonyAI."
        path="/"
      />

      {/* Main Navigation Bar - Clean guest state showing no user and login option on top */}
      <header className="h-16 bg-surface-1/90 backdrop-blur-md border-b border-border-subtle flex items-center gap-3 px-4 sm:px-6 sticky top-0 z-30">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          className="md:hidden p-1.5 -ml-1 text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <Menu size={20} />
        </button>

        <Wordmark className="text-lg shrink-0" />

        {/* Global Search Bar - Responsive */}
        <div ref={searchContainerRef} className="hidden sm:block relative flex-1 max-w-lg mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (navSearch.trim()) {
                setIsAuthModalOpen(true);
              }
            }}
            className="relative"
          >
            <Search
              size={15}
              strokeWidth={1.75}
              className="text-text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search songs, artists, albums, or moods…"
              className="w-full bg-surface-2 text-text-primary placeholder-text-tertiary pl-10 pr-4 py-2 rounded-[var(--radius-pill)] text-sm border border-transparent focus:outline-none focus:border-border-strong transition-colors"
            />
            {isSearchLoading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            )}
          </form>

          {isSearchFocused && (
            <SearchSuggestionsDropdown
              query={navSearch}
              suggestions={searchSuggestions}
              loading={isSearchLoading}
              onSelectSearch={() => setIsAuthModalOpen(true)}
              onClose={() => setIsSearchFocused(false)}
            />
          )}
        </div>

        {/* Mobile Search Trigger Icon */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="sm:hidden p-2 text-text-secondary hover:text-text-primary ml-auto cursor-pointer"
          aria-label="Search songs and artists"
          title="Search"
        >
          <Search size={18} strokeWidth={1.75} />
        </button>

        {/* Guest Auth Options on Top */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          <button
            onClick={() => navigate('/login')}
            className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            Log In
          </button>
          <Button
            size="sm"
            onClick={() => navigate('/register')}
            className="text-xs px-3 py-1.5"
          >
            Register
          </Button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-1 bg-[radial-gradient(circle_420px_at_15%_-5%,rgba(255,106,67,0.16),transparent),radial-gradient(circle_360px_at_100%_100%,rgba(217,161,91,0.12),transparent)] border-r border-border-subtle pt-5 select-none">
          <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
            <div>
              <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Listen
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium bg-accent-wash text-text-primary w-full text-left"
                >
                  <Home size={18} strokeWidth={1.75} className="text-accent" />
                  <span>Home</span>
                </button>
                <button
                  onClick={() => handlePlayAttempt()}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Compass size={18} strokeWidth={1.75} />
                  <span>Discover</span>
                </button>
                <button
                  onClick={() => handlePlayAttempt()}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <LayoutGrid size={18} strokeWidth={1.75} />
                  <span>Browse Genres</span>
                </button>
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Your Sound
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    const el = document.getElementById('music-dna-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Fingerprint size={18} strokeWidth={1.75} />
                  <span>Music DNA</span>
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('music-twin-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Compass size={18} strokeWidth={1.75} />
                  <span>Music Twin</span>
                </button>
                <button
                  onClick={() => {
                    const el = document.getElementById('taste-evolution-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Sparkles size={18} strokeWidth={1.75} />
                  <span>Taste Evolution</span>
                </button>
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Create & AI
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    const el = document.getElementById('ai-playlist-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Wand2 size={18} strokeWidth={1.75} className="text-gold" />
                  <span>AI Playlist Generator</span>
                </button>
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Library
              </p>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handlePlayAttempt()}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Library size={18} strokeWidth={1.75} />
                  <span>Music Library</span>
                </button>
                <button
                  onClick={() => handlePlayAttempt()}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <ListMusic size={18} strokeWidth={1.75} />
                  <span>Playlists</span>
                </button>
                <button
                  onClick={() => handlePlayAttempt()}
                  className="flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 rounded-[var(--radius-sm)] text-[15px] font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary w-full text-left transition-colors"
                >
                  <Heart size={18} strokeWidth={1.75} />
                  <span>Liked Songs</span>
                </button>
              </div>
            </div>
          </nav>

          <div className="px-3 pb-5 pt-2 border-t border-border-subtle">
            <button
              onClick={() => handlePlayAttempt()}
              className="w-full flex items-center gap-3.5 pl-3.5 pr-3 py-2.5 text-[15px] font-medium rounded-[var(--radius-sm)] text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
            >
              <SlidersHorizontal size={18} strokeWidth={1.75} />
              <span>Preferences</span>
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setMobileNavOpen(false)}
                className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col bg-surface-1 border-r border-border-subtle"
              >
                <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border-subtle">
                  <Wordmark className="text-lg" />
                  <button
                    onClick={() => setMobileNavOpen(false)}
                    aria-label="Close navigation"
                    className="p-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Demo Navigation</p>
                  <button
                    onClick={() => {
                      setMobileNavOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-3 w-full py-2 text-text-primary font-medium"
                  >
                    <Home size={18} className="text-accent" />
                    <span>Home</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileNavOpen(false);
                      document.getElementById('music-dna-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-3 w-full py-2 text-text-secondary font-medium"
                  >
                    <Fingerprint size={18} />
                    <span>Music DNA</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileNavOpen(false);
                      document.getElementById('ai-playlist-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-3 w-full py-2 text-text-secondary font-medium"
                  >
                    <Wand2 size={18} className="text-gold" />
                    <span>AI Playlist Generator</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileNavOpen(false);
                      navigate('/login');
                    }}
                    className="flex items-center gap-3 w-full py-2 text-accent font-semibold"
                  >
                    <LogIn size={18} />
                    <span>Sign In to Your Account</span>
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-36">
          {/* Hero Section — Exact match to HomePage aesthetic */}
          <section className="relative overflow-hidden border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8 bg-[radial-gradient(ellipse_600px_350px_at_50%_0%,rgba(255,106,67,0.12),transparent)]">
            <div className="relative max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[var(--radius-pill)] bg-accent-wash text-accent text-xs font-semibold mb-4 border border-accent/20">
                <Sparkles size={13} strokeWidth={2} />
                <span>AI-Powered Music Discovery</span>
              </div>

              <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">
                {getTimeGreeting()} · Welcome to HarmonyAI
              </p>

              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="font-display text-3xl sm:text-4xl lg:text-5xl text-text-primary leading-tight mt-3 font-normal"
              >
                Your sound right now leans <span className="italic text-accent">Melodic Trap</span>, anchored in <span className="italic text-gold">Hip-Hop & Pop</span>.
              </motion.h1>

              <p className="text-sm sm:text-base text-text-secondary mt-4 max-w-xl mx-auto leading-relaxed">
                HarmonyAI analyzes subconscious psychoacoustic features across your listening habits to generate your real-time Music DNA, match your Musical Twin, and synthesize tailor-made soundscapes.
              </p>

              {/* Primary Call-to-Actions in Hero */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => handlePlayAttempt(activeSongs[0])}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-pill)] bg-accent hover:bg-accent-strong text-text-on-accent font-semibold text-sm transition-transform active:scale-95 shadow-md cursor-pointer"
                >
                  <Play size={16} fill="currentColor" strokeWidth={0} />
                  <span>Play Music</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('music-dna-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-pill)] bg-surface-2 hover:bg-surface-3 text-text-primary border border-border-default hover:border-border-strong text-sm font-medium transition-colors cursor-pointer"
                >
                  <Fingerprint size={16} className="text-accent" strokeWidth={1.75} />
                  <span>Explore Music DNA</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-pill)] bg-surface-1 hover:bg-surface-2 text-text-secondary hover:text-text-primary border border-border-subtle text-sm font-medium transition-colors cursor-pointer"
                >
                  <LogIn size={15} strokeWidth={1.75} />
                  <span>Log In</span>
                </button>
              </div>
            </div>

            {/* Subtle waveform footer mark */}
            <div className="relative h-10 mt-8 -mx-5 sm:-mx-8 lg:-mx-12 text-accent pointer-events-none opacity-60">
              <WaveformMark />
            </div>
          </section>

          {/* Glimpse Content Sections */}
          <div className="px-5 sm:px-8 lg:px-12 pt-10 space-y-14 max-w-7xl mx-auto">
            {/* Glimpse 1: "Made for you" Carousel */}
            <section>
              <MediaCarousel
                title="Made for you"
                subtitle="A glimpse of personalized recommendations ranked from acoustic taste and community signal"
                type="song"
                items={activeSongs}
                loading={loadingSongs}
                onPlaySong={(song) => handlePlayAttempt(song)}
              />
            </section>

            {/* Glimpse 2: Music DNA Glimpse */}
            <section
              id="music-dna-section"
              className="bg-surface-1 rounded-[var(--radius-lg)] p-6 sm:p-8 border border-border-subtle relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="max-w-xl">
                  <p className="text-xs font-semibold text-accent uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <Fingerprint size={14} strokeWidth={2} />
                    Glimpse: Subconscious Music DNA
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl text-text-primary mt-2">
                    Archetype: <span className="italic text-accent">The Rhythmic Innovator</span>
                  </h2>
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                    HarmonyAI computes your acoustic profile across 12 psychological dimensions. Notice how your high energy and rhythmic cadence balance dynamic vocal presence.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {['Hip-Hop', 'Pop', 'Trap', 'Electronic'].map((genre) => (
                      <span
                        key={genre}
                        className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-surface-2 text-text-secondary border border-border-subtle"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={() => handlePlayAttempt()}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-strong cursor-pointer"
                    >
                      <span>Unlock full DNA constellation</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

                {/* Live Acoustic Meters */}
                <div className="lg:w-80 bg-surface-2/80 backdrop-blur-md rounded-[var(--radius-md)] p-5 border border-border-subtle space-y-4">
                  <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
                    Acoustic Feature Breakdown
                  </p>
                  <Meter label="Energy" value={0.68} size="sm" color="var(--accent)" />
                  <Meter label="Valence (Mood)" value={0.74} size="sm" color="var(--gold)" />
                  <Meter label="Acousticness" value={0.52} size="sm" color="var(--success)" />
                  <Meter label="Danceability" value={0.79} size="sm" color="var(--accent-strong)" />
                  <Meter label="Instrumentalness" value={0.45} size="sm" color="var(--gold-strong)" />
                </div>
              </div>
            </section>

            {/* Glimpse 3: Personal Music Twin */}
            <section
              id="music-twin-section"
              className="bg-surface-1 rounded-[var(--radius-lg)] p-6 sm:p-8 border border-border-subtle"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-gold uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <Compass size={14} strokeWidth={2} />
                    Glimpse: Personal Music Twin
                  </p>
                  <h2 className="font-display italic text-2xl sm:text-3xl text-text-primary mt-2">
                    The Midnight Dreamer
                  </h2>
                  <p className="text-sm text-text-secondary mt-1 max-w-xl">
                    "Late night sonic architectures and contemplative rhythms that reward patient listeners."
                  </p>
                </div>
                <button
                  onClick={() => handlePlayAttempt()}
                  className="text-sm font-medium text-gold hover:text-gold-strong shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <span>Meet your global twin</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-5">
                {['#LateNight', '#Ethereal', '#Textured', '#DeepFocus', '#WarmRhodes', '#AmbientGlow'].map((kw) => (
                  <span
                    key={kw}
                    className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-surface-2 text-text-secondary"
                  >
                    {kw}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 mt-6 max-w-md">
                <Meter label="Twin Match Confidence" value={0.94} size="sm" color="var(--accent)" />
                <Meter label="Exploration Tendency" value={0.78} size="sm" color="var(--gold)" />
                <Meter label="Taste Stability" value={0.88} size="sm" color="var(--success)" />
              </div>
            </section>

            {/* Glimpse 4: AI Playlist Generator Interactive Showcase */}
            <section
              id="ai-playlist-section"
              className="border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-8 bg-surface-1/60 relative overflow-hidden"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-gold uppercase tracking-[0.14em] mb-2">
                <Wand2 size={14} strokeWidth={2} />
                <span>Glimpse: Natural Language AI Playlist Engine</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl text-text-primary">
                Describe a mood, setting, or sound. AI curates the rest.
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Try clicking one of the sample prompts below to preview how our intelligent audio synthesis curates custom playlists:
              </p>

              {/* Interactive prompt selector buttons */}
              <div className="flex flex-wrap gap-2 mt-5">
                {AI_PROMPT_PREVIEWS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPromptIdx(idx)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-[var(--radius-pill)] transition-all cursor-pointer text-left ${
                      selectedPromptIdx === idx
                        ? 'bg-gold text-text-on-accent font-semibold shadow-xs'
                        : 'bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3'
                    }`}
                  >
                    "{item.prompt}"
                  </button>
                ))}
              </div>

              {/* Preview of AI output card */}
              <div className="mt-5 p-4 sm:p-5 rounded-[var(--radius-md)] bg-surface-2/90 border border-border-subtle max-w-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3">
                  <div>
                    <h4 className="text-base font-semibold text-text-primary">
                      {AI_PROMPT_PREVIEWS[selectedPromptIdx].title}
                    </h4>
                    <p className="text-xs text-text-tertiary">
                      {AI_PROMPT_PREVIEWS[selectedPromptIdx].trackCount} tracks · Vibe: {AI_PROMPT_PREVIEWS[selectedPromptIdx].vibe}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePlayAttempt()}
                    className="px-3 py-1.5 rounded-[var(--radius-pill)] bg-accent hover:bg-accent-strong text-text-on-accent text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Play size={13} fill="currentColor" strokeWidth={0} />
                    <span>Play Mix</span>
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {AI_PROMPT_PREVIEWS[selectedPromptIdx].genres.map((g) => (
                    <span
                      key={g}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-[var(--radius-sharp)] bg-surface-1 text-gold"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Glimpse 5: Taste Evolution Narrative */}
            <section
              id="taste-evolution-section"
              className="border-l-2 border-gold pl-5 sm:pl-7 py-2"
            >
              <h2 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
                <Sparkles size={16} className="text-gold" strokeWidth={1.75} />
                Your taste is changing
              </h2>
              <p className="font-display text-lg sm:text-xl text-text-primary leading-relaxed mt-2 max-w-2xl">
                "Over the past 30 days, your listening shifted +34% toward Hip-Hop and Melodic Trap, with rising rhythmic resonance and dynamic energy."
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {['Hip-Hop (+34%)', 'Pop (+18%)', 'Electronic (+12%)'].map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium px-2.5 py-1 rounded-[var(--radius-pill)] bg-gold-wash text-gold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            {/* Glimpse 6: Trending Songs List (SongRow components) */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary font-body flex items-center gap-2">
                    <TrendingUp size={16} className="text-accent" strokeWidth={1.75} />
                    Trending Community Tracks
                  </h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Top streaming picks across HarmonyAI right now</p>
                </div>
                <button
                  onClick={() => handlePlayAttempt()}
                  className="text-xs font-medium text-text-secondary hover:text-accent cursor-pointer"
                >
                  View full chart
                </button>
              </div>

              <div className="divide-y divide-border-subtle bg-surface-1/40 rounded-[var(--radius-md)] p-2 border border-border-subtle">
                {activeSongs.slice(0, 5).map((song, i) => (
                  <SongRow
                    key={song._id}
                    song={song}
                    index={i}
                    onPlay={() => handlePlayAttempt(song)}
                  />
                ))}
              </div>
            </section>
          </div>

          <PublicFooter />
        </main>
      </div>

      {/* Simulated MiniPlayer Bar at the Bottom — Exact Visual Match */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1/95 border-t border-border-subtle backdrop-blur-xl px-3 py-2.5 sm:px-5 sm:py-3 select-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-6">
          {/* Metadata preview */}
          <div className="flex items-center gap-3 w-full sm:w-1/4 min-w-0">
            <div
              onClick={() => handlePlayAttempt(currentPreviewSong)}
              className="w-11 h-11 rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 shrink-0 relative cursor-pointer group"
            >
              <img
                src={currentPreviewSong.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300'}
                alt={currentPreviewSong.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play size={14} fill="currentColor" className="text-white ml-0.5" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h4
                onClick={() => handlePlayAttempt(currentPreviewSong)}
                className="text-sm font-semibold text-text-primary truncate hover:text-accent cursor-pointer"
              >
                {currentPreviewSong.title}
              </h4>
              <p className="text-xs text-text-tertiary truncate mt-0.5">
                {getArtistName(currentPreviewSong)}
              </p>
            </div>
            <button
              onClick={() => handlePlayAttempt(currentPreviewSong)}
              className="w-7 h-7 rounded-full text-text-tertiary hover:text-accent flex items-center justify-center cursor-pointer transition-colors"
              title="Like song"
            >
              <Heart size={16} strokeWidth={1.75} />
            </button>
          </div>

          {/* Player controls */}
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-2/4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePlayAttempt(currentPreviewSong)}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full cursor-pointer transition-colors"
                title="Shuffle"
              >
                <Shuffle size={15} strokeWidth={1.75} />
              </button>
              <button
                onClick={() => handlePlayAttempt(currentPreviewSong)}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full cursor-pointer transition-colors"
                title="Previous Track"
              >
                <SkipBack size={17} strokeWidth={1.75} fill="currentColor" />
              </button>

              {/* Big central play button */}
              <button
                onClick={() => handlePlayAttempt(currentPreviewSong)}
                className="w-10 h-10 rounded-full bg-accent hover:bg-accent-strong text-text-on-accent flex items-center justify-center transition-transform active:scale-90 shadow-md cursor-pointer"
                title="Play track (Requires Sign In)"
              >
                <Play size={18} fill="currentColor" strokeWidth={0} className="ml-0.5" />
              </button>

              <button
                onClick={() => handlePlayAttempt(currentPreviewSong)}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full cursor-pointer transition-colors"
                title="Next Track"
              >
                <SkipForward size={17} strokeWidth={1.75} fill="currentColor" />
              </button>
              <button
                onClick={() => handlePlayAttempt(currentPreviewSong)}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full cursor-pointer transition-colors"
                title="Repeat"
              >
                <Repeat size={15} strokeWidth={1.75} />
              </button>
            </div>

            {/* Simulated progress scrubber */}
            <div
              onClick={() => handlePlayAttempt(currentPreviewSong)}
              className="flex items-center gap-2.5 w-full text-2xs text-text-tertiary font-mono tabular-nums cursor-pointer"
            >
              <span>0:00</span>
              <div className="relative flex-1 h-1.5 bg-white/20 hover:bg-white/30 rounded-full overflow-hidden">
                <div className="w-1/3 h-full bg-accent rounded-full" />
              </div>
              <span>3:48</span>
            </div>
          </div>

          {/* Volume and info */}
          <div className="hidden sm:flex items-center justify-end gap-3 w-1/4">
            <Volume2 size={16} className="text-text-tertiary" />
            <div
              onClick={() => handlePlayAttempt(currentPreviewSong)}
              className="w-20 h-1.5 bg-white/20 hover:bg-white/30 rounded-full cursor-pointer overflow-hidden"
            >
              <div className="w-4/5 h-full bg-accent rounded-full" />
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-2.5 py-1 text-xs font-semibold text-accent hover:text-accent-strong transition-colors cursor-pointer"
            >
              Log In
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LOG IN TO LISTEN MODAL (Intercepts all playback actions on the landing page) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-surface-1 border border-border-default rounded-[var(--radius-lg)] p-5 sm:p-7 shadow-2xl z-10 space-y-4 sm:space-y-5 text-left max-h-[88dvh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-wash text-accent flex items-center justify-center shrink-0">
                  <Music size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary font-body">
                    Log in to listen to music
                  </h3>
                  <p className="text-xs text-text-tertiary">
                    Please log in or create an account to start streaming music
                  </p>
                </div>
              </div>

              {/* Clicked Song Card Glimpse */}
              {selectedSongForAuth && (
                <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-[var(--radius-md)] border border-border-subtle">
                  <img
                    src={selectedSongForAuth.coverImage || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200'}
                    alt={selectedSongForAuth.title}
                    className="w-12 h-12 rounded-[var(--radius-artwork)] object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {selectedSongForAuth.title}
                    </p>
                    <p className="text-2xs text-text-tertiary truncate">
                      {getArtistName(selectedSongForAuth)}
                    </p>
                  </div>
                  <span className="text-2xs font-medium px-2 py-0.5 rounded-[var(--radius-pill)] bg-accent/15 text-accent shrink-0">
                    Full Track
                  </span>
                </div>
              )}

              {/* Feature Highlights */}
              <div className="space-y-2 py-1">
                {[
                  'Full high-fidelity YouTube Music streaming & background playback',
                  'Subconscious Music DNA profiling & acoustic habit tracking',
                  'Natural language AI playlist generator & smart assistant',
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-text-secondary">
                    <Check size={15} className="text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <Button
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-sm font-semibold h-11"
                >
                  <LogIn size={15} strokeWidth={2} />
                  <span>Log In to Your Account</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    navigate('/register');
                  }}
                  className="w-full py-2.5 px-4 rounded-[var(--radius-pill)] bg-surface-2 hover:bg-surface-3 text-text-primary border border-border-default text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Create Free Account</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickDemoLogin}
                  disabled={authLoading}
                  className="w-full py-2 text-[11px] text-text-tertiary hover:text-accent font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Zap size={12} className="text-gold" />
                  <span>{authLoading ? 'Logging in...' : 'Or try 1-Click Demo Login'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
