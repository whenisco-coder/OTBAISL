import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDatabase } from './db/init';

// Bootstrap SQLite in OPFS/Worker on app startup
initDatabase().catch((err) => {
  console.error('[App Bootstrap] SQLite initialization error:', err);
});

createRoot(document.getElementById('root')!).render(<App />);
