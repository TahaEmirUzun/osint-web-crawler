import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Dashboard from '../src/pages/Dashboard';

describe('Dashboard Component Rendering Test', () => {
  it('başlangıçta yükleniyor (loading) durumunu ekrana basmalıdır', () => {
    render(<Dashboard />);
    const loadingElement = screen.getByText(/Veriler yükleniyor/i);
    expect(loadingElement).toBeInTheDocument();
  });
});