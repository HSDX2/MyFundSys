import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase ----
const mockFrom = vi.hoisted(() => vi.fn(() => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: null, error: null })) })) })),
  insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: { id: 'ge_001' }, error: null })) })) })),
  update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
  delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
})));

const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: { from: mockFrom },
}));

// Mock navUpdateService
const mockAddTransactionWithHoldingUpdate = vi.hoisted(() => vi.fn());
vi.mock('../../services/navUpdateService', () => ({
  addTransactionWithHoldingUpdate: mockAddTransactionWithHoldingUpdate,
}));

import {
  calculateGridLevels,
  deriveGridStatuses,
  computeFundOverview,
  executeGrid,
  fetchGridStrategies,
  batchImportGridStrategies,
} from '../../services/gridService';
import type { GridStrategy, GridExecution, GridType, GridTypeConfig } from '../../types';

describe('gridService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockAddTransactionWithHoldingUpdate.mockResolvedValue({ transactionId: 'tx_001' });
  });

  // ============================================
  // calculateGridLevels
  // ============================================
  describe('calculateGridLevels', () => {
    it('从底部价格按固定间距展开网格', () => {
      const levels = calculateGridLevels(
        0.5,      // bottomPrice
        0.10,     // spacingPct = 10%
        3,        // gridCount
        1000,     // baseInvestment
        0.20,     // incrementPct = 20%
        [0.3, 0.5, 0.8]  // profitRules
      );

      expect(levels).toHaveLength(3);

      // 第1格: trigger = 0.5 * 1.10^0 = 0.5, investment = 1000
      expect(levels[0].level).toBe(1);
      expect(levels[0].trigger_price).toBe(0.5);
      expect(levels[0].investment).toBe(1000);
      expect(levels[0].cumulative).toBe(1000);
      expect(levels[0].sell_price).toBe(0.55);  // 0.5 * 1.1
      expect(levels[0].profit_retention_pct).toBe(0.3);

      // 第2格: trigger = 0.5 * 1.10^1 = 0.55, investment = 1200
      expect(levels[1].level).toBe(2);
      expect(levels[1].trigger_price).toBeCloseTo(0.55, 4);
      expect(levels[1].investment).toBe(1200);
      expect(levels[1].cumulative).toBe(2200);
      expect(levels[1].profit_retention_pct).toBe(0.5);

      // 第3格: trigger = 0.5 * 1.10^2 = 0.605, investment = 1440
      expect(levels[2].level).toBe(3);
      expect(levels[2].trigger_price).toBeCloseTo(0.605, 4);
      expect(levels[2].investment).toBe(1440);
      expect(levels[2].cumulative).toBe(3640);
      expect(levels[2].profit_retention_pct).toBe(0.8);
    });

    it('价格保留4位小数', () => {
      const levels = calculateGridLevels(
        0.3333, 0.05, 1, 100, 0, [0]
      );
      expect(levels[0].trigger_price).toBe(0.3333);
      expect(levels[0].sell_price).toBe(0.35);  // 0.3333*1.05 = 0.349965 -> round
    });

    it('gridCount为0返回空数组', () => {
      const levels = calculateGridLevels(1, 0.1, 0, 100, 0, []);
      expect(levels).toHaveLength(0);
    });
  });

  // ============================================
  // deriveGridStatuses
  // ============================================
  describe('deriveGridStatuses', () => {
    const createStrategy = (): GridStrategy => ({
      id: 'gs_001',
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      grid_config: {
        small: {
          label: '小网',
          spacing_pct: 0.1,
          grid_count: 2,
          base_investment: 1000,
          increment_pct: 0,
          profit_rules: [0, 0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 1000, cumulative: 1000, sell_price: 0.55, profit: 50, profit_retention_pct: 0 },
            { level: 2, trigger_price: 0.55, investment: 1000, cumulative: 2000, sell_price: 0.605, profit: 55, profit_retention_pct: 0 },
          ],
        },
        medium: {
          label: '中网',
          spacing_pct: 0.15,
          grid_count: 1,
          base_investment: 2000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 2000, cumulative: 2000, sell_price: 0.575, profit: 100, profit_retention_pct: 0 },
          ],
        },
        large: {
          label: '大网',
          spacing_pct: 0.2,
          grid_count: 1,
          base_investment: 3000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 3000, cumulative: 3000, sell_price: 0.6, profit: 150, profit_retention_pct: 0 },
          ],
        },
      },
    });

    it('当前净值 > 触发价 => 状态为 above（等待）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [];
      const levels = deriveGridStatuses(strategy, executions, 0.6);  // 0.6 > all triggers

      expect(levels.small[0].status).toBe('above');
      expect(levels.small[1].status).toBe('above');
      expect(levels.medium[0].status).toBe('above');
      expect(levels.large[0].status).toBe('above');
    });

    it('当前净值 <= 触发价 => 状态为 triggered（可买入）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [];
      const levels = deriveGridStatuses(strategy, executions, 0.5);  // <= all triggers

      expect(levels.small[0].status).toBe('triggered');
      expect(levels.small[1].status).toBe('triggered');
      expect(levels.medium[0].status).toBe('triggered');
      expect(levels.large[0].status).toBe('triggered');
    });

    it('有执行记录 => 状态为 executed（已执行）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_001',
          executed_nav: 0.48,
          executed_amount: 1000,
          executed_shares: 2083.33,
        },
      ];
      const levels = deriveGridStatuses(strategy, executions, 0.52);

      expect(levels.small[0].status).toBe('executed');
      expect(levels.small[0].execution).toBeDefined();
      expect(levels.small[0].execution?.executed_nav).toBe(0.48);
      expect(levels.small[1].status).toBe('triggered');
    });

    it('只匹配同类型的执行记录', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
        },
      ];
      const levels = deriveGridStatuses(strategy, executions, 0.5);

      // small 第1格已执行
      expect(levels.small[0].status).toBe('executed');
      // medium 第1格虽然 level=1 但类型不同，仍应为 triggered
      expect(levels.medium[0].status).toBe('triggered');
    });

    it('已取消的记录不视为 executed', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'cancelled',
        },
      ];
      const levels = deriveGridStatuses(strategy, executions, 0.5);

      expect(levels.small[0].status).toBe('triggered');
    });

    it('distance_pct 计算正确', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [];
      const levels = deriveGridStatuses(strategy, executions, 0.55);

      // small level1 trigger=0.5, current=0.55 => (0.55-0.5)/0.5*100 = 10%
      expect(levels.small[0].distance_pct).toBe(10);
      // small level2 trigger=0.55, current=0.55 => 0%
      expect(levels.small[1].distance_pct).toBe(0);
    });

    it('空网格类型配置返回空数组', () => {
      const strategy = createStrategy();
      strategy.grid_config = {
        small: { label: '小网', spacing_pct: 0.1, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        medium: { label: '中网', spacing_pct: 0.15, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
      };
      const levels = deriveGridStatuses(strategy, [], 1.0);

      expect(levels.small).toHaveLength(0);
      expect(levels.medium).toHaveLength(0);
      expect(levels.large).toHaveLength(0);
    });
  });

  // ============================================
  // computeFundOverview
  // ============================================
  describe('computeFundOverview', () => {
    const createStrategy = (): GridStrategy => ({
      id: 'gs_001',
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      grid_config: {
        small: {
          label: '小网',
          spacing_pct: 0.1,
          grid_count: 2,
          base_investment: 1000,
          increment_pct: 0,
          profit_rules: [0, 0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 1000, cumulative: 1000, sell_price: 0.55, profit: 50, profit_retention_pct: 0 },
            { level: 2, trigger_price: 0.55, investment: 1000, cumulative: 2000, sell_price: 0.605, profit: 55, profit_retention_pct: 0 },
          ],
        },
        medium: {
          label: '中网',
          spacing_pct: 0.15,
          grid_count: 1,
          base_investment: 2000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 2000, cumulative: 2000, sell_price: 0.575, profit: 100, profit_retention_pct: 0 },
          ],
        },
        large: {
          label: '大网',
          spacing_pct: 0.2,
          grid_count: 1,
          base_investment: 3000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 3000, cumulative: 3000, sell_price: 0.6, profit: 150, profit_retention_pct: 0 },
          ],
        },
      },
    });

    it('计算总预算 = 所有网格投资额之和', () => {
      const strategy = createStrategy();
      const overview = computeFundOverview(strategy, [], 1.0);

      // 1000 + 1000 + 2000 + 3000 = 7000
      expect(overview.total_budget).toBe(7000);
    });

    it('已投入 = 已执行网格的投资额之和', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_001',
          executed_nav: 0.48,
          executed_amount: 1000,
        },
        {
          id: 'ge_002',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'medium',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_002',
          executed_nav: 0.48,
          executed_amount: 2000,
        },
      ];
      const overview = computeFundOverview(strategy, executions, 1.0);

      expect(overview.capital_deployed).toBe(3000);
      expect(overview.executed_count).toBe(2);
    });

    it('待执行 = 当前净值 <= 触发价但未执行的网格数', () => {
      const strategy = createStrategy();
      // 当前净值 0.5，全部触发，一个已执行
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
        },
      ];
      const overview = computeFundOverview(strategy, executions, 0.5);

      // 总共4格，1格已执行，剩余3格全部触发
      expect(overview.triggered_pending_count).toBe(3);
      expect(overview.total_grid_count).toBe(4);
    });

    it('nearest_trigger 指向最近的未执行网格', () => {
      const strategy = createStrategy();
      // 当前净值 0.58，small level2 trigger=0.55 最近，medium level1 trigger=0.5 稍远
      const overview = computeFundOverview(strategy, [], 0.58);

      expect(overview.nearest_trigger.grid_type).toBe('small');
      expect(overview.nearest_trigger.level).toBe(2);
      // distance = (0.58 - 0.55) / 0.55 * 100 ≈ 5.45%
      expect(overview.nearest_trigger.distance_pct).toBeCloseTo(5.45, 1);
    });

    it('nearest_trigger 不考虑已执行网格', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 2,
          action: 'buy',
          status: 'executed',
        },
      ];
      // current=0.58, small level2 已执行，最近应是 small level1 (trigger=0.5)
      const overview = computeFundOverview(strategy, executions, 0.58);

      expect(overview.nearest_trigger.grid_type).toBe('small');
      expect(overview.nearest_trigger.level).toBe(1);
    });
  });

  // ============================================
  // executeGrid
  // ============================================
  describe('executeGrid', () => {
    it('创建交易记录和执行记录', async () => {
      const result = await executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 1000,
        currentNav: 0.48,
      });

      expect(mockAddTransactionWithHoldingUpdate).toHaveBeenCalled();
      const txCall = mockAddTransactionWithHoldingUpdate.mock.calls[0][0];
      expect(txCall.type).toBe('buy');
      expect(txCall.amount).toBe(1000);
      expect(txCall.source).toBe('grid');
      expect(txCall.status).toBe('pending');
      expect(txCall.shares).toBeCloseTo(2083.33, 2);
      expect(result.transactionId).toBe('tx_001');
    });

    it('Supabase 未配置时抛出错误', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 1000,
        currentNav: 0.48,
      })).rejects.toThrow('Supabase 未配置');
    });
  });

  // ============================================
  // batchImportGridStrategies
  // ============================================
  describe('batchImportGridStrategies', () => {
    it('空数组返回 0 成功', async () => {
      const result = await batchImportGridStrategies([]);
      expect(result.success).toBe(0);
    });

    it('Supabase 未配置返回错误', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await batchImportGridStrategies([
        { fund_code: '000001', fund_name: '测试', peak_price: 1, bottom_price: 0.5, grid_config: {} as any },
      ]);
      expect(result.success).toBe(0);
      expect(result.errors[0]).toContain('Supabase 未配置');
    });
  });

  // ============================================
  // fetchGridStrategies
  // ============================================
  describe('fetchGridStrategies', () => {
    it('Supabase 未配置返回空数组', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await fetchGridStrategies();
      expect(result).toEqual([]);
    });
  });
});
