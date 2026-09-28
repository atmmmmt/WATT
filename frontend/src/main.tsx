import React from 'react';
import ReactDOM from 'react-dom/client';

const isLiveDemo = /^\/(ar|en|tr|fr)\/demo\/?$/.test(window.location.pathname);
const storedTheme = localStorage.getItem('vayro-theme');
const initialTheme = storedTheme === 'dark' || storedTheme === 'light'
  ? storedTheme
  : window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

document.documentElement.dataset.theme = initialTheme;
document.documentElement.style.background = initialTheme === 'dark' ? '#04130f' : '#f5f8f6';
document.body.style.background = initialTheme === 'dark' ? '#04130f' : '#f5f8f6';
document.body.style.margin = '0';
document.body.style.padding = '0';

const root = ReactDOM.createRoot(document.getElementById('root')!);

function revealApp() {
  // Keep the first paint deterministic. React/GSAP may install entrance styles in an
  // effect; the small boot window prevents content -> disappear -> content flicker.
  window.setTimeout(() => {
    document.documentElement.classList.add('vayro-ready');
    document.getElementById('vayro-boot')?.remove();
  }, 120);
}

async function bootstrap() {
  if (isLiveDemo) {
    await import('./live-demo-v2.css');
    const [{ BrowserRouter }, { LiveDemoShell }] = await Promise.all([
      import('react-router-dom'),
      import('./LiveDemoShell'),
    ]);
    // Load overrides after demo component CSS so the saved landing theme wins.
    await Promise.all([
      import('./live-demo-theme-sync.css'),
      import('./public-launch-cleanup.css'),
    ]);

    root.render(
      <React.StrictMode>
        <BrowserRouter>
          <LiveDemoShell />
        </BrowserRouter>
      </React.StrictMode>,
    );
    revealApp();
    return;
  }

  // Mutate public copy before App is imported so unfinished products never flash.
  await import('./landing-public-state');
  await Promise.all([
    import('./i18n'),
    import('./styles.css'),
    import('./premium-landing-v2.css'),
    import('./premium-landing-v3.css'),
    import('./landing-typography-v4.css'),
    import('./premium-landing-v5.css'),
    import('./landing-mobile-v6.css'),
    import('./landing-mobile-v7.css'),
    import('./landing-mobile-v8.css'),
    import('./landing-iphone-v9.css'),
    import('./public-launch-cleanup.css'),
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
  revealApp();
}

void bootstrap();
