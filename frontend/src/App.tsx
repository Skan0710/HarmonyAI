import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MusicDnaPage } from './pages/MusicDnaPage';
import { MusicTwinPage } from './pages/MusicTwinPage';
import { TasteEvolutionPage } from './pages/TasteEvolutionPage';
import { MusicLibraryPage } from './pages/MusicLibraryPage';
import { SearchPage } from './pages/SearchPage';
import { GenresPage } from './pages/GenresPage';
import { PlaylistsPage } from './pages/PlaylistsPage';
import { PlaylistDetailPage } from './pages/PlaylistDetailPage';
import { AIPlaylistGeneratorPage } from './pages/AIPlaylistGeneratorPage';
import { AssistantPage } from './pages/AssistantPage';
import { PreferencesPage } from './pages/PreferencesPage';
import { ProfilePage } from './pages/ProfilePage';
import { LikedSongsPage } from './pages/LikedSongsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SongDetailPage } from './pages/SongDetailPage';
import { ArtistDetailPage } from './pages/ArtistDetailPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { AlbumsPage } from './pages/AlbumsPage';
import { ToastContainer } from './components/ui/Toast';
import { SongContextMenu } from './components/SongContextMenu';
import { RecommendationEvaluationDashboardPage } from './pages/RecommendationEvaluationDashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ThankYouPage } from './pages/ThankYouPage';
import { FaqPage } from './pages/FaqPage';
import { LandingPage } from './pages/LandingPage';
import { useAuthStore } from './store/useAuthStore';
import { useLikedSongsStore } from './store/useLikedSongsStore';
import { usePreferenceStore } from './store/usePreferenceStore';
import { GoogleAnalytics } from './components/GoogleAnalytics';

import { MiniPlayer } from './components/MiniPlayer';
import { QueueDrawer } from './components/QueueDrawer';
import { FullPlayer } from './components/FullPlayer';
import { CommandPalette } from './components/CommandPalette';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { usePlayerStore } from './store/usePlayerStore';

function App() {
  const { fetchCurrentUser, isAuthenticated, isInitializing } = useAuthStore();
  const { fetchLikedSongs } = useLikedSongsStore();
  const { fetchPreferences } = usePreferenceStore();
  const isFullPlayerOpen = usePlayerStore((state) => state.isFullPlayerOpen);
  const setFullPlayerOpen = usePlayerStore((state) => state.setFullPlayerOpen);

  useEffect(() => {
    // Extract token if redirected from OAuth provider
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        localStorage.setItem('harmonyai_token', token);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('token');
        window.history.replaceState({}, document.title, newUrl.pathname + (newUrl.search ? newUrl.search : ''));
      }
    }

    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLikedSongs();
      fetchPreferences();
    }
  }, [isAuthenticated, fetchLikedSongs, fetchPreferences]);

  return (
    <AppErrorBoundary>
    <BrowserRouter>
      <GoogleAnalytics />
      <Routes>
        {/* Unauthenticated Landing / Demo Route for visitors */}
        {!isAuthenticated && (
          <Route
            path="/"
            element={
              isInitializing ? (
                <div className="flex items-center justify-center min-h-screen bg-surface-0 text-text-tertiary">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                </div>
              ) : (
                <LandingPage />
              )
            }
          />
        )}

        {/* Public Routes */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/faq" element={<FaqPage />} />

        {/* Protected Routes with Unified Nested Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/music-dna" element={<MusicDnaPage />} />
            <Route path="/music-twin" element={<MusicTwinPage />} />
            <Route path="/taste-evolution" element={<TasteEvolutionPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/genres" element={<GenresPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:id" element={<PlaylistDetailPage />} />
            <Route path="/ai-playlist" element={<AIPlaylistGeneratorPage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/library" element={<MusicLibraryPage />} />
            <Route path="/liked-songs" element={<LikedSongsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/songs/:id" element={<SongDetailPage />} />
            <Route path="/artists/:id" element={<ArtistDetailPage />} />
            <Route path="/albums" element={<AlbumsPage />} />
            <Route path="/albums/:id" element={<AlbumDetailPage />} />
            {/* Developer Diagnostic Dashboard */}
            <Route element={<AdminRoute />}>
              <Route path="/admin/recommendations" element={<RecommendationEvaluationDashboardPage />} />
            </Route>
          </Route>
        </Route>

        {/* Public catch-all: unauthenticated visitors and crawlers hitting an
            unknown URL should see a real 404, not get redirected to /login. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <MiniPlayer onExpand={() => setFullPlayerOpen(true)} />
      <QueueDrawer />
      <FullPlayer isOpen={isFullPlayerOpen} onClose={() => setFullPlayerOpen(false)} />
      <CommandPalette />
      <KeyboardShortcutsModal />
      <ToastContainer />
      <SongContextMenu />
    </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
