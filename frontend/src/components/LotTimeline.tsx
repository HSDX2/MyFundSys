import React from 'react';
import { Card } from 'antd-mobile';
import { ProgressBar } from 'antd-mobile';
import type { LotTimeline } from '../types';

interface LotTimelineProps {
  timeline: LotTimeline;
}

function fmt(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '--';
}

function formatMoney(value: number): string {
  return Number.isFinite(value) ? `¥${value.toFixed(2)}` : '--';
}

function formatProfit(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatMoney(value)}`;
}

function formatProfitRate(value: number): string {
  if (!Number.isFinite(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

const LotTimeline: React.FC<LotTimelineProps> = ({ timeline }) => {
  const {
    buyTransaction,
    totalShares,
    remainingShares,
    totalCost,
    currentNav,
    currentValue,
    floatingProfit,
    floatingProfitRate,
    items,
    totalSoldCost,
  } = timeline;

  const isPending = buyTransaction.status === 'pending';
  const isGrid = buyTransaction.source === 'grid';
  const sellRatio = totalShares > 0 ? (totalShares - remainingShares) / totalShares : 0;
  const percent = Math.round(sellRatio * 100);

  return (
    <Card
      style={{ marginBottom: 12, borderRadius: 8, opacity: isPending ? 0.7 : 1 }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: isPending ? '#999' : '#1677ff', fontWeight: 600 }}>
          {isPending ? '在途买入' : '买入'} {buyTransaction.date}
        </span>
        {isPending && (
          <span style={{ fontSize: 10, color: '#faad14', background: '#fffbe6', padding: '1px 6px', borderRadius: 4, border: '1px solid #ffe58f' }}>
            待确认
          </span>
        )}
        {isGrid && (
          <span style={{ fontSize: 10, color: '#1677ff', background: '#e6f7ff', padding: '1px 6px', borderRadius: 4, border: '1px solid #91d5ff' }}>
            网格
          </span>
        )}
        {isPending ? (
          <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>
            {formatMoney(buyTransaction.amount)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>
            {formatMoney(buyTransaction.amount)} @ {fmt(buyTransaction.price)}
          </span>
        )}
      </div>

      {isPending ? (
        <div style={{ fontSize: 12, color: '#999', padding: '8px 0', textAlign: 'center' }}>
          等待净值确认后自动更新份额和价格
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <ProgressBar
              percent={percent}
              style={{ '--track-width': '8px', '--fill-color': sellRatio > 0.5 ? '#ff4d4f' : '#1677ff' }}
            />
            <div style={{ fontSize: 11, color: '#999', marginTop: 2, textAlign: 'right' }}>
              {fmt(remainingShares)}/{fmt(totalShares)} 份
              {remainingShares < totalShares && (
                <span style={{ color: '#ff4d4f', marginLeft: 4 }}>
                  (-{fmt(totalShares - remainingShares)})
                </span>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '4px 0', borderBottom: idx < items.length - 1 ? '1px dashed #f0f0f0' : 'none',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: '#666' }}>
                    ├ 卖出 {fmt(item.soldShares)}份 {item.sellTx?.date}
                  </span>
                  <span style={{ color: item.profit >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
                    {formatProfit(item.profit)} ({formatProfitRate(item.profitRate)})
                  </span>
                </div>
              ))}
            </div>
          )}

          {totalSoldCost !== undefined && totalSoldCost > 0 && (
            <div style={{ fontSize: 11, color: '#999', padding: '2px 0 4px', textAlign: 'right' }}>
              已实现盈亏成本: {formatMoney(totalSoldCost)}
            </div>
          )}

          {remainingShares > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderTop: items.length > 0 ? '1px solid #f0f0f0' : 'none',
              fontSize: 12,
            }}>
              <span style={{ color: '#666' }}>
                └ 持有 {fmt(remainingShares)}份{currentNav ? ` @ ${currentNav.toFixed(4)}` : ''}
              </span>
              {floatingProfit !== undefined && (
                <span style={{ color: floatingProfit >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                  {formatProfit(floatingProfit)} ({formatProfitRate(floatingProfitRate || 0)})
                </span>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default LotTimeline;
