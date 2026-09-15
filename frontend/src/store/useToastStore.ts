import { create } from 'zustand';
import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  icon?: React.ReactNode;
  duration: number;
  action?: ToastAction;
}

export interface ToastOptions {
  type?: ToastType;
  icon?: React.ReactNode;
  duration?: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, options) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastItem = {
      id,
      message,
      type: options?.type || 'info',
      icon: options?.icon,
      duration: options?.duration ?? (options?.action ? 4500 : 3200),
      action: options?.action,
    };

    set((state) => ({
      toasts: [...state.toasts.slice(-4), toast],
    }));

    if (toast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, toast.duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const toast = {
  success: (message: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(message, { ...options, type: 'success' }),
  error: (message: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(message, { ...options, type: 'error' }),
  info: (message: string, options?: Omit<ToastOptions, 'type'>) =>
    useToastStore.getState().addToast(message, { ...options, type: 'info' }),
};
