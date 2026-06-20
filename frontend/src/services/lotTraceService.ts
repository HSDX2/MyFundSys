import { batchFetchNav, fetchFundNav } from './fundApi';
import { calcLotProfit } from './navUpdateService';
import type { Transaction } from '../types';
import type { LotTimeline, LotTimelineItem } from '../types';

interface BuyLotState {
  id: string;
  shares: number;
  remainingShares: number;
  cost: number;
  date: string;
  buyFee: number;
  gridExecutionId?: string;
  items: LotTimelineItem[];
}

function matchSellToLots(sell: Transaction, lots: BuyLotState[], buys: Transaction[]) {
  let remainingToSell = sell.shares;
  const match = (lot: BuyLotState) => {
    const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
    // 修复 #4：与 deriveRealizedLots 统一手续费分摊公式
    const { profit, profitRate } = calcLotProfit({
      soldShares: sellFromLot,
      buyNav: lot.cost,
      sellNav: sell.price,
      buyFee: lot.buyFee,
      buyTotalShares: lot.shares,
      sellFee: sell.fee,
      sellTotalShares: sell.shares,
    });
    const sellTime = new Date(sell.date).getTime();
    const buyTime = new Date(lot.date).getTime();
    const holdingDays = !isNaN(sellTime) && !isNaN(buyTime)
      ? Math.max(0, Math.round((sellTime - buyTime) / (1000 * 60 * 60 * 24)))
      : 0;
    const buyTx = buys.find(b => b.id === lot.id);
    if (!buyTx) return;
    lot.items.push({ buyTx, sellTx: sell, soldShares: sellFromLot, profit, profitRate, holdingDays });
    lot.remainingShares -= sellFromLot;
    remainingToSell -= sellFromLot;
  };

  // 匹配优先级：lot_id 精确 → gridExecutionId 精确 → 成本升序（与 deriveLots 一致）
  if (sell.lotId) {
    const targetLots = lots.filter(l => l.remainingShares > 0 && l.id === sell.lotId);
    for (const lot of targetLots) {
      if (remainingToSell <= 0) break;
      match(lot);
    }
  }
  if (remainingToSell > 0 && sell.gridExecutionId) {
    const targetLots = lots.filter(l => l.remainingShares > 0 && l.gridExecutionId === sell.gridExecutionId).sort((a, b) => a.cost - b.cost);
    for (const lot of targetLots) {
      if (remainingToSell <= 0) break;
      match(lot);
    }
  }
  if (remainingToSell > 0) {
    const fallbackLots = lots.filter(l => l.remainingShares > 0).sort((a, b) => a.cost - b.cost);
    for (const lot of fallbackLots) {
      if (remainingToSell <= 0) break;
      match(lot);
    }
  }
}

export function groupTransactionsByLot(transactions: Transaction[], fundCode: string): LotTimeline[] {
  const buys = transactions.filter(t => t.type === 'buy' && t.fundCode === fundCode).sort((a, b) => a.date.localeCompare(b.date));
  const sells = transactions.filter(t => t.type === 'sell' && t.status === 'completed' && t.fundCode === fundCode).sort((a, b) => a.date.localeCompare(b.date));
  if (buys.length === 0) return [];

  const lots: BuyLotState[] = buys.map(b => ({
    id: b.id,
    shares: b.shares,
    remainingShares: b.status === 'completed' ? b.shares : 0,
    cost: b.price || 0,
    date: b.date,
    buyFee: b.fee || 0,
    gridExecutionId: b.gridExecutionId,
    items: [],
  }));

  for (const sell of sells) {
    if (sell.shares <= 0) continue;
    matchSellToLots(sell, lots, buys);
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
  let navMap: Map<string, { nav: number; navDate: string; name: string }>;
  if (fundCodes.length <= 1 && fundCodes[0]) {
    const navData = await fetchFundNav(fundCodes[0]);
    navMap = new Map();
    if (navData) navMap.set(fundCodes[0], { nav: navData.nav, navDate: navData.navDate, name: navData.name });
  } else {
    navMap = await batchFetchNav(fundCodes);
  }
  return timelines.map(t => {
    const navInfo = navMap.get(t.buyTransaction.fundCode);
    if (!navInfo || typeof navInfo.nav !== 'number') return t;
    const currentValue = navInfo.nav * t.remainingShares;
    const cost = t.totalCost || 0;
    return {
      ...t,
      currentNav: navInfo.nav,
      currentValue,
      floatingProfit: currentValue - cost,
      floatingProfitRate: cost > 0 ? (currentValue - cost) / cost : 0,
    };
  });
}
