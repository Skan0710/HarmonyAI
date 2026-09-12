import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
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
import { RecommendationEvaluationDashboardPage } from './pages/RecommendationEvaluationDashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ThankYouPage } from './pages/ThankYouPage';
import { FaqPage } from './pages/FaqPage';
import { useAuthStore } from './store/useAuthStore';
import { useLikedSongsStore } from './store/useLikedSongsStore';
import { usePreferenceStore } from './store/usePreferenceStore';
import { GoogleAnalytics } from './components/GoogleAnalytics';

function App() {
  const { fetchCurrentUser, isAuthenticated } = useAuthStore();
  const { fetchLikedSongs } = useLikedSongsStore();
  const { fetchPreferences } = usePreferenceStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLikedSongs();
      fetchPreferences();
    }
  }, [isAuthenticated, fetchLikedSongs, fetchPreferences]);

  return (
    <BrowserRouter>
      <GoogleAnalytics />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/faq" element={<FaqPage />} />

        {/* Protected Routes with Nested Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
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
            <Route path="/albums/:id" element={<AlbumDetailPage />} />
            {/* Developer Diagnostic Dashboard */}
            <Route path="/admin/recommendations" element={<RecommendationEvaluationDashboardPage />} />
          </Route>
        </Route>

        {/* Public catch-all: unauthenticated visitors and crawlers hitting an
            unknown URL should see a real 404, not get redirected to /login. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
