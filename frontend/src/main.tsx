import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LiveDemoShell } from './LiveDemoShell';
import { LiveDemoLauncher } from './LiveDemoLauncher';
import './i18n';
import './styles.css';
import './premium-landing-v2.css';
import './premium-landing-v3.css';
import './live-demo-v2.css';

const isLiveDemo = /^\/(ar|en|tr|fr)\/demo\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isLiveDemo ? (
      <BrowserRouter>
        <LiveDemoShell />
      </BrowserRouter>
    ) : (
      <>
        <App />
        <LiveDemoLauncher />
      </>
    )}
  </React.StrictMode>,
);
