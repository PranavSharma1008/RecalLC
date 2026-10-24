import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import '../styles/app.css';

// Anti-Clickjacking: prevent malicious framing
if (typeof window !== 'undefined' && window.top && window.top !== window.self) {
  try {
    window.top.location.href = window.self.location.href;
  } catch {
    document.documentElement.style.display = 'none';
  }
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
