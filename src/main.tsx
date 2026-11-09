import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for offline-first PWA caching
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('🔄 New FamilyOS update ready.');
    },
    onOfflineReady() {
      console.log('⚡ FamilyOS is fully cached and ready for offline use.');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
