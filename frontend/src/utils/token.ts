const TOKEN_KEY = 'harmonyai_token';

export const getToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token !== 'undefined' && token !== 'null' ? token : null;
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

export const hasToken = (): boolean => {
  return !!getToken();
};
