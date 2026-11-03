import { apiRequest } from './client';

export type StatisticsSummary = {
  total_advisories: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unknown?: number;
  active_sources: number;
  total_sources?: number;
  completed_crawls: number;
  failed_crawls?: number;
  running_crawls?: number;
};

export type TimelineData = {
  date: string;
  count: number;
};

export async function getStatisticsSummary(): Promise<StatisticsSummary> {
  return await apiRequest<StatisticsSummary>('/api/statistics/summary');
}

export async function getTimeline(): Promise<TimelineData[]> {
  return await apiRequest<TimelineData[]>('/api/statistics/timeline');
}
