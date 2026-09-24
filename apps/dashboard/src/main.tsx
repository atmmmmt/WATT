import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { registerPwa } from './lib/pwa';
import './styles.css';
import './support-inbox-overrides.css';
import './mobile-native.css';
import './mobile-premium.css';
import './mobile-route-fixes.css';

registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);

requestAnimationFrame(() => {
  const splash = document.getElementById('vayro-boot-splash');
  if (!splash) return;
  splash.classList.add('is-ready');
  window.setTimeout(() => splash.remove(), 220);
});
