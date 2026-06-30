import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { registerSW } from 'virtual:pwa-register';

// Service workers don't work in Electron — skip registration there.
const isElectron = navigator.userAgent.includes('Electron');
if (!isElectron) {
  registerSW({ immediate: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
