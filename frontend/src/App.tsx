// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          {/* Ana dizindeyken Dashboard açılacak */}
          <Route index element={<Dashboard />} />
          
          {/* Diğer sayfaları kodladıkça buraya ekleyeceğiz */}
          <Route path="sources" element={<div>Kaynaklar Sayfası Hazırlanıyor...</div>} />
          <Route path="crawls" element={<div>Tarama İşleri Sayfası Hazırlanıyor...</div>} />
          <Route path="advisories" element={<div>Zafiyetler Sayfası Hazırlanıyor...</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;