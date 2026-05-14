import { batchFetchNav } from './fundApi';
import type { Transaction } from '../types';
import type { LotTimeline, LotTimelineItem } from '../types';

interface BuyLotState {
  id: string;
  shares: number;
  remainingShares: number;
  cost: number;
  date: string;
  gridExecutionId?: string;
  items: LotTimelineItem[];
}

export function groupTransactionsByLot(
  transactions: Transaction[],
  fundCode: string
): LotTimeline[] {
  const buys = transactions
    .filter(t => t.type === 'buy' && t.fundCode === fundCode)
    .sort((a, b) => a.date.localeCompare(b.date));

  const sells = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed' && t.fundCode === fundCode)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (buys.length === 0) return [];

  const lots: BuyLotState[] = buys.map(b => ({
    id: b.id,
    shares: b.shares,
    remainingShares: b.status === 'completed' ? b.shares : 0,
    cost: b.price,
    date: b.date,
    gridExecutionId: b.gridExecutionId,
    items: [],
  }));

  for (const sell of sells) {
    if (sell.shares <= 0) continue;
    let remainingToSell = sell.shares;

    if (sell.gridExecutionId) {
      const targetLots = lots
        .filter(l => l.remainingShares > 0 && l.gridExecutionId === sell.gridExecutionId)
        .sort((a, b) => a.cost - b.cost);

      for (const lot of targetLots) {
        if (remainingToSell <= 0) break;
        const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
        const profit = sellFromLot * sell.price - sellFromLot * lot.cost;
        const profitRate = lot.cost > 0 ? profit / (sellFromLot * lot.cost) : 0;
        const sellTime = new Date(sell.date).getTime();
        const buyTime = new Date(lot.date).getTime();
        const holdingDays = !isNaN(sellTime) && !isNaN(buyTime)
          ? Math.max(0, Math.round((sellTime - buyTime) / (1000 * 60 * 60 * 24)))
          : 0;

        const buyTx = buys.find(b => b.id === lot.id);
        if (!buyTx) continue;

        lot.items.push({
          buyTx,
          sellTx: sell,
          soldShares: sellFromLot,
          profit,
          profitRate,
          holdingDays,
        });
        lot.remainingShares -= sellFromLot;
        remainingToSell -= sellFromLot;
      }
    }

    if (remainingToSell > 0) {
      const fallbackLots = lots
        .filter(l => l.remainingShares > 0)
        .sort((a, b) => a.cost - b.cost);

      for (const lot of fallbackLots) {
        if (remainingToSell <= 0) break;
        const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
        const profit = sellFromLot * sell.price - sellFromLot * lot.cost;
        const profitRate = lot.cost > 0 ? profit / (sellFromLot * lot.cost) : 0;
        const sellTime = new Date(sell.date).getTime();
        const buyTime = new Date(lot.date).getTime();
        const holdingDays = !isNaN(sellTime) && !isNaN(buyTime)
          ? Math.max(0, Math.round((sellTime - buyTime) / (1000 * 60 * 60 * 24)))
          : 0;

        const buyTx = buys.find(b => b.id === lot.id);
        if (!buyTx) continue;

        lot.items.push({
          buyTx,
          sellTx: sell,
          soldShares: sellFromLot,
          profit,
          profitRate,
          holdingDays,
        });
        lot.remainingShares -= sellFromLot;
        remainingToSell -= sellFromLot;
      }
    }
  }

  return lots.map(lot => {
    const buyTx = buys.find(b => b.id === lot.id);
    if (!buyTx) return null;
    const totalSoldCost = lot.items.reduce((s, i) => s + i.soldShares * lot.cost, 0);
    const timeline: LotTimeline = {
      buyTransaction: buyTx,
      totalShares: lot.shares,
      remainingShares: lot.remainingShares,
      totalCost: lot.remainingShares * lot.cost,
      totalSoldCost,
      items: lot.items,
    };
    return timeline;
  }).filter(Boolean) as LotTimeline[];
}

export async function enrichLotTimelinesWithNav(
  timelines: LotTimeline[]
): Promise<LotTimeline[]> {
  const fundCodes = [...new Set(timelines.map(t => t.buyTransaction.fundCode))];
  const navMap = await batchFetchNav(fundCodes);
  return timelines.map(t => {
    const navInfo = navMap.get(t.buyTransaction.fundCode);
    if (!navInfo || typeof navInfo.nav !== 'number') return t;
    const currentValue = navInfo.nav * t.remainingShares;
    const cost = t.totalCost;
    return {
      ...t,
      currentNav: navInfo.nav,
      currentValue,
      floatingProfit: currentValue - cost,
      floatingProfitRate: cost > 0 ? (currentValue - cost) / cost : 0,
    };
  });
}
