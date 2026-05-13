import { describe, it, expect } from '@jest/globals';

// Mock navUpdateService dependencies so pure functions can be imported
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() }, isSupabaseConfigured: () => false }));
jest.mock('../../services/fundApi', () => ({ fetchFundNav: jest.fn(), fetchFundHistory: jest.fn() }));
jest.mock('../../services/alertService', () => ({ createAlert: jest.fn() }));
jest.mock('../../utils/csv', () => ({ formatLocalDate: (d: Date) => d.toISOString().split('T')[0] }));

import { deriveLots, deriveRealizedLots, summarizeHoldings, matchSellLots, canDeleteTransaction } from '../../services/navUpdateService';
import type { Transaction } from '../../types';

function makeBuyTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'buy_001', fundId: 'f_001', fundCode: '000001', fundName: '测试基金',
    type: 'buy', date: '2024-01-10', amount: 1000, price: 1.0, shares: 1000,
    status: 'completed', createdAt: '2024-01-10T00:00:00Z', ...overrides,
  };
}
function makeSellTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'sell_001', fundId: 'f_001', fundCode: '000001', fundName: '测试基金',
    type: 'sell', date: '2024-06-15', amount: 370, price: 1.2345, shares: 300,
    status: 'completed', createdAt: '2024-06-15T00:00:00Z', ...overrides,
  };
}

describe('deriveLots', () => {
  it('single buy returns one lot with full shares', () => {
    const lots = deriveLots([makeBuyTx()]);
    expect(lots).toHaveLength(1);
    expect(lots[0].remainingShares).toBe(1000);
  });

  it('buy + partial sell reduces remaining shares', () => {
    const lots = deriveLots([makeBuyTx(), makeSellTx()]);
    expect(lots).toHaveLength(1);
    expect(lots[0].remainingShares).toBe(700);
  });

  it('sell exceeding available shares depletes all', () => {
    const sell = makeSellTx({ shares: 1500, amount: 1500 });
    const lots = deriveLots([makeBuyTx(), sell]);
    expect(lots).toHaveLength(0);
  });

  it('pending buy has remainingShares=0 and isPending=true', () => {
    const pending = makeBuyTx({ status: 'pending', amount: 1000 });
    const lots = deriveLots([pending]);
    expect(lots).toHaveLength(1);
    expect(lots[0].remainingShares).toBe(0);
    expect(lots[0].isPending).toBe(true);
  });

  it('sells match by cost ascending (lowest first)', () => {
    const buy1 = makeBuyTx({ id: 'b1', price: 2.0, shares: 500, amount: 1000 });
    const buy2 = makeBuyTx({ id: 'b2', price: 1.0, shares: 500, amount: 500 });
    const sell = makeSellTx({ shares: 800, amount: 800 });
    const lots = deriveLots([buy1, buy2, sell]);
    // Lots sorted ascending: b2 (1.0 first) fully consumed, b1 (2.0) partially consumed
    expect(lots).toHaveLength(1);
    expect(lots[0].id).toBe('b1');
    expect(lots[0].remainingShares).toBe(200); // 500 - (800 - 500) = 200
  });
});

describe('deriveRealizedLots', () => {
  it('single buy + partial sell returns realized lot with profit', () => {
    const lots = deriveRealizedLots([makeBuyTx(), makeSellTx()]);
    expect(lots).toHaveLength(1);
    expect(lots[0].shares).toBe(300);
    expect(lots[0].profit).toBeCloseTo(300 * 1.2345 - 300 * 1.0, 2);
  });

  it('no sells returns empty', () => {
    expect(deriveRealizedLots([makeBuyTx()])).toHaveLength(0);
  });
});

describe('summarizeHoldings', () => {
  it('aggregates by fund code', () => {
    const lots = deriveLots([
      makeBuyTx({ fundCode: '000001', shares: 500 }),
      makeBuyTx({ fundCode: '000001', shares: 500 }),
    ]);
    const summaries = summarizeHoldings(lots);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].shares).toBe(1000);
  });
});

describe('matchSellLots', () => {
  it('returns lots used and remaining', () => {
    const lots = deriveLots([makeBuyTx(), makeBuyTx({ id: 'b2', shares: 500, amount: 500, price: 1.0 })]);
    const result = matchSellLots(lots, '000001', 1200);
    expect(result.remainingShares).toBe(0);
    expect(result.lotsUsed.length).toBeGreaterThan(0);
  });
});

describe('canDeleteTransaction', () => {
  it('sell transaction can be deleted', () => {
    expect(canDeleteTransaction([makeSellTx()], 'sell_001').canDelete).toBe(true);
  });

  it('buy transaction with no sells can be deleted', () => {
    expect(canDeleteTransaction([makeBuyTx()], 'buy_001').canDelete).toBe(true);
  });

  it('buy transaction with partial sell cannot be deleted', () => {
    expect(canDeleteTransaction([makeBuyTx(), makeSellTx()], 'buy_001').canDelete).toBe(false);
  });
});
