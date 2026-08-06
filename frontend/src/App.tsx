import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { MusicLibraryPage } from './pages/MusicLibraryPage';
import { SearchPage } from './pages/SearchPage';
import { LikedSongsPage } from './pages/LikedSongsPage';
import { HistoryPage } from './pages/HistoryPage';
import { SongDetailPage } from './pages/SongDetailPage';
import { ArtistDetailPage } from './pages/ArtistDetailPage';
import { AlbumDetailPage } from './pages/AlbumDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { useAuthStore } from './store/useAuthStore';
import { useLikedSongsStore } from './store/useLikedSongsStore';

function App() {
  const { fetchCurrentUser, isAuthenticated } = useAuthStore();
  const { fetchLikedSongs } = useLikedSongsStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLikedSongs();
    }
  }, [isAuthenticated, fetchLikedSongs]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Routes with Nested Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<MusicLibraryPage />} />
            <Route path="/liked-songs" element={<LikedSongsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/songs/:id" element={<SongDetailPage />} />
            <Route path="/artists/:id" element={<ArtistDetailPage />} />
            <Route path="/albums/:id" element={<AlbumDetailPage />} />
            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
