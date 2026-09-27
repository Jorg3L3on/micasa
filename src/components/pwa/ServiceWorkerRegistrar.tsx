'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { PWA_CONNECTION_RESTORED_EVENT } from '@/lib/pwa/pwa-launch';

const UPDATE_TOAST_ID = 'pwa-update';
const OFFLINE_TOAST_ID = 'pwa-offline';

const promptUpdate = (
  worker: ServiceWorker,
  onUpdateRequested: () => void,
) => {
  toast('Nueva versión disponible', {
    id: UPDATE_TOAST_ID,
    description: 'Actualiza para usar la versión más reciente de MiCasa.',
    duration: Infinity,
    action: {
      label: 'Actualizar',
      onClick: () => {
        onUpdateRequested();
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
    },
  });
};

/**
 * Registers public/sw.js in production, prompts when a new deploy is ready,
 * and surfaces connectivity changes.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // The offline page (served at any URL) explains the state and recovers itself.
    if (document.querySelector('[data-offline-page]')) return;

    const handleOffline = () => {
      toast.warning('Sin conexión, los cambios no se guardarán', {
        id: OFFLINE_TOAST_ID,
        duration: Infinity,
      });
    };

    const handleOnline = () => {
      toast.dismiss(OFFLINE_TOAST_ID);
      toast.success('Conexión restablecida');
      window.dispatchEvent(new Event(PWA_CONNECTION_RESTORED_EVENT));
    };

    if (!navigator.onLine) handleOffline();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const { serviceWorker } = navigator;
    let registration: ServiceWorkerRegistration | null = null;
    let updateRequested = false;
    let reloading = false;
    const handleUpdateRequested = () => {
      updateRequested = true;
    };

    const handleControllerChange = () => {
      if (!updateRequested || reloading) return;
      reloading = true;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      registration?.update().catch(() => undefined);
    };

    const register = async () => {
      try {
        registration = await serviceWorker.register(
          `/sw.js?v=${process.env.NEXT_PUBLIC_APP_VERSION}`,
          { scope: '/' },
        );
      } catch (error) {
        console.error('Service worker registration failed:', error);
        return;
      }

      if (registration.waiting && serviceWorker.controller) {
        promptUpdate(registration.waiting, handleUpdateRequested);
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration?.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && serviceWorker.controller) {
            promptUpdate(installing, handleUpdateRequested);
          }
        });
      });
    };

    serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void register();

    return () => {
      serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
