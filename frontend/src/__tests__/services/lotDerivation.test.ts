import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveLots,
  deriveRealizedLots,
  summarizeHoldings,
  matchSellLots,
  type Lot,
  type RealizedLot,
} from '../../services/navUpdateService';
import type { Transaction } from '../../types';

function makeBuyTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
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
  return {
    id: crypto.randomUUID(),
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    type: 'sell',
    date: '2024-02-15',
    amount: 500,
    price: 1.2,
    shares: 416.67,
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('deriveLots - 批次派生', () => {
  describe('基础买入', () => {
    it('单一买入交易生成一个批次', () => {
      const txs = [makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0 })];
      
      const lots = deriveLots(txs);
      
      expect(lots).toHaveLength(1);
      expect(lots[0].fundCode).toBe('000001');
      expect(lots[0].shares).toBe(1000);
      expect(lots[0].remainingShares).toBe(1000);
      expect(lots[0].cost).toBe(1.0);
      expect(lots[0].isPending).toBe(false);
    });

    it('多个买入交易生成多个批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0 }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.2 }),
      ];
      
      const lots = deriveLots(txs);
      
      expect(lots).toHaveLength(2);
    });
  });

  describe('在途交易', () => {
    it('pending 状态的买入不计入持仓份额', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, status: 'completed' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.2, status: 'pending', amount: 600 }),
      ];
      
      const lots = deriveLots(txs);
      
      // completed 买入有 remainingShares，pending 买入 remainingShares 为 0
      const completedLot = lots.find(l => l.id === 'buy_001');
      const pendingLot = lots.find(l => l.id === 'buy_002');
      
      expect(completedLot?.remainingShares).toBe(1000);
      expect(pendingLot?.remainingShares).toBe(0);
      expect(pendingLot?.isPending).toBe(true);
      expect(pendingLot?.amount).toBe(600);
    });
  });

  describe('卖出匹配 - 按成本最低优先', () => {
    it('卖出时先匹配成本低的批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0 }), // 成本 1.0
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.5 }),  // 成本 1.5
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.2 }), // 卖出 300 份
      ];
      
      const lots = deriveLots(txs);
      
      // 成本 1.0 的批次应该先被卖出
      const lot1 = lots.find(l => l.id === 'buy_001');
      const lot2 = lots.find(l => l.id === 'buy_002');
      
      expect(lot1?.remainingShares).toBe(700); // 1000 - 300
      expect(lot2?.remainingShares).toBe(500); // 未被卖出
    });

    it('卖出超过第一个批次的份额，会延续到下一个批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 100, price: 1.0 }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 100, price: 2.0 }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 150, price: 1.5 }),
      ];
      
      const lots = deriveLots(txs);
      
      // buy_001 剩余 0，被过滤掉（remainingShares > 0 才保留）
      const lot1 = lots.find(l => l.id === 'buy_001');
      const lot2 = lots.find(l => l.id === 'buy_002');
      
      expect(lot1).toBeUndefined(); // 全部卖出后被过滤
      expect(lot2?.remainingShares).toBe(50); // 卖出 50，还剩 50
    });

    it('跳过在途批次不参与卖出匹配', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 500, price: 1.0, status: 'pending' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.5, status: 'completed' }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.2 }),
      ];
      
      const lots = deriveLots(txs);
      
      // 只有 completed 的 buy_002 参与匹配
      const lot2 = lots.find(l => l.id === 'buy_002');
      expect(lot2?.remainingShares).toBe(200);
    });
  });

  describe('gridExecutionId 精确匹配', () => {
    it('卖出时优先匹配相同 gridExecutionId 的批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 500, price: 1.0, gridExecutionId: 'grid2' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 2.0, gridExecutionId: 'grid2' }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.2, gridExecutionId: 'grid2' }),
      ];

      const lots = deriveLots(txs);

      const lot1 = lots.find(l => l.id === 'buy_001');
      const lot2 = lots.find(l => l.id === 'buy_002');

      expect(lot1?.remainingShares).toBe(200);
      expect(lot2?.remainingShares).toBe(500);
    });

    it('gridExecutionId 匹配不足时 fallback 到成本升序', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 500, price: 1.0, gridExecutionId: 'grid1' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 2.0, gridExecutionId: 'grid2' }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 700, price: 1.2, gridExecutionId: 'grid2' }),
      ];

      const lots = deriveLots(txs);

      const lot1 = lots.find(l => l.id === 'buy_001');
      const lot2 = lots.find(l => l.id === 'buy_002');

      expect(lot1?.remainingShares).toBe(300);
      expect(lot2).toBeUndefined();
    });
  });

  describe('边界情况', () => {
    it('无交易返回空数组', () => {
      const lots = deriveLots([]);
      expect(lots).toHaveLength(0);
    });

    it('只有卖出交易返回空数组', () => {
      const txs = [makeSellTx()];
      const lots = deriveLots(txs);
      expect(lots).toHaveLength(0);
    });

    it('卖出份额为0被跳过', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 1000, price: 1.0 }),
        makeSellTx({ id: 'sell_001', shares: 0, price: 1.2 }),
      ];

      const lots = deriveLots(txs);

      expect(lots).toHaveLength(1);
      expect(lots[0].remainingShares).toBe(1000);
    });

    it('卖出金额超过持仓份额，remainingShares 为负导致批次被过滤', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 100, price: 1.0 }),
        makeSellTx({ id: 'sell_001', shares: 150, price: 1.2 }),
      ];
      
      const lots = deriveLots(txs);
      
      // remainingShares 为 -50，被过滤掉（remainingShares > 0 才保留）
      expect(lots).toHaveLength(0);
    });
  });
});

describe('deriveRealizedLots - 已实现盈亏派生', () => {
  describe('基础已实现盈亏计算', () => {
    it('卖出后正确计算盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, amount: 1000 }),
        makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 1000, price: 1.2, amount: 1200 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      expect(realized).toHaveLength(1);
      expect(realized[0].profit).toBeCloseTo(200, 0); // 1200 - 1000
      expect(realized[0].profitRate).toBeCloseTo(0.2, 2); // 20%
      expect(realized[0].holdingDays).toBe(31); // 1月1日到2月1日
    });

    it('亏损情况', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 1000, price: 1.2, amount: 1200 }),
        makeSellTx({ id: 'sell_001', shares: 1000, price: 1.0, amount: 1000 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      expect(realized[0].profit).toBeLessThan(0);
      expect(realized[0].profitRate).toBeLessThan(0);
    });
  });

  describe('部分卖出', () => {
    it('部分卖出也记录已实现盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 1000, price: 1.0 }),
        makeSellTx({ id: 'sell_001', shares: 500, price: 1.2 }),
      ];

      const realized = deriveRealizedLots(txs);

      // 每次卖出都记录，包括部分卖出
      expect(realized).toHaveLength(1);
      expect(realized[0].shares).toBe(500);
      expect(realized[0].profit).toBeCloseTo(100, 0); // 500 * (1.2 - 1.0)
    });
  });

  describe('多批次卖出', () => {
    it('分批卖出 - 每次卖出都记录已实现盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 100, price: 1.0, amount: 100 }),
        makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 60, price: 1.2, amount: 72 }),
        makeSellTx({ id: 'sell_002', date: '2024-03-01', shares: 40, price: 1.3, amount: 52 }),
      ];

      const realized = deriveRealizedLots(txs);

      // sell_001 卖 60: profit = 60 * (1.2 - 1.0) = 12
      // sell_002 卖 40: profit = 40 * (1.3 - 1.0) = 12
      // 结果按卖出日期倒序排列
      expect(realized).toHaveLength(2);
      expect(realized[0].profit).toBeCloseTo(12, 0);
      expect(realized[0].shares).toBe(40); // sell_002 (较晚)
      expect(realized[1].profit).toBeCloseTo(12, 0);
      expect(realized[1].shares).toBe(60); // sell_001 (较早)
    });

    it('单笔完全卖出正确记录盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 100, price: 1.0, amount: 100 }),
        makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 100, price: 1.5, amount: 150 }),
      ];

      const realized = deriveRealizedLots(txs);

      expect(realized).toHaveLength(1);
      expect(realized[0].profit).toBeCloseTo(50, 0); // 100 * (1.5 - 1.0)
      expect(realized[0].profitRate).toBeCloseTo(0.5, 2); // 50%
    });
  });

  describe('gridExecutionId 精确匹配', () => {
    it('按 gridExecutionId 精确匹配计算盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 500, price: 1.0, amount: 500, gridExecutionId: 'grid2' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 2.0, amount: 1000, gridExecutionId: 'grid2' }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.5, amount: 450, gridExecutionId: 'grid2' }),
      ];

      const realized = deriveRealizedLots(txs);

      expect(realized).toHaveLength(1);
      expect(realized[0].id).toBe('buy_001');
      expect(realized[0].shares).toBe(300);
      expect(realized[0].profit).toBeCloseTo(150, 0);
    });
  });

  describe('边界情况', () => {
    it('卖出份额为0不产生已实现盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 1000, price: 1.0, amount: 1000 }),
        makeSellTx({ id: 'sell_001', shares: 0, price: 1.2, amount: 0 }),
      ];

      const realized = deriveRealizedLots(txs);

      expect(realized).toHaveLength(0);
    });
  });
});

describe('summarizeHoldings - 持仓汇总', () => {
  it('同一基金多批次合并计算', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 500, cost: 1.0, date: '2024-01-01', isPending: false },
      { id: '2', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 300, cost: 1.5, date: '2024-02-01', isPending: false },
    ];
    
    const summary = summarizeHoldings(lots);
    
    expect(summary).toHaveLength(1);
    expect(summary[0].shares).toBe(800); // 500 + 300
    expect(summary[0].totalCost).toBeCloseTo(950, 0); // 500*1.0 + 300*1.5
    expect(summary[0].avgCost).toBeCloseTo(1.1875, 3); // 950 / 800
  });

  it('不同基金分别汇总', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 100, remainingShares: 100, cost: 1.0, date: '2024-01-01', isPending: false },
      { id: '2', fundCode: '000002', fundName: '易方达', shares: 200, remainingShares: 200, cost: 2.0, date: '2024-01-01', isPending: false },
    ];
    
    const summary = summarizeHoldings(lots);
    
    expect(summary).toHaveLength(2);
  });
});

describe('matchSellLots - 卖出匹配', () => {
  it('基础卖出匹配', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 500, cost: 1.0, date: '2024-01-01', isPending: false },
      { id: '2', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 500, cost: 1.5, date: '2024-02-01', isPending: false },
    ];
    
    const result = matchSellLots(lots, '000001', 300);
    
    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lotId).toBe('1');
    expect(result.lotsUsed[0].shares).toBe(300);
    expect(result.remainingShares).toBe(0);
  });

  it('卖出超过持仓返回剩余', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 100, remainingShares: 100, cost: 1.0, date: '2024-01-01', isPending: false },
    ];

    const result = matchSellLots(lots, '000001', 150);

    expect(result.lotsUsed[0].shares).toBe(100);
    expect(result.remainingShares).toBe(50);
  });

  it('gridExecutionId 精确匹配', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: 'A', shares: 500, remainingShares: 500, cost: 1.0, date: '2024-01-01', isPending: false, gridExecutionId: 'grid2' },
      { id: '2', fundCode: '000001', fundName: 'A', shares: 500, remainingShares: 500, cost: 2.0, date: '2024-02-01', isPending: false, gridExecutionId: 'grid2' },
    ];

    const result = matchSellLots(lots, '000001', 300, 'grid2');

    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lotId).toBe('1');
    expect(result.lotsUsed[0].shares).toBe(300);
    expect(result.remainingShares).toBe(0);
  });

  it('gridExecutionId 匹配不足时 fallback', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: 'A', shares: 500, remainingShares: 500, cost: 1.0, date: '2024-01-01', isPending: false, gridExecutionId: 'grid1' },
      { id: '2', fundCode: '000001', fundName: 'A', shares: 500, remainingShares: 500, cost: 2.0, date: '2024-02-01', isPending: false, gridExecutionId: 'grid2' },
    ];

    const result = matchSellLots(lots, '000001', 700, 'grid2');

    expect(result.lotsUsed).toHaveLength(2);
    expect(result.lotsUsed[0].lotId).toBe('2');
    expect(result.lotsUsed[0].shares).toBe(500);
    expect(result.lotsUsed[1].lotId).toBe('1');
    expect(result.lotsUsed[1].shares).toBe(200);
    expect(result.remainingShares).toBe(0);
  });
});

describe('gridExecutionId 精确匹配', () => {
  it('deriveLots 优先按 gridExecutionId 匹配', () => {
    const txs = [
      makeBuyTx({ id: 'buy1', shares: 100, price: 1.0, gridExecutionId: 'grid1' }),
      makeBuyTx({ id: 'buy2', shares: 100, price: 0.8, gridExecutionId: 'grid2' }),
      makeSellTx({ id: 'sell1', shares: 50, price: 1.2, gridExecutionId: 'grid1' }),
    ];

    const lots = deriveLots(txs);
    const lot1 = lots.find(l => l.id === 'buy1');
    const lot2 = lots.find(l => l.id === 'buy2');

    expect(lot1?.remainingShares).toBe(50);
    expect(lot2?.remainingShares).toBe(100);
  });

  it('deriveLots 精确匹配后 fallback 匹配剩余', () => {
    const txs = [
      makeBuyTx({ id: 'buy1', shares: 100, price: 1.0, gridExecutionId: 'grid1' }),
      makeBuyTx({ id: 'buy2', shares: 100, price: 0.8 }),
      makeSellTx({ id: 'sell1', shares: 150, price: 1.2, gridExecutionId: 'grid1' }),
    ];

    const lots = deriveLots(txs);
    const lot1 = lots.find(l => l.id === 'buy1');
    const lot2 = lots.find(l => l.id === 'buy2');

    expect(lot1).toBeUndefined();
    expect(lot2?.remainingShares).toBe(50);
  });

  it('deriveLots 忽略 shares <= 0 的卖出', () => {
    const txs = [
      makeBuyTx({ id: 'buy1', shares: 100, price: 1.0 }),
      makeSellTx({ id: 'sell1', shares: 0, price: 1.2 }),
    ];

    const lots = deriveLots(txs);
    expect(lots).toHaveLength(1);
    expect(lots[0].remainingShares).toBe(100);
  });

  it('deriveRealizedLots 按 gridExecutionId 精确匹配记录盈亏', () => {
    const txs = [
      makeBuyTx({ id: 'buy1', shares: 100, price: 1.0, gridExecutionId: 'grid1' }),
      makeBuyTx({ id: 'buy2', shares: 100, price: 0.8, gridExecutionId: 'grid2' }),
      makeSellTx({ id: 'sell1', shares: 50, price: 1.2, gridExecutionId: 'grid1' }),
    ];

    const realized = deriveRealizedLots(txs);
    const r1 = realized.find(r => r.id === 'buy1');

    expect(r1?.shares).toBe(50);
    expect(r1?.profit).toBeCloseTo(10, 1);
  });

  it('deriveRealizedLots 忽略 shares <= 0 的卖出', () => {
    const txs = [
      makeBuyTx({ id: 'buy1', shares: 100, price: 1.0 }),
      makeSellTx({ id: 'sell1', shares: 0, price: 1.2 }),
    ];

    const realized = deriveRealizedLots(txs);
    expect(realized).toHaveLength(0);
  });

  it('matchSellLots 按 gridExecutionId 精确匹配', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 100, remainingShares: 100, cost: 1.0, date: '2024-01-01', isPending: false, gridExecutionId: 'grid1' },
      { id: '2', fundCode: '000001', fundName: '华夏', shares: 100, remainingShares: 100, cost: 0.8, date: '2024-02-01', isPending: false, gridExecutionId: 'grid2' },
    ];

    const result = matchSellLots(lots, '000001', 50, 'grid2');

    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lotId).toBe('2');
    expect(result.remainingShares).toBe(0);
  });
});

// ============================================
// 修复 #1：lot_id 精确匹配（手动按批次卖出）
// ============================================
describe('lot_id 精确匹配 - 按批次卖出', () => {
  it('deriveLots 优先按 lotId 扣减指定批次，而非成本最低批次', () => {
    const txs = [
      makeBuyTx({ id: 'buy_low', date: '2024-01-01', shares: 1000, price: 1.0 }),  // 成本最低
      makeBuyTx({ id: 'buy_high', date: '2024-02-01', shares: 1000, price: 2.0 }), // 用户想卖这个
      makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.5, lotId: 'buy_high' }),
    ];

    const lots = deriveLots(txs);
    const low = lots.find(l => l.id === 'buy_low');
    const high = lots.find(l => l.id === 'buy_high');

    // 成本最低的批次不应被动，扣的是用户指定的 buy_high
    expect(low?.remainingShares).toBe(1000);
    expect(high?.remainingShares).toBe(700);
  });

  it('deriveRealizedLots 按 lotId 计算被卖批次的盈亏', () => {
    const txs = [
      makeBuyTx({ id: 'buy_low', date: '2024-01-01', shares: 1000, price: 1.0 }),
      makeBuyTx({ id: 'buy_high', date: '2024-02-01', shares: 1000, price: 2.0 }),
      makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.5, lotId: 'buy_high' }),
    ];

    const realized = deriveRealizedLots(txs);

    expect(realized).toHaveLength(1);
    expect(realized[0].id).toBe('buy_high');
    // 卖出 buy_high（成本 2.0）300 份，亏损：300 * (1.5 - 2.0) = -150
    expect(realized[0].profit).toBeCloseTo(-150, 0);
  });

  it('lotId 份额不足时 fallback 到成本升序', () => {
    const txs = [
      makeBuyTx({ id: 'buy_low', date: '2024-01-01', shares: 100, price: 1.0 }),
      makeBuyTx({ id: 'buy_high', date: '2024-02-01', shares: 100, price: 2.0 }),
      makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 150, price: 1.5, lotId: 'buy_high' }),
    ];

    const lots = deriveLots(txs);
    const low = lots.find(l => l.id === 'buy_low');
    const high = lots.find(l => l.id === 'buy_high');

    // 先扣完 buy_high 100 份，剩 50 份 fallback 到成本最低的 buy_low
    expect(high).toBeUndefined();
    expect(low?.remainingShares).toBe(50);
  });

  it('matchSellLots 支持 lotId 精确匹配', () => {
    const lots: Lot[] = [
      { id: 'low', fundCode: '000001', fundName: 'A', shares: 100, remainingShares: 100, cost: 1.0, date: '2024-01-01', isPending: false },
      { id: 'high', fundCode: '000001', fundName: 'A', shares: 100, remainingShares: 100, cost: 2.0, date: '2024-02-01', isPending: false },
    ];

    const result = matchSellLots(lots, '000001', 60, undefined, 'high');

    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lotId).toBe('high');
    expect(result.remainingShares).toBe(0);
  });
});

// ============================================
// 修复 #4：手续费分摊后的盈亏计算
// ============================================
describe('手续费分摊盈亏', () => {
  it('买入/卖出手续费按份额比例计入成本与收入', () => {
    const txs = [
      makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, fee: 10 }),
      makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 1000, price: 1.2, fee: 12 }),
    ];

    const realized = deriveRealizedLots(txs);

    // cost = 1000*1.0 + 10 = 1010; revenue = 1000*1.2 - 12 = 1188; profit = 178
    expect(realized[0].cost).toBeCloseTo(1010, 2);
    expect(realized[0].revenue).toBeCloseTo(1188, 2);
    expect(realized[0].profit).toBeCloseTo(178, 2);
  });

  it('部分卖出按比例分摊手续费', () => {
    const txs = [
      makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, fee: 10 }),
      makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 500, price: 1.2, fee: 6 }),
    ];

    const realized = deriveRealizedLots(txs);

    // 卖 500/1000：买入费分摊 10*500/1000=5；卖出费 6*500/500=6
    // cost = 500*1.0 + 5 = 505; revenue = 500*1.2 - 6 = 594; profit = 89
    expect(realized[0].cost).toBeCloseTo(505, 2);
    expect(realized[0].revenue).toBeCloseTo(594, 2);
    expect(realized[0].profit).toBeCloseTo(89, 2);
  });

  it('fee 为 0 时盈亏不含手续费', () => {
    const txs = [
      makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, fee: 0 }),
      makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 1000, price: 1.2, fee: 0 }),
    ];

    const realized = deriveRealizedLots(txs);
    expect(realized[0].profit).toBeCloseTo(200, 2);
  });
});

// ============================================
// 修复 #8：同日交易按 createdAt 稳定排序
// ============================================
describe('同日交易稳定排序', () => {
  it('同日多笔买入按 createdAt 顺序匹配，结果稳定', () => {
    const txs = [
      makeBuyTx({ id: 'buy_b', date: '2024-01-01', shares: 100, price: 1.0, createdAt: '2024-01-01T10:00:00Z' }),
      makeBuyTx({ id: 'buy_a', date: '2024-01-01', shares: 100, price: 1.0, createdAt: '2024-01-01T09:00:00Z' }),
      makeSellTx({ id: 'sell', date: '2024-02-01', shares: 100, price: 1.5, createdAt: '2024-02-01T09:00:00Z' }),
    ];

    const realized = deriveRealizedLots(txs);
    // 成本相同，先创建的 buy_a 先被匹配
    expect(realized).toHaveLength(1);
    expect(realized[0].id).toBe('buy_a');
  });
});
