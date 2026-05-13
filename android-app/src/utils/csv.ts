import type { Transaction, Holding } from '../types';

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function exportTransactionsToCSV(transactions: Transaction[]) {
  const headers = ['日期', '基金代码', '基金名称', '类型', '金额', '价格', '份额'];
  const rows = transactions.map(t => [t.date, t.fundCode, t.fundName, t.type === 'buy' ? '买入' : '卖出', t.amount, t.price, t.shares].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function exportHoldingsToCSV(holdings: Holding[]) {
  const headers = ['基金代码', '基金名称', '持有份额', '平均成本', '总成本', '当前市值'];
  const rows = holdings.map(h => [h.fundCode, h.fundName, h.shares, h.avgCost, h.totalCost, h.currentValue || ''].join(','));
  return [headers.join(','), ...rows].join('\n');
}
