import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseHoldings = vi.hoisted(() => vi.fn());
const mockUseGridStrategies = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useSync', () => ({
  useHoldings: mockUseHoldings,
}));

vi.mock('../../hooks/useGrid', () => ({
  useGridStrategies: mockUseGridStrategies,
}));

import { useRiskMetrics } from '../../hooks/useRiskMetrics';
import type { Holding } from '../../types';
import type { GridFundOverview } from '../../types';

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h_001', fundId: 'fund_001', fundCode: '000001',
    fundName: '测试基金', shares: 1000, avgCost: 1.0,
    totalCost: 1000, currentValue: 1500, profit: 500,
    profitRate: 0.5, createdAt: '', updatedAt: '',
    ...overrides,
  };
}

function makeOverview(overrides: Partial<GridFundOverview> = {}): GridFundOverview {
  return {
    strategy: {} as any, current_nav: 1,
    nearest_trigger: { price: 1, distance_pct: 0, grid_type: 'small', level: 1 },
    total_budget: 10000, capital_deployed: 5000,
    executed_count: 2, total_grid_count: 10,
    triggered_pending_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseHoldings.mockReturnValue({
    holdings: [], lots: [], loading: false,
    removeHolding: vi.fn(), refresh: vi.fn(),
  });
  mockUseGridStrategies.mockReturnValue({
    overviews: [], loading: false, error: null, refresh: vi.fn(),
  });
});

describe('useRiskMetrics', () => {
  it('empty holdings returns zero metrics', () => {
    const { result } = renderHook(() => useRiskMetrics(0));
    expect(result.current.totalAssets).toBe(0);
    expect(result.current.deploymentRate).toBe(0);
    expect(result.current.top3Concentration).toBe(0);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.gridTriggeredCount).toBe(0);
    expect(result.current.valuationSignal).toBeNull();
  });

  it('computes totalAssets from holdings', () => {
    mockUseHoldings.mockReturnValue({
      holdings: [
        makeHolding({ currentValue: 1000, totalCost: 800, fundCode: '000001' }),
        makeHolding({ currentValue: 2000, totalCost: 1500, fundCode: '000002' }),
      ],
      loading: false,
    });
    const { result } = renderHook(() => useRiskMetrics(0));
    expect(result.current.totalAssets).toBe(3000);
  });

  it('top3Concentration with 5 holdings', () => {
    mockUseHoldings.mockReturnValue({
      holdings: [
        makeHolding({ currentValue: 5000, fundCode: 'a' }),
        makeHolding({ currentValue: 3000, fundCode: 'b' }),
        makeHolding({ currentValue: 1000, fundCode: 'c' }),
        makeHolding({ currentValue: 500, fundCode: 'd' }),
        makeHolding({ currentValue: 500, fundCode: 'e' }),
      ],
      loading: false,
    });
    const { result } = renderHook(() => useRiskMetrics(0));
    expect(result.current.top3Concentration).toBeCloseTo((5000 + 3000 + 1000) / 10000, 3);
  });

  it('valuationSignal is 低估 when percentile < 0.2', () => {
    const { result } = renderHook(() => useRiskMetrics(0, 0.15));
    expect(result.current.valuationSignal).toBe('低估');
  });

  it('valuationSignal is 合理 when percentile 0.5', () => {
    const { result } = renderHook(() => useRiskMetrics(0, 0.5));
    expect(result.current.valuationSignal).toBe('合理');
  });

  it('valuationSignal is 高估 when percentile > 0.8', () => {
    const { result } = renderHook(() => useRiskMetrics(0, 0.9));
    expect(result.current.valuationSignal).toBe('高估');
  });

  it('valuationSignal is null when percentile not provided', () => {
    const { result } = renderHook(() => useRiskMetrics(0, undefined));
    expect(result.current.valuationSignal).toBeNull();
  });

  it('pendingCount is passed through', () => {
    const { result } = renderHook(() => useRiskMetrics(5));
    expect(result.current.pendingCount).toBe(5);
  });

  it('gridTriggeredCount aggregates from overviews', () => {
    mockUseGridStrategies.mockReturnValue({
      overviews: [
        makeOverview({ triggered_pending_count: 2 }),
        makeOverview({ triggered_pending_count: 3 }),
      ],
      loading: false,
    });
    const { result } = renderHook(() => useRiskMetrics(0));
    expect(result.current.gridTriggeredCount).toBe(5);
  });

  it('deploymentRate computed from totalBudget and capitalDeployed', () => {
    mockUseGridStrategies.mockReturnValue({
      overviews: [
        makeOverview({ total_budget: 20000, capital_deployed: 5000 }),
      ],
      loading: false,
    });
    const { result } = renderHook(() => useRiskMetrics(0));
    expect(result.current.deploymentRate).toBeCloseTo(0.25, 3);
  });
});
