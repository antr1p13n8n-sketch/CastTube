import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
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

createRoot(document.getElementById('root')!).render(<App />);
