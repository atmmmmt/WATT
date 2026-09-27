import React from 'react';
import ReactDOM from 'react-dom/client';

const isLiveDemo = /^\/(ar|en|tr|fr)\/demo\/?$/.test(window.location.pathname);
const root = ReactDOM.createRoot(document.getElementById('root')!);

async function bootstrap() {
  if (isLiveDemo) {
    document.documentElement.style.background = '#04130f';
    document.body.style.background = '#04130f';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    await import('./live-demo-v2.css');
    const [{ BrowserRouter }, { LiveDemoShell }] = await Promise.all([
      import('react-router-dom'),
      import('./LiveDemoShell'),
    ]);

    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <LiveDemoShell />
        </BrowserRouter>
      </React.StrictMode>,
    );
    return;
  }

  await Promise.all([
    import('./i18n'),
    import('./styles.css'),
    import('./premium-landing-v2.css'),
    import('./premium-landing-v3.css'),
    import('./landing-typography-v4.css'),
    import('./premium-landing-v5.css'),
  ]);

  const [{ App }, { LiveDemoLauncher }] = await Promise.all([
    import('./App'),
    import('./LiveDemoLauncher'),
  ]);

  root.render(
    <React.StrictMode>
      <App />
      <LiveDemoLauncher />
    </React.StrictMode>,
  );
}

void bootstrap();
