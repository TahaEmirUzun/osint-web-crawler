import '@testing-library/jest-dom/vitest';

// Recharts'ın ResponsiveContainer bileşeni jsdom'da olmayan ResizeObserver'a ihtiyaç duyar
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;
}
