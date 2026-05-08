import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockFetchFundNav = vi.hoisted(() => vi.fn());
const mockFetchFundHistory = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: { from: mockFrom },
}));

vi.mock('../../services/fundApi', () => ({
  fetchFundNav: mockFetchFundNav,
  fetchFundHistory: mockFetchFundHistory,
}));

import {
  updateLocalHoldingAfterTransaction,
  reverseTransactionOnHolding,
  canDeleteTransaction,
  addTransactionWithHoldingUpdate,
  removeTransactionWithHoldingUpdate,
  removeHoldingWithTransactions,
  processPendingTransactions,
} from '../../services/navUpdateService';
import type { Holding, Transaction } from '../../types';

// ---- 工具函数 ----

function makeBuyTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_001',
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    type: 'buy',
    date: '2024-01-10',
    amount: 1000,
    price: 1.0,
    shares: 1000,
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSellTx(overrides: Partial<Transaction> = {}): Transaction {
  return makeBuyTx({ type: 'sell', amount: 500, price: 1.5, shares: 333.33, id: 'tx_002', ...overrides });
}

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h_001',
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    shares: 1000,
    avgCost: 1.0,
    totalCost: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAddTxPayload(overrides: Partial<Omit<Transaction, 'id' | 'createdAt'>> = {}): Omit<Transaction, 'id' | 'createdAt'> {
  return {
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    type: 'buy',
    date: '2024-01-10',
    amount: 1000,
    price: 1.0,
    shares: 1000,
    status: 'completed',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  mockFetchFundNav.mockReset();
  mockFetchFundHistory.mockReset();
  mockIsSupabaseConfigured.mockReturnValue(true);
  (window as any).__pendingTransactionsProcessing = false;
});

// ============================================
// updateLocalHoldingAfterTransaction
// ============================================

describe('updateLocalHoldingAfterTransaction', () => {
  describe('买入新基金', () => {
    it('持仓不存在时，创建新持仓', () => {
      const tx = makeBuyTx();
      const result = updateLocalHoldingAfterTransaction(undefined, tx);

      expect(result.holding).not.toBeNull();
      expect(result.holding!.fundCode).toBe('000001');
      expect(result.holding!.shares).toBe(1000);
      expect(result.holding!.avgCost).toBe(1.0);
      expect(result.holding!.totalCost).toBe(1000);
      expect(result.shouldDelete).toBe(false);
    });

    it('卖出新基金且持仓不存在时，不创建持仓', () => {
      const tx = makeSellTx();
      const result = updateLocalHoldingAfterTransaction(undefined, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(false);
    });
  });

  describe('买入追加', () => {
    it('追加买入时份额正确累加', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeBuyTx({ amount: 500, price: 1.2, shares: 416.67 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.shares).toBeCloseTo(1416.67, 1);
      expect(result.holding!.totalCost).toBeCloseTo(1500, 1);
      expect(result.shouldDelete).toBe(false);
    });

    it('追加买入时均价重新计算', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeBuyTx({ amount: 1000, price: 2.0, shares: 500 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.avgCost).toBeCloseTo(1.333, 2);
    });
  });

  describe('卖出', () => {
    it('卖出后份额正确减少', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.shares).toBe(700);
      expect(result.shouldDelete).toBe(false);
    });

    it('卖出后总成本正确减少', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.totalCost).toBeCloseTo(550, 1);
    });

    it('卖出后均价重新计算', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.avgCost).toBeCloseTo(550 / 700, 3);
    });

    it('全部卖出后应标记删除', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 1000, amount: 1500 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(true);
    });
  });
});

// ============================================
// reverseTransactionOnHolding
// ============================================

describe('reverseTransactionOnHolding', () => {
  describe('反向买入（删除买入交易）', () => {
    it('反向买入后份额正确减少', () => {
      const existing = makeHolding({ shares: 1500, avgCost: 1.2, totalCost: 1800 });
      const tx = makeBuyTx({ amount: 500, price: 1.0, shares: 500 });

      const result = reverseTransactionOnHolding(existing, tx);

      expect(result.holding!.shares).toBe(1000);
      expect(result.holding!.totalCost).toBe(1300);
      expect(result.shouldDelete).toBe(false);
    });

    it('反向买入全部撤销后应标记删除', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeBuyTx({ amount: 1000, price: 1.0, shares: 1000 });

      const result = reverseTransactionOnHolding(existing, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(true);
    });
  });

  describe('反向卖出（删除卖出交易）', () => {
    it('反向卖出后份额正确恢复', () => {
      const existing = makeHolding({ shares: 700, avgCost: 0.786, totalCost: 550 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = reverseTransactionOnHolding(existing, tx);

      expect(result.holding!.shares).toBe(1000);
      expect(result.holding!.totalCost).toBe(1000);
      expect(result.shouldDelete).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('持仓不存在时返回 null', () => {
      const tx = makeBuyTx();
      const result = reverseTransactionOnHolding(undefined, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(false);
    });
  });
});

// ============================================
// canDeleteTransaction
// ============================================

describe('canDeleteTransaction', () => {
  it('交易不存在时返回不可删除', () => {
    const txs = [makeBuyTx({ id: 'tx1' })];
    const result = canDeleteTransaction(txs, 'nonexistent');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toBe('交易不存在');
  });

  it('卖出交易可以直接删除', () => {
    const txs = [makeSellTx({ id: 'tx1' })];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(true);
  });

  it('买入未被卖出可以删除', () => {
    const txs = [makeBuyTx({ id: 'tx1', shares: 1000 })];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(true);
  });

  it('买入被部分卖出不可删除', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 1000, price: 1.0 }),
      makeSellTx({ id: 'tx2', shares: 300, price: 1.2 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('300.00');
  });

  it('买入被完全卖出不可删除', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 1000, price: 1.0 }),
      makeSellTx({ id: 'tx2', shares: 1000, price: 1.2 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('1000.00');
  });

  it('多笔卖出匹配后检查', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 1000, price: 1.0 }),
      makeSellTx({ id: 'tx2', shares: 200, price: 1.2 }),
      makeSellTx({ id: 'tx3', shares: 300, price: 1.3 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('500.00');
  });

  it('多笔买入排序后匹配卖出', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 500, price: 1.0, date: '2024-01-01' }),
      makeBuyTx({ id: 'tx2', shares: 500, price: 2.0, date: '2024-02-01' }),
      makeSellTx({ id: 'tx3', shares: 300, price: 1.5 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('300.00');
  });
});

// ============================================
// addTransactionWithHoldingUpdate
// ============================================

describe('addTransactionWithHoldingUpdate', () => {
  it('Supabase 未配置时抛出错误', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload())
    ).rejects.toThrow('Supabase 未配置');
  });

  it('插入成功返回 transactionId', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-tx-id' }, error: null }),
        }),
      }),
    });

    const result = await addTransactionWithHoldingUpdate(makeAddTxPayload());
    expect(result.transactionId).toBe('new-tx-id');
    expect(result.holdingUpdated).toBe(true);
  });

  it('插入失败抛出错误', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload())
    ).rejects.toThrow('插入交易记录失败: DB error');
  });

  it('插入成功但未返回数据抛出错误', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload())
    ).rejects.toThrow('插入交易记录成功但未返回数据');
  });

  it('pending 状态不标记 holdingUpdated', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-tx-id' }, error: null }),
        }),
      }),
    });

    const result = await addTransactionWithHoldingUpdate(makeAddTxPayload({ status: 'pending' }));
    expect(result.holdingUpdated).toBe(false);
  });
});

// ============================================
// removeTransactionWithHoldingUpdate
// ============================================

describe('removeTransactionWithHoldingUpdate', () => {
  it('正常删除', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'tx1', fund_code: '000001' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

    await expect(removeTransactionWithHoldingUpdate('tx1')).resolves.toBeUndefined();
  });

  it('交易不存在直接返回', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    await expect(removeTransactionWithHoldingUpdate('tx-unknown')).resolves.toBeUndefined();
  });

  it('删除失败抛出错误', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'tx1' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
        }),
      });

    await expect(removeTransactionWithHoldingUpdate('tx1')).rejects.toThrow('删除交易失败: db error');
  });
});

// ============================================
// removeHoldingWithTransactions
// ============================================

describe('removeHoldingWithTransactions', () => {
  it('传入 fundCode 直接删除', async () => {
    mockFrom
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

    await expect(removeHoldingWithTransactions('h1', '000001')).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'transactions');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'holdings');
  });

  it('从 holdings 表查询 fundCode（向后兼容）', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { fund_code: '000001' }, error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

    await expect(removeHoldingWithTransactions('h1')).resolves.toBeUndefined();
  });

  it('查询不到 holding 直接返回', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    await expect(removeHoldingWithTransactions('h1')).resolves.toBeUndefined();
  });

  it('删除交易记录失败抛出错误', async () => {
    mockFrom
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'tx delete failed' } }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

    await expect(removeHoldingWithTransactions('h1', '000001')).rejects.toThrow(
      '删除交易记录失败: tx delete failed'
    );
  });

  it('删除持仓记录失败抛出错误', async () => {
    mockFrom
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'holding delete failed' } }),
        }),
      });

    await expect(removeHoldingWithTransactions('h1', '000001')).rejects.toThrow(
      '删除持仓记录失败: holding delete failed'
    );
  });
});

// ============================================
// processPendingTransactions
// ============================================

describe('processPendingTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    (window as any).__pendingTransactionsProcessing = false;
  });

  it('已在处理中返回空结果', async () => {
    (window as any).__pendingTransactionsProcessing = true;
    const result = await processPendingTransactions();
    expect(result).toEqual({ processedCount: 0, pendingCount: 0, errors: [] });
  });

  it('Supabase 未配置返回空结果', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    const result = await processPendingTransactions();
    expect(result).toEqual({ processedCount: 0, pendingCount: 0, errors: [] });
  });

  it('无 pending 交易返回空结果', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await processPendingTransactions();
    expect(result).toEqual({ processedCount: 0, pendingCount: 0, errors: [] });
  });

  it('单基金 pending buy 处理成功', async () => {
    const pendingTx = {
      id: 'tx1',
      fund_code: '000001',
      fund_name: 'Test Fund',
      type: 'buy',
      amount: 1000,
      shares: 0,
      date: '2024-03-10',
      confirm_date: '2024-03-11',
      status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(1);
    expect(result.pendingCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockFetchFundHistory).toHaveBeenCalledWith('000001', 100, 1, '2024-03-11', '2024-03-15');
  });

  it('多基金分组处理', async () => {
    const pendingTxs = [
      { id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0, date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending' },
      { id: 'tx2', fund_code: '000002', fund_name: 'B', type: 'buy', amount: 2000, shares: 0, date: '2024-03-10', confirm_date: '2024-03-12', status: 'pending' },
    ];

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: pendingTxs, error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockImplementation((code: string) => {
      if (code === '000001') {
        return Promise.resolve([{ date: '2024-03-11', nav: 2.0 }]);
      }
      return Promise.resolve([{ date: '2024-03-12', nav: 1.5 }]);
    });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(2);
    expect(result.pendingCount).toBe(0);
    expect(mockFetchFundHistory).toHaveBeenCalledTimes(2);
  });

  it('净值获取失败降级到最新净值', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue({ nav: 1.5, navDate: '2024-03-14' });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(1);
    expect(mockFetchFundNav).toHaveBeenCalledWith('000001');
  });

  it('navDate < confirmDate 且确认日超过5天跳过', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-01', confirm_date: '2024-03-05', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue({ nav: 1.5, navDate: '2024-03-01' });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.pendingCount).toBe(1);
  });

  it('navDate < confirmDate 但确认日在5天内仍处理', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-10', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue({ nav: 1.5, navDate: '2024-03-09' });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(1);
    expect(result.pendingCount).toBe(0);
  });

  it('confirmDate >= today 跳过', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-15', confirm_date: '2024-03-15', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue({ nav: 1.5, navDate: '2024-03-14' });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.pendingCount).toBe(1);
  });

  it('buy 类型正确计算 shares', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    const updatePayloads: any[] = [];
    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn((payload: any) => {
          updatePayloads.push(payload);
          return {
            eq: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    await processPendingTransactions();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0].nav).toBe(2.0);
    expect(updatePayloads[0].shares).toBeCloseTo(500, 0);
    expect(updatePayloads[0].amount).toBe(1000);
    expect(updatePayloads[0].status).toBe('completed');
  });

  it('sell 类型正确计算 amount', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'sell', amount: 0, shares: 100,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    const updatePayloads: any[] = [];
    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn((payload: any) => {
          updatePayloads.push(payload);
          return {
            eq: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    await processPendingTransactions();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0].nav).toBe(2.0);
    expect(updatePayloads[0].shares).toBe(100);
    expect(updatePayloads[0].amount).toBeCloseTo(200, 0);
    expect(updatePayloads[0].status).toBe('completed');
  });

  it('无法获取净值记录错误', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue(null);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('000001: 无法获取净值');
  });

  it('更新失败记录错误', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: 'update failed' } })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('000001: 更新失败: update failed');
  });

  it('fetchFundHistory 抛异常静默忽略', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockRejectedValue(new Error('network error'));

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('000001: 无法获取净值');
  });
});
