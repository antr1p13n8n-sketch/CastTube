import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Clear any previously installed dev/stale Service Workers that can interfere with API calls behind preview proxies
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.includes('workbox') || k.includes('precache') || k.includes('youtube-api'))
              .map((k) => caches.delete(k))
          )
        )
        .catch(() => {});
    }
  } else {
    try {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            registration.update().catch(() => {});
          }
        },
        onOfflineReady() {
          console.info('CastTube siap digunakan dalam mode offline.');
        },
        onRegisterError(error) {
          console.warn('Service Worker tidak dapat didaftarkan di mode browser ini:', error);
        },
      });
    } catch (err) {
      console.warn('Service Worker dilewati:', err);
    }
  }
}

createRoot(document.getElementById('root')!).render(<App />);
