import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import AppErrorBoundary from './components/app/AppErrorBoundary';
import { appLogger } from './utils/logger';
import './index.css';

registerSW({ immediate: true });

window.addEventListener('error', (event) => {
  appLogger.error('Unhandled window error', {
    message: event.message || '',
    filename: event.filename || '',
    lineno: event.lineno || 0,
    colno: event.colno || 0
  });
});

window.addEventListener('unhandledrejection', (event) => {
  appLogger.error('Unhandled promise rejection', {
    reason: String(event.reason || '')
  });
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
