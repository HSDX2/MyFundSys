import { describe, it, expect } from 'vitest';
import { groupTransactionsByLot } from '../../services/lotTraceService';
import type { Transaction } from '../../types';

function makeBuyTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'buy_001',
    fundId: 'f_001',
    fundCode: '000001',
    fundName: '测试基金',
    type: 'buy',
    date: '2024-01-10',
    amount: 1000,
    price: 1.0,
    shares: 1000,
    status: 'completed',
    createdAt: '2024-01-10T00:00:00Z',
    ...overrides,
  };
}

function makeSellTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'sell_001',
    fundId: 'f_001',
    fundCode: '000001',
    fundName: '测试基金',
    type: 'sell',
    date: '2024-06-15',
    amount: 370,
    price: 1.2345,
    shares: 300,
    status: 'completed',
    createdAt: '2024-06-15T00:00:00Z',
    ...overrides,
  };
}

describe('groupTransactionsByLot', () => {
  it('returns empty array when no transactions for fund', () => {
    const result = groupTransactionsByLot([], '000001');
    expect(result).toEqual([]);
  });

  it('returns empty array when no buy transactions for fund', () => {
    const sellTx = makeSellTx();
    const result = groupTransactionsByLot([sellTx], '000001');
    expect(result).toEqual([]);
  });

  it('single buy with no sells returns one timeline with full remaining shares', () => {
    const buyTx = makeBuyTx();
    const result = groupTransactionsByLot([buyTx], '000001');
    expect(result).toHaveLength(1);
    expect(result[0].buyTransaction).toBe(buyTx);
    expect(result[0].totalShares).toBe(1000);
    expect(result[0].remainingShares).toBe(1000);
    expect(result[0].totalCost).toBe(1000);
    expect(result[0].items).toEqual([]);
  });

  it('single buy with one partial sell returns one timeline with reduced shares', () => {
    const buyTx = makeBuyTx();
    const sellTx = makeSellTx({ id: 'sell_001', shares: 300 });
    const result = groupTransactionsByLot([buyTx, sellTx], '000001');
    expect(result).toHaveLength(1);
    expect(result[0].totalShares).toBe(1000);
    expect(result[0].remainingShares).toBe(700);
    expect(result[0].totalCost).toBeCloseTo(700, 6);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].sellTx).toBe(sellTx);
    expect(result[0].items[0].soldShares).toBe(300);
    expect(result[0].items[0].profit).toBeCloseTo(300 * 1.2345 - 300 * 1.0, 6);
    expect(result[0].items[0].profitRate).toBeCloseTo((1.2345 - 1.0) / 1.0, 6);
  });

  it('single buy with multiple partial sells produces multiple items', () => {
    const buyTx = makeBuyTx({ id: 'buy_001', price: 1.0, shares: 1000, amount: 1000 });
    const sell1 = makeSellTx({ id: 'sell_001', date: '2024-06-15', shares: 300, price: 1.2345, amount: 370 });
    const sell2 = makeSellTx({ id: 'sell_002', date: '2024-09-20', shares: 200, price: 1.35, amount: 270 });
    const sell3 = makeSellTx({ id: 'sell_003', date: '2024-12-01', shares: 100, price: 1.5, amount: 150 });
    const result = groupTransactionsByLot([buyTx, sell1, sell2, sell3], '000001');
    expect(result).toHaveLength(1);
    expect(result[0].remainingShares).toBe(400);
    expect(result[0].items).toHaveLength(3);
    expect(result[0].items[0].soldShares).toBe(300);
    expect(result[0].items[1].soldShares).toBe(200);
    expect(result[0].items[2].soldShares).toBe(100);
  });

  it('multiple buys for same fund produces multiple timelines', () => {
    const buy1 = makeBuyTx({ id: 'buy_001', date: '2024-01-10', price: 1.0, shares: 500, amount: 500 });
    const buy2 = makeBuyTx({ id: 'buy_002', date: '2024-03-15', price: 1.2, shares: 300, amount: 360 });
    const result = groupTransactionsByLot([buy1, buy2], '000001');
    expect(result).toHaveLength(2);
    expect(result[0].buyTransaction).toBe(buy1);
    expect(result[0].remainingShares).toBe(500);
    expect(result[1].buyTransaction).toBe(buy2);
    expect(result[1].remainingShares).toBe(300);
  });

  it('two buys, sell matches first by cost (lower cost first)', () => {
    const buy1 = makeBuyTx({ id: 'buy_001', date: '2024-01-10', price: 1.5, shares: 500, amount: 750 });
    const buy2 = makeBuyTx({ id: 'buy_002', date: '2024-03-15', price: 1.0, shares: 500, amount: 500 });
    const sellTx = makeSellTx({ id: 'sell_001', shares: 400, price: 1.8 });
    const result = groupTransactionsByLot([buy1, buy2, sellTx], '000001');
    // sell should match buy2 first (cost 1.0 < 1.5)
    expect(result).toHaveLength(2);
    expect(result[0].buyTransaction).toBe(buy1);
    expect(result[0].remainingShares).toBe(500);
    expect(result[0].items).toHaveLength(0);
    expect(result[1].buyTransaction).toBe(buy2);
    expect(result[1].remainingShares).toBe(100);
    expect(result[1].items).toHaveLength(1);
    expect(result[1].items[0].soldShares).toBe(400);
  });

  it('sell with gridExecutionId matches exact lot', () => {
    const buy1 = makeBuyTx({ id: 'buy_001', date: '2024-01-10', price: 1.0, shares: 500, amount: 500 });
    const buy2 = makeBuyTx({ id: 'buy_002', date: '2024-03-15', price: 1.5, shares: 500, amount: 750, gridExecutionId: 'grid_001' });
    const sellTx = makeSellTx({ id: 'sell_001', shares: 300, price: 1.8, gridExecutionId: 'grid_001' });
    const result = groupTransactionsByLot([buy1, buy2, sellTx], '000001');
    // sell should match buy2 (gridExecutionId exact match) even though buy1 has lower cost
    expect(result).toHaveLength(2);
    expect(result[1].buyTransaction).toBe(buy2);
    expect(result[1].remainingShares).toBe(200);
    expect(result[1].items).toHaveLength(1);
    expect(result[0].remainingShares).toBe(500);
    expect(result[0].items).toHaveLength(0);
  });

  it('pending buy is excluded from matching (remainingShares = 0)', () => {
    const buyCompleted = makeBuyTx({ id: 'buy_001', price: 1.0, shares: 500, amount: 500 });
    const buyPending = makeBuyTx({ id: 'buy_002', date: '2024-03-15', price: 1.2, shares: 300, amount: 360, status: 'pending' });
    const sellTx = makeSellTx({ id: 'sell_001', shares: 200, price: 1.5 });
    const result = groupTransactionsByLot([buyCompleted, buyPending, sellTx], '000001');
    expect(result).toHaveLength(2);
    // sell should only match completed buy
    expect(result[0].buyTransaction).toBe(buyCompleted);
    expect(result[0].remainingShares).toBe(300);
    expect(result[0].items).toHaveLength(1);
    // pending buy stays untouched
    expect(result[1].remainingShares).toBe(0);
    expect(result[1].items).toHaveLength(0);
  });

  it('ignores sell transactions from other funds', () => {
    const buyTx = makeBuyTx();
    const otherSell = makeSellTx({ fundCode: '000002', id: 'sell_other' });
    const result = groupTransactionsByLot([buyTx, otherSell], '000001');
    expect(result).toHaveLength(1);
    expect(result[0].remainingShares).toBe(1000);
    expect(result[0].items).toHaveLength(0);
  });

  it('calculates holdingDays correctly', () => {
    const buyTx = makeBuyTx({ date: '2024-01-10' });
    const sellTx = makeSellTx({ date: '2024-06-15', shares: 300 });
    const result = groupTransactionsByLot([buyTx, sellTx], '000001');
    // Jan 10 to Jun 15 = 157 days
    expect(result[0].items[0].holdingDays).toBe(157);
  });

  it('sell exceeding available lots sells all available', () => {
    const buyTx = makeBuyTx({ id: 'buy_001', shares: 500, amount: 500 });
    const sellTx = makeSellTx({ id: 'sell_001', shares: 700, price: 1.5 });
    const result = groupTransactionsByLot([buyTx, sellTx], '000001');
    expect(result).toHaveLength(1);
    expect(result[0].remainingShares).toBe(0);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].soldShares).toBe(500);
  });
});
