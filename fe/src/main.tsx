import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { registerSW } from 'virtual:pwa-register';

// Register service worker — silently auto-updates when a new build is available
registerSW({ immediate: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
