import React from 'react';
import { Card, Progress } from 'antd-mobile';
import type { LotTimeline } from '../types';

interface LotTimelineProps {
  timeline: LotTimeline;
}

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function formatProfit(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatMoney(value)}`;
}

function formatProfitRate(value: number): string {
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
  } = timeline;

  const sellRatio = totalShares > 0 ? (totalShares - remainingShares) / totalShares : 0;
  const percent = Math.round(sellRatio * 100);

  return (
    <Card
      style={{ marginBottom: 12, borderRadius: 8 }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 600 }}>
          买入 {buyTransaction.date}
        </span>
        <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
          {formatMoney(buyTransaction.amount)} @ {buyTransaction.price.toFixed(4)}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <Progress
          percent={percent}
          style={{ '--track-width': '8px', '--fill-color': sellRatio > 0.5 ? '#ff4d4f' : '#1677ff' }}
        />
        <div style={{ fontSize: 11, color: '#999', marginTop: 2, textAlign: 'right' }}>
          {remainingShares.toFixed(2)}/{totalShares.toFixed(2)} 份
          {remainingShares < totalShares && (
            <span style={{ color: '#ff4d4f', marginLeft: 4 }}>
              (-{(totalShares - remainingShares).toFixed(2)})
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
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
                borderBottom: idx < items.length - 1 ? '1px dashed #f0f0f0' : 'none',
                fontSize: 12,
              }}
            >
              <span style={{ color: '#666' }}>
                ├ 卖出 {item.soldShares.toFixed(2)}份 {item.sellTx?.date}
              </span>
              <span style={{ color: item.profit >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
                {formatProfit(item.profit)} ({formatProfitRate(item.profitRate)})
              </span>
            </div>
          ))}
        </div>
      )}

      {remainingShares > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderTop: items.length > 0 ? '1px solid #f0f0f0' : 'none',
            fontSize: 12,
          }}
        >
          <span style={{ color: '#666' }}>
            └ 持有 {remainingShares.toFixed(2)}份{currentNav ? ` @ ${currentNav.toFixed(4)}` : ''}
          </span>
          {floatingProfit !== undefined && (
            <span style={{ color: floatingProfit >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
              {formatProfit(floatingProfit)} ({formatProfitRate(floatingProfitRate || 0)})
            </span>
          )}
        </div>
      )}
    </Card>
  );
};

export default LotTimeline;
