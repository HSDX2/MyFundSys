import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase（vi.hoisted 确保在模块加载前初始化）----
const mockUpsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn(() => ({
  upsert: mockUpsert,
  delete: mockDelete,
  select: mockSelect,
})));
const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: {
    from: mockFrom,
  },
}));

import {
  syncHoldingsToSupabase,
  syncTransactionsToSupabase,
  checkSupabaseConnection,
  fetchAllDataFromSupabase,
  type SyncResult,
} from '../../services/syncService';
import type { Holding, Transaction } from '../../types';

describe('syncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    // 重置 mockFrom 默认行为，防止被 fetchAllDataFromSupabase 测试覆盖
    mockFrom.mockImplementation(() => ({
      upsert: mockUpsert,
      delete: mockDelete,
      select: mockSelect,
    }));
    // 模拟链式调用: .delete().neq('id', '0') 和 .upsert()
    const mockNeq = vi.fn().mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ neq: mockNeq });
    mockUpsert.mockResolvedValue({ error: null });
    mockSelect.mockResolvedValue({ error: null, count: 0 });
  });

  describe('syncHoldingsToSupabase', () => {
    it('Supabase 未配置时返回失败', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result: SyncResult = await syncHoldingsToSupabase([]);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Supabase 未配置');
    });

    it('空持仓数组时返回成功', async () => {
      const result: SyncResult = await syncHoldingsToSupabase([]);
      expect(result.success).toBe(true);
      expect(result.message).toContain('0 条持仓');
    });

    it('同步持仓时先清空再插入', async () => {
      const holdings: Holding[] = [
        {
          id: 'h_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          shares: 1000,
          avgCost: 1.0,
          totalCost: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await syncHoldingsToSupabase(holdings);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('Supabase 错误时返回失败', async () => {
      mockUpsert.mockReturnValue({ error: new Error('DB Error') });

      const holdings: Holding[] = [
        {
          id: 'h_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          shares: 1000,
          avgCost: 1.0,
          totalCost: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await syncHoldingsToSupabase(holdings);

      expect(result.success).toBe(false);
      expect(result.message).toBe('同步失败');
    });
  });

  describe('syncTransactionsToSupabase', () => {
    it('Supabase 未配置时返回失败', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result: SyncResult = await syncTransactionsToSupabase([]);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Supabase 未配置');
    });

    it('空交易数组时返回成功', async () => {
      const result: SyncResult = await syncTransactionsToSupabase([]);
      expect(result.success).toBe(true);
      expect(result.message).toContain('0 条交易');
    });

    it('同步交易时先清空再插入', async () => {
      const transactions: Transaction[] = [
        {
          id: 't_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'buy',
          date: '2024-01-01',
          amount: 1000,
          price: 1.0,
          shares: 1000,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await syncTransactionsToSupabase(transactions);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('包含所有交易类型的转换', async () => {
      const transactions: Transaction[] = [
        {
          id: 't_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'buy',
          date: '2024-01-01',
          amount: 1000,
          price: 1.0,
          shares: 1000,
          fee: 0,
          status: 'completed',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 't_002',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'sell',
          date: '2024-01-02',
          amount: 500,
          price: 1.5,
          shares: 333.33,
          fee: 5,
          status: 'pending',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      const result = await syncTransactionsToSupabase(transactions);

      expect(result.success).toBe(true);
    });
  });

  describe('checkSupabaseConnection', () => {
    it('Supabase 未配置时返回 false', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);

      const result = await checkSupabaseConnection();

      expect(result).toBe(false);
    });

    it('连接成功返回 true', async () => {
      mockSelect.mockReturnValue({ error: null });

      const result = await checkSupabaseConnection();

      expect(result).toBe(true);
      expect(mockSelect).toHaveBeenCalledWith('count', { count: 'exact', head: true });
    });

    it('连接失败返回 false', async () => {
      mockSelect.mockReturnValue({ error: new Error('Connection failed') });

      const result = await checkSupabaseConnection();

      expect(result).toBe(false);
    });

    it('异常时返回 false', async () => {
      mockSelect.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await checkSupabaseConnection();

      expect(result).toBe(false);
    });
  });

  // ============================================
  // fetchAllDataFromSupabase
  // ============================================
  describe('fetchAllDataFromSupabase', () => {
    it('Supabase 未配置时返回空数组', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await fetchAllDataFromSupabase();
      expect(result.holdings).toEqual([]);
      expect(result.transactions).toEqual([]);
    });

    it('成功获取 holdings 和 transactions', async () => {
      const mockHoldings = [
        {
          id: 'h_001',
          fund_code: '000001',
          fund_name: '测试基金',
          shares: 1000,
          avg_nav: 1.0,
          total_cost: 1000,
          current_nav: 1.2,
          market_value: 1200,
          profit: 200,
          profit_rate: 0.2,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      const mockTransactions = [
        {
          id: 't_001',
          fund_code: '000001',
          fund_name: '测试基金',
          type: 'buy',
          shares: 1000,
          nav: 1.0,
          amount: 1000,
          fee: 0,
          date: '2024-01-01',
          confirm_date: '2024-01-02',
          status: 'completed',
          source: 'manual',
          grid_execution_id: 'ge_001',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 't_002',
          fund_code: '000001',
          fund_name: '测试基金',
          type: 'sell',
          shares: 500,
          nav: 1.2,
          amount: 600,
          fee: 5,
          date: '2024-01-03',
          status: 'completed',
          source: 'grid',
          grid_execution_id: 'ge_002',
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
        },
      ];

      mockFrom.mockImplementation((table: string) => ({
        upsert: mockUpsert,
        delete: mockDelete,
        select: () => Promise.resolve({
          data: table === 'holdings' ? mockHoldings : mockTransactions,
          error: null,
        }),
      }));

      const result = await fetchAllDataFromSupabase();

      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].id).toBe('h_001');
      expect(result.holdings[0].fundCode).toBe('000001');
      expect(result.holdings[0].shares).toBe(1000);
      expect(result.holdings[0].avgCost).toBe(1.0);
      expect(result.holdings[0].totalCost).toBe(1000);
      expect(result.holdings[0].currentNav).toBe(1.2);
      expect(result.holdings[0].currentValue).toBe(1200);
      expect(result.holdings[0].profit).toBe(200);
      expect(result.holdings[0].profitRate).toBe(0.2);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].id).toBe('t_001');
      expect(result.transactions[0].fundCode).toBe('000001');
      expect(result.transactions[0].type).toBe('buy');
      expect(result.transactions[0].price).toBe(1.0);
      expect(result.transactions[0].confirmDate).toBe('2024-01-02');
      expect(result.transactions[0].gridExecutionId).toBe('ge_001');
      expect(result.transactions[0].source).toBe('manual');

      expect(result.transactions[1].id).toBe('t_002');
      expect(result.transactions[1].type).toBe('sell');
      expect(result.transactions[1].price).toBe(1.2);
      expect(result.transactions[1].confirmDate).toBe('2024-01-03');
      expect(result.transactions[1].gridExecutionId).toBe('ge_002');
      expect(result.transactions[1].source).toBe('grid');
    });

    it('无数据时返回空数组', async () => {
      mockFrom.mockImplementation(() => ({
        upsert: mockUpsert,
        delete: mockDelete,
        select: () => Promise.resolve({ data: null, error: null }),
      }));

      const result = await fetchAllDataFromSupabase();

      expect(result.holdings).toEqual([]);
      expect(result.transactions).toEqual([]);
    });

    it('查询返回错误时返回空数组', async () => {
      mockFrom.mockImplementation(() => ({
        upsert: mockUpsert,
        delete: mockDelete,
        select: () => Promise.resolve({ data: null, error: new Error('Query failed') }),
      }));

      const result = await fetchAllDataFromSupabase();

      expect(result.holdings).toEqual([]);
      expect(result.transactions).toEqual([]);
    });

    it('异常时返回空数组', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await fetchAllDataFromSupabase();

      expect(result.holdings).toEqual([]);
      expect(result.transactions).toEqual([]);
    });
  });

  // ============================================
  // toDbTransaction / fromDbTransaction 字段映射
  // ============================================
  describe('toDbTransaction field mapping', () => {
    it('gridExecutionId 和 confirmDate 正确映射到数据库字段', async () => {
      const transactions: Transaction[] = [
        {
          id: 't_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'buy',
          date: '2024-01-01',
          confirmDate: '2024-01-02',
          amount: 1000,
          price: 1.0,
          shares: 1000,
          fee: 5,
          status: 'completed',
          source: 'grid',
          gridExecutionId: 'ge_001',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      await syncTransactionsToSupabase(transactions);

      expect(mockUpsert).toHaveBeenCalled();
      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(1);
      expect(upsertArg[0].fund_code).toBe('000001');
      expect(upsertArg[0].fund_name).toBe('测试基金');
      expect(upsertArg[0].nav).toBe(1.0);
      expect(upsertArg[0].amount).toBe(1000);
      expect(upsertArg[0].shares).toBe(1000);
      expect(upsertArg[0].confirm_date).toBe('2024-01-02');
      expect(upsertArg[0].grid_execution_id).toBe('ge_001');
      expect(upsertArg[0].status).toBe('completed');
      expect(upsertArg[0].source).toBe('grid');
      expect(upsertArg[0].fee).toBe(5);
    });

    it('默认值处理：fee 为 0、status 为 completed、source 为 manual、confirmDate 回退到 date', async () => {
      const transactions: Transaction[] = [
        {
          id: 't_002',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'sell',
          date: '2024-01-02',
          amount: 500,
          price: 1.5,
          shares: 333.33,
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      await syncTransactionsToSupabase(transactions);

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg[0].fee).toBe(0);
      expect(upsertArg[0].status).toBe('completed');
      expect(upsertArg[0].source).toBe('manual');
      expect(upsertArg[0].confirm_date).toBe('2024-01-02');
      expect(upsertArg[0].grid_execution_id).toBeUndefined();
    });
  });
});
