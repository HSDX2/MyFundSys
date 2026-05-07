import type { GridType, GridLevelWithStatus } from '../types';
import { GRID_TYPES } from '../types';

interface GridLadderChartProps {
  levelsByType: Record<GridType, GridLevelWithStatus[]>;
  currentNav: number;
}

const GridTypeColors: Record<GridType, { color: string; label: string; lineWidth: number }> = {
  small: { color: '#1677ff', label: '小网', lineWidth: 1 },
  medium: { color: '#fa8c16', label: '中网', lineWidth: 2 },
  large: { color: '#52c41a', label: '大网', lineWidth: 3 },
};

interface PriceZoneProps {
  levelsByType: Record<GridType, GridLevelWithStatus[]>;
  priceToY: (price: number) => number;
  colX: Record<GridType, number>;
  x1: number;
  x2: number;
  side: 'buy' | 'sell';
}

function PriceZone({ levelsByType, priceToY, colX, x1, x2, side }: PriceZoneProps) {
  const isBuy = side === 'buy';
  const priceKey = isBuy ? 'trigger_price' : 'sell_price';
  const dotRadius = isBuy ? 6 : 5;

  return (
    <>
      {GRID_TYPES.map(gridType => {
        const levels = levelsByType[gridType];
        if (!levels || levels.length === 0) return null;
        const { color, lineWidth } = GridTypeColors[gridType];

        return levels.map(level => {
          const y = priceToY(level[priceKey]);
          const isHolding = level.status === 'executed' && !level.sellExecution;
          const isTriggerable = level.status === 'triggered';
          const isSold = !!level.sellExecution;
          const isSellTriggerable = level.status === 'sell_triggered';

          const showSolidDot = isBuy ? isHolding : isSold;
          const showHollowDot = isBuy ? isTriggerable : isSellTriggerable;

          return (
            <g key={`${side}-${gridType}-${level.level}`}>
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={color}
                strokeWidth={lineWidth}
                strokeDasharray={isBuy ? undefined : '4,2'}
              />
              {showSolidDot && (
                <circle
                  cx={colX[gridType]}
                  cy={y}
                  r={dotRadius}
                  fill={color}
                />
              )}
              {showHollowDot && (
                <circle
                  cx={colX[gridType]}
                  cy={y}
                  r={dotRadius}
                  fill="white"
                  stroke={color}
                  strokeWidth={2}
                />
              )}
            </g>
          );
        });
      })}
    </>
  );
}

export function GridLadderChart({ levelsByType, currentNav }: GridLadderChartProps) {
  // 收集所有价格点
  const prices: number[] = [];

  for (const gridType of GRID_TYPES) {
    const levels = levelsByType[gridType];
    if (!levels) continue;
    for (const level of levels) {
      prices.push(level.trigger_price, level.sell_price);
    }
  }

  if (prices.length === 0) return null;

  // 计算价格范围
  const minPrice = Math.min(...prices, currentNav) * 0.95;
  const maxPrice = Math.max(...prices, currentNav) * 1.05;
  const priceRange = maxPrice - minPrice;

  // 图表尺寸
  const chartHeight = 300;
  const chartWidth = 280;
  const buyChartWidth = 130;
  const sellChartWidth = 130;
  const leftMargin = 60;
  const rightMargin = 20;
  const svgWidth = leftMargin + chartWidth + rightMargin;
  const svgHeight = chartHeight + 36;
  const midX = leftMargin + buyChartWidth;

  // 价格转 Y 坐标
  const priceToY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  const currentNavY = priceToY(currentNav);
  const minLabelGap = 14;

  // 圆点列位置（买入区：小｜中｜大 从左到右）
  const buyColX: Record<GridType, number> = {
    small: leftMargin + buyChartWidth * 0.25,
    medium: leftMargin + buyChartWidth * 0.5,
    large: leftMargin + buyChartWidth * 0.75,
  };

  // 圆点列位置（卖出区：小｜中｜大 从左到右）
  const sellColX: Record<GridType, number> = {
    small: midX + sellChartWidth * 0.25,
    medium: midX + sellChartWidth * 0.5,
    large: midX + sellChartWidth * 0.75,
  };

  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 12 }}>
      {/* 图例 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {GRID_TYPES.map(gridType => (
          <div key={gridType} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 20,
              height: GridTypeColors[gridType].lineWidth + 2,
              background: GridTypeColors[gridType].color,
              borderRadius: 1,
            }} />
            <span style={{ fontSize: 11, color: '#666' }}>{GridTypeColors[gridType].label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 20, height: 0, borderTop: '2px dashed #333' }} />
          <span style={{ fontSize: 11, color: '#666' }}>当前价</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 20, height: 0, borderTop: '2px dashed #bbb' }} />
          <span style={{ fontSize: 11, color: '#999' }}>卖出触发价</span>
        </div>
      </div>

      {/* SVG 阶梯图 */}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ display: 'block', margin: '0 auto', width: '100%', maxWidth: svgWidth }}>
        {/* 网格线（横跨整个 chartWidth） */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const price = minPrice + priceRange * pct;
          const y = priceToY(price);
          const showLabel = Math.abs(y - currentNavY) >= minLabelGap;
          return (
            <g key={pct}>
              <line
                x1={leftMargin}
                y1={y}
                x2={leftMargin + chartWidth}
                y2={y}
                stroke="#f0f0f0"
                strokeWidth={1}
              />
              {showLabel && (
                <text
                  x={leftMargin - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#999"
                >
                  {price.toFixed(4)}
                </text>
              )}
            </g>
          );
        })}

        {/* 当前价虚线 */}
        <line
          x1={leftMargin}
          y1={currentNavY}
          x2={leftMargin + chartWidth}
          y2={currentNavY}
          stroke="#333"
          strokeWidth={2}
          strokeDasharray="6,4"
        />
        <text
          x={leftMargin - 8}
          y={currentNavY + 4}
          textAnchor="end"
          fontSize={11}
          fill="#333"
          fontWeight={600}
        >
          {currentNav.toFixed(4)}
        </text>

        {/* 买入触发价横线（左半区域） */}
        <PriceZone
          levelsByType={levelsByType}
          priceToY={priceToY}
          colX={buyColX}
          x1={leftMargin}
          x2={midX}
          side="buy"
        />

        {/* 卖出触发价横线（右半区域） */}
        <PriceZone
          levelsByType={levelsByType}
          priceToY={priceToY}
          colX={sellColX}
          x1={midX}
          x2={leftMargin + chartWidth}
          side="sell"
        />

        {/* 底部分区标签 */}
        <text x={leftMargin + buyChartWidth / 2} y={chartHeight + 20} textAnchor="middle" fontSize={11} fill="#666">
          买入触发价
        </text>
        <text x={midX + sellChartWidth / 2} y={chartHeight + 20} textAnchor="middle" fontSize={11} fill="#999">
          卖出触发价
        </text>
      </svg>
    </div>
  );
}
