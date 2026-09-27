import React from 'react';
import ReactDOM from 'react-dom/client';

const isLiveDemo = /^\/(ar|en|tr|fr)\/demo\/?$/.test(window.location.pathname);
const root = ReactDOM.createRoot(document.getElementById('root')!);

async function bootstrap() {
  if (isLiveDemo) {
    // Paint the demo background before any async chunk arrives. This removes the
    // light strip / white flash that was visible at the top on slower connections.
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

  // The marketing site owns a much larger visual system. Keep it completely out
  // of the live-demo entry path so /demo stays lightweight and quick to open.
  await Promise.all([
    import('./i18n'),
    import('./styles.css'),
    import('./premium-landing-v2.css'),
    import('./premium-landing-v3.css'),
    import('./landing-typography-v4.css'),
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
