import { useAuthStore } from '../store/useAuthStore';

export const useAuth = () => {
  const {
    user,
    token,
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
    token,
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
