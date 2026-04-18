/**
 * toast.store.ts
 * Global queue for in-app activity banners (toasts).
 *
 * Usage:
 *   const show = useToastStore((s) => s.show);
 *   show({ title: 'Bus departed', body: '7:42 AM', type: 'info' });
 */
import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning';

export interface Toast {
  id:       string;
  title:    string;
  body?:    string;
  type:     ToastType;
  duration: number; // ms before auto-dismiss
}

type ShowInput = Omit<Toast, 'id' | 'duration'> & { duration?: number };

interface ToastStore {
  queue:   Toast[];
  show:    (toast: ShowInput) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  queue: [],

  show: (toast) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      queue: [...s.queue, { ...toast, id, duration: toast.duration ?? 4000 }],
    }));
  },

  dismiss: (id) => {
    set((s) => ({ queue: s.queue.filter((t) => t.id !== id) }));
  },
}));
