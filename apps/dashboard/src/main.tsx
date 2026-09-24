import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { registerPwa } from './lib/pwa';
import './styles.css';
import './support-inbox-overrides.css';

registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
