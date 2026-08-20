import { apiRequest } from './client';

export type StatisticsSummary = {
  total_advisories: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  active_sources: number;
  completed_crawls: number;
};

export type TimelineData = {
  date: string;
  count: number;
};

// Mevcut özet fonksiyonun
export async function getStatisticsSummary(): Promise<StatisticsSummary> {
  return await apiRequest<StatisticsSummary>('/api/statistics/summary');
}

// YENİ: Zaman çizelgesi fonksiyonumuz
export async function getTimeline(): Promise<TimelineData[]> {
  return await apiRequest<TimelineData[]>('/api/statistics/timeline');
}