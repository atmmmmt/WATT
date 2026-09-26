import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LiveDemo } from './LiveDemo';
import { LiveDemoLauncher } from './LiveDemoLauncher';
import './i18n';
import './styles.css';
import './premium-landing-v2.css';
import './premium-landing-v3.css';

const isLiveDemo = /^\/(ar|en|tr|fr)\/demo\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isLiveDemo ? (
      <BrowserRouter>
        <LiveDemo />
      </BrowserRouter>
    ) : (
      <>
        <App />
        <LiveDemoLauncher />
      </>
    )}
  </React.StrictMode>,
);
