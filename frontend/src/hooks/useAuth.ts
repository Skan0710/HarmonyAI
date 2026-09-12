import { useAuthStore } from '../store/useAuthStore';

export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,
    login,
    register,
    logout,
    fetchCurrentUser,
    clearError,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,
    login,
    register,
    logout,
    fetchCurrentUser,
    clearError,
  };
};
