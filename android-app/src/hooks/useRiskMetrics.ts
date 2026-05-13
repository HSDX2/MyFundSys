import { useMemo } from 'react';
import { useHoldings } from './useSync';
import { useGridStrategies } from './useGrid';

export interface RiskMetrics {
  totalAssets: number;
  deploymentRate: number;
  top3Concentration: number;
  valuationSignal: '低估' | '合理' | '高估' | null;
  pendingCount: number;
  gridTriggeredCount: number;
  loading: boolean;
}

export function useRiskMetrics(pendingCount: number = 0, valuationPercentile?: number | null): RiskMetrics {
  const { holdings, loading: holdingsLoading } = useHoldings();
  const { overviews, loading: gridLoading } = useGridStrategies();

  return useMemo(() => {
    const totalAssets = holdings.reduce(
      (sum, h) => sum + (h.currentValue ?? h.totalCost), 0
    );

    const totalBudget = overviews.reduce((sum, o) => sum + o.total_budget, 0);
    const capitalDeployed = overviews.reduce((sum, o) => sum + o.capital_deployed, 0);
    const deploymentRate = totalBudget > 0 ? capitalDeployed / totalBudget : 0;

    const values = holdings.map(h => h.currentValue ?? h.totalCost).sort((a, b) => b - a);
    const top3Sum = values.slice(0, 3).reduce((a, b) => a + b, 0);
    const top3Concentration = totalAssets > 0 ? top3Sum / totalAssets : 0;

    let valuationSignal: RiskMetrics['valuationSignal'] = null;
    if (valuationPercentile !== null && valuationPercentile !== undefined) {
      if (valuationPercentile < 0.2) {
        valuationSignal = '低估';
      } else if (valuationPercentile <= 0.8) {
        valuationSignal = '合理';
      } else {
        valuationSignal = '高估';
      }
    }

    const gridTriggeredCount = overviews.reduce(
      (sum, o) => sum + (o.triggered_pending_count || 0), 0
    );

    return {
      totalAssets,
      deploymentRate,
      top3Concentration,
      valuationSignal,
      pendingCount,
      gridTriggeredCount,
      loading: holdingsLoading || gridLoading,
    };
  }, [holdings, overviews, valuationPercentile, pendingCount, holdingsLoading, gridLoading]);
}
