import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import Advisories from './pages/Advisories';
import Crawls from './pages/Crawls';
import Logs from './pages/Logs';
import { ToastProvider } from './components/Toast';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="sources" element={<Sources />} />
            <Route path="crawls" element={<Crawls />} />
            <Route path="advisories" element={<Advisories />} />
            <Route path="logs" element={<Logs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
