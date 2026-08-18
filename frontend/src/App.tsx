import { useEffect, useState } from 'react';
import { getSources } from './api/sourcesService';
import type { Source } from './api/sourcesService';

function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSources()
      .then((data) => {
        setSources(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>OSINT Security Crawler - Dashboard</h1>
      <p>Backend Bağlantı Testi:</p>

      {loading && <p>Yükleniyor...</p>}
      {error && <p style={{ color: 'red' }}>Hata: {error}</p>}

      <ul>
        {sources.map((source) => (
          <li key={source.id}>
            <strong>{source.name}</strong> - <a href={source.base_url} target="_blank" rel="noreferrer">{source.base_url}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;