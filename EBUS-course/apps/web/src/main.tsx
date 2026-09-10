import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { LocaleProvider } from '@/i18n/locale';
import { AuthProvider } from '@/lib/auth';
import { LearnerProgressProvider } from '@/lib/progress';
import { ThemeProvider } from '@/lib/theme';
import '@/styles/index.css';

const Router = import.meta.env.BASE_URL !== '/' ? HashRouter : BrowserRouter;

const app = (
  <Router>
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <LearnerProgressProvider>
            <App />
          </LearnerProgressProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  </Router>
);

// The vtk.js / itk-wasm case viewer uses imperative rendering and widget setup that does
// not currently tolerate StrictMode's development-only effect replay.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(app);
