import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockUseHoldings = vi.hoisted(() => vi.fn());
const mockUseGridStrategies = vi.hoisted(() => vi.fn());
const mockFetchMarketValuation = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useSync', () => ({
  useHoldings: mockUseHoldings,
}));

vi.mock('../../hooks/useGrid', () => ({
  useGridStrategies: mockUseGridStrategies,
}));

vi.mock('../../services/fundApi', () => ({
  fetchMarketValuation: mockFetchMarketValuation,
}));

import { useRiskMetrics } from '../../hooks/useRiskMetrics';
import type { Holding } from '../../types';
import type { GridFundOverview } from '../../types';

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h_001',
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '测试基金',
    shares: 1000,
    avgCost: 1.0,
    totalCost: 1000,
    currentValue: 1500,
    profit: 500,
    profitRate: 0.5,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeOverview(overrides: Partial<GridFundOverview> = {}): GridFundOverview {
  return {
    strategy: {} as any,
    current_nav: 1,
    nearest_trigger: { price: 1, distance_pct: 0, grid_type: 'small', level: 1 },
    total_budget: 10000,
    capital_deployed: 5000,
    executed_count: 2,
    total_grid_count: 10,
    triggered_pending_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseHoldings.mockReturnValue({
    holdings: [],
    lots: [],
    loading: false,
    removeHolding: vi.fn(),
    refresh: vi.fn(),
  });
  mockUseGridStrategies.mockReturnValue({
    overviews: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockFetchMarketValuation.mockResolvedValue({
    percentile: 0.5,
    pe: 15,
    pb: 1.5,
    temperature: 50,
    date: '2024-01-15',
  });
});

describe('useRiskMetrics', () => {
  it('empty holdings returns zero metrics', async () => {
    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalAssets).toBe(0);
    expect(result.current.deploymentRate).toBe(0);
    expect(result.current.top3Concentration).toBe(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.gridTriggeredCount).toBe(0);
  });

  it('computes totalAssets from holdings', async () => {
    mockUseHoldings.mockReturnValue({
      holdings: [
        makeHolding({ currentValue: 1000, totalCost: 800, fundCode: '000001' }),
        makeHolding({ currentValue: 2000, totalCost: 1500, fundCode: '000002' }),
        makeHolding({ currentValue: 3000, totalCost: 2500, fundCode: '000003' }),
      ],
      lots: [],
      loading: false,
      removeHolding: vi.fn(),
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalAssets).toBe(6000);
  });

  it('computes top3Concentration with 5 holdings', async () => {
    mockUseHoldings.mockReturnValue({
      holdings: [
        makeHolding({ currentValue: 5000, totalCost: 4000, fundCode: '000001' }),
        makeHolding({ currentValue: 4000, totalCost: 3500, fundCode: '000002' }),
        makeHolding({ currentValue: 3000, totalCost: 2500, fundCode: '000003' }),
        makeHolding({ currentValue: 1000, totalCost: 800, fundCode: '000004' }),
        makeHolding({ currentValue: 500, totalCost: 400, fundCode: '000005' }),
      ],
      lots: [],
      loading: false,
      removeHolding: vi.fn(),
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const top3 = 5000 + 4000 + 3000;
    const total = 5000 + 4000 + 3000 + 1000 + 500;
    expect(result.current.top3Concentration).toBe(top3 / total);
  });

  it('valuationSignal is 低估 when percentile < 0.2', async () => {
    mockFetchMarketValuation.mockResolvedValue({
      percentile: 0.15,
      pe: 10,
      pb: 1,
      temperature: 20,
      date: '2024-01-15',
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.valuationSignal).toBe('低估');
  });

  it('valuationSignal is 合理 when percentile is 0.5', async () => {
    mockFetchMarketValuation.mockResolvedValue({
      percentile: 0.5,
      pe: 15,
      pb: 1.5,
      temperature: 50,
      date: '2024-01-15',
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.valuationSignal).toBe('合理');
  });

  it('valuationSignal is 高估 when percentile > 0.8', async () => {
    mockFetchMarketValuation.mockResolvedValue({
      percentile: 0.85,
      pe: 25,
      pb: 3,
      temperature: 80,
      date: '2024-01-15',
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.valuationSignal).toBe('高估');
  });

  it('respects pendingCount parameter', async () => {
    const { result } = renderHook(() => useRiskMetrics(3));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pendingCount).toBe(3);
  });

  it('computes deploymentRate from overviews', async () => {
    mockUseGridStrategies.mockReturnValue({
      overviews: [
        makeOverview({ total_budget: 20000, capital_deployed: 8000 }),
        makeOverview({ total_budget: 30000, capital_deployed: 15000 }),
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.deploymentRate).toBe(23000 / 50000);
  });

  it('computes gridTriggeredCount from overviews', async () => {
    mockUseGridStrategies.mockReturnValue({
      overviews: [
        makeOverview({ triggered_pending_count: 2 }),
        makeOverview({ triggered_pending_count: 3 }),
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRiskMetrics(0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.gridTriggeredCount).toBe(5);
  });
});
