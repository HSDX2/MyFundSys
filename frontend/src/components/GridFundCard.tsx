import React from 'react';
import { Badge } from 'antd-mobile';
import { GridTypeLabels, type GridFundOverview } from '../types';

interface GridFundCardProps {
  overview: GridFundOverview;
  onClick: () => void;
}

export const GridFundCard: React.FC<GridFundCardProps> = ({ overview, onClick }) => {
  const { strategy, current_nav, nearest_trigger, total_budget, capital_deployed, executed_count, total_grid_count, triggered_pending_count } = overview;

  const deployedPct = total_budget > 0 ? (capital_deployed / total_budget) * 100 : 0;
  const isTriggered = triggered_pending_count > 0;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        marginBottom: 12,
        cursor: 'pointer',
        borderLeft: isTriggered ? '3px solid #ff6b35' : '3px solid #e8e8e8',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{strategy.fund_name}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{strategy.fund_code}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>
            {current_nav.toFixed(4)}
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>当前净值</div>
        </div>
      </div>

      {/* 距最近触发价 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        padding: '6px 10px',
        background: isTriggered ? '#fff7f0' : '#f5f5f5',
        borderRadius: 6,
      }}>
        <span style={{ fontSize: 12, color: '#666' }}>距最近触发</span>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: isTriggered ? '#ff6b35' : nearest_trigger.distance_pct > 0 ? '#52c41a' : '#333',
        }}>
          {nearest_trigger.distance_pct > 0 ? '↑' : '↓'} {Math.abs(nearest_trigger.distance_pct).toFixed(1)}%
        </span>
        <span style={{ fontSize: 11, color: '#999' }}>
          {GridTypeLabels[nearest_trigger.grid_type]}·第{nearest_trigger.level}格
        </span>
        {isTriggered && (
          <Badge content={triggered_pending_count} color='#ff6b35' />
        )}
      </div>

      {/* 进度条 */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999', marginBottom: 4 }}>
          <span>已投入 {capital_deployed.toLocaleString()}</span>
          <span>总预算 {total_budget.toLocaleString()}</span>
        </div>
        <div style={{ height: 4, background: '#e8e8e8', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(deployedPct, 100)}%`,
            background: deployedPct > 0 ? '#1677ff' : 'transparent',
            borderRadius: 2,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* 状态标签 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {executed_count > 0 && (
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            background: '#f6ffed',
            color: '#52c41a',
            borderRadius: 4,
            border: '1px solid #b7eb8f',
          }}>
            已执行 {executed_count}/{total_grid_count}
          </span>
        )}
        {triggered_pending_count > 0 && (
          <span style={{
            fontSize: 11,
            padding: '2px 8px',
            background: '#fff7f0',
            color: '#ff6b35',
            borderRadius: 4,
            border: '1px solid #ffbb96',
          }}>
            待执行 {triggered_pending_count}
          </span>
        )}
      </div>
    </div>
  );
};
