import { describe, it, expect } from '@jest/globals';

jest.mock('../../services/fundApi', () => ({ batchFetchNav: jest.fn() }));

import { groupTransactionsByLot } from '../../services/lotTraceService';
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

describe('groupTransactionsByLot', () => {
  it('no buys for fund returns empty', () => {
    const result = groupTransactionsByLot([], '000001');
    expect(result).toHaveLength(0);
  });

  it('single buy no sells returns one timeline', () => {
    const txs = [makeBuyTx()];
    const result = groupTransactionsByLot(txs, '000001');
    expect(result).toHaveLength(1);
    expect(result[0].totalShares).toBe(1000);
    expect(result[0].remainingShares).toBe(1000);
    expect(result[0].items).toHaveLength(0);
  });

  it('buy + sell creates timeline with sold item', () => {
    const txs = [makeBuyTx(), makeSellTx()];
    const result = groupTransactionsByLot(txs, '000001');
    expect(result).toHaveLength(1);
    expect(result[0].remainingShares).toBe(700);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].soldShares).toBe(300);
  });

  it('two buys, sell matches lowest cost first', () => {
    const b1 = makeBuyTx({ id: 'b1', price: 2.0, shares: 500, amount: 1000 });
    const b2 = makeBuyTx({ id: 'b2', price: 1.0, shares: 500, amount: 500 });
    const sell = makeSellTx({ shares: 600, amount: 600 });
    const result = groupTransactionsByLot([b1, b2, sell], '000001');
    // b2 (cost 1.0) consumed first: 500 shares, then b1: 100 shares
    const b2Timeline = result.find(t => t.buyTransaction.id === 'b2');
    const b1Timeline = result.find(t => t.buyTransaction.id === 'b1');
    // b2 (cost 1.0) consumed first: 500 shares from sell of 600, remaining 100 from b1
    expect(b2Timeline!.remainingShares).toBe(0); // fully consumed
    expect(b1Timeline!.remainingShares).toBe(400); // 500 - 100 = 400
    expect(b1Timeline!.items[0].soldShares).toBe(100);
  });

  it('different fund codes are separated', () => {
    const b1 = makeBuyTx({ fundCode: '000001' });
    const b2 = makeBuyTx({ id: 'b2', fundCode: '000002' });
    const result1 = groupTransactionsByLot([b1, b2], '000001');
    const result2 = groupTransactionsByLot([b1, b2], '000002');
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
  });
});
