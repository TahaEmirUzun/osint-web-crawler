import { apiRequest } from './client';

export type DashboardSummary = {
  total_advisories: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  active_sources: number;
  completed_crawls: number;
};

export async function getSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>('/api/statistics/summary');
}