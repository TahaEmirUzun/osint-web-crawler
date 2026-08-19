// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources'; // YENİ EKLENDİ

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          {/* GEÇİCİ KOD SİLİNDİ, GERÇEK SAYFA EKLENDİ */}
          <Route path="sources" element={<Sources />} />
          <Route path="crawls" element={<div>Tarama İşleri Sayfası Hazırlanıyor...</div>} />
          <Route path="advisories" element={<div>Zafiyetler Sayfası Hazırlanıyor...</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;