import { CapsuleTabs, Button } from 'antd-mobile';
import { GridTypeLabels, GRID_TYPES, type GridType, type GridLevelWithStatus } from '../types';

interface GridLevelTableProps {
  levelsByType: Record<GridType, GridLevelWithStatus[]>;
  onTriggerClick: (gridType: GridType, level: number) => void;
  shouldLiquidate?: boolean;
}

interface StatusDisplayProps {
  status: GridLevelWithStatus['status'];
  hasSellExecution?: boolean;
  shouldLiquidate?: boolean;
  onBuyTrigger?: () => void;
  onSellTrigger?: () => void;
}

function StatusDisplay({ status, hasSellExecution, shouldLiquidate, onBuyTrigger, onSellTrigger }: StatusDisplayProps) {
  switch (status) {
    case 'executed':
      return hasSellExecution
        ? <span style={{ color: '#999', fontWeight: 500 }}>已完成</span>
        : <span style={{ color: '#52c41a', fontWeight: 500 }}>持有中</span>;
    case 'sell_triggered':
      return shouldLiquidate
        ? <span style={{ color: '#999' }}>等待</span>
        : (
          <Button size="mini" color="danger" onClick={onSellTrigger}>
            可卖出
          </Button>
        );
    case 'triggered':
      return shouldLiquidate
        ? <span style={{ color: '#ff6b35', fontWeight: 500 }}>可买入</span>
        : (
          <Button size="mini" color="warning" onClick={onBuyTrigger}>
            可买入
          </Button>
        );
    case 'above':
    default:
      return <span style={{ color: '#999' }}>等待</span>;
  }
}

export function GridLevelTable({ levelsByType, onTriggerClick, shouldLiquidate }: GridLevelTableProps) {
  return (
    <CapsuleTabs>
      {GRID_TYPES.map(gridType => {
        const levels = levelsByType[gridType];
        if (!levels || levels.length === 0) return null;

        return (
          <CapsuleTabs.Tab title={GridTypeLabels[gridType]} key={gridType}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ padding: '8px 4px', textAlign: 'left', whiteSpace: 'nowrap' }}>层级</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>触发价</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>投资额</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>止盈价</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>留利润</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', whiteSpace: 'nowrap' }}>距离</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map(level => {
                    const isTriggered = level.status === 'triggered';
                    const isSellTriggered = level.status === 'sell_triggered';
                    return (
                      <tr
                        key={level.level}
                        style={{
                          background: isTriggered ? '#fff7f0' : isSellTriggered ? '#fff2f0' : 'transparent',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <td style={{ padding: '10px 4px', fontWeight: 500 }}>
                          第{level.level}格
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {level.trigger_price.toFixed(4)}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                          {level.investment.toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {level.sell_price.toFixed(4)}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                          {(level.profit_retention_pct * 100).toFixed(0)}%
                        </td>
                        <td style={{
                          padding: '10px 4px',
                          textAlign: 'right',
                          color: level.distance_pct > 0 ? '#52c41a' : '#ff4d4f',
                        }}>
                          {level.distance_pct > 0 ? '+' : ''}{level.distance_pct.toFixed(1)}%
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          <StatusDisplay
                            status={level.status}
                            hasSellExecution={!!level.sellExecution}
                            shouldLiquidate={shouldLiquidate}
                            onBuyTrigger={() => onTriggerClick(gridType, level.level)}
                            onSellTrigger={() => onTriggerClick(gridType, level.level)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CapsuleTabs.Tab>
        );
      })}
    </CapsuleTabs>
  );
}
