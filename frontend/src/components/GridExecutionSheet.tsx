import React from 'react';
import { ActionSheet, Toast } from 'antd-mobile';
import { GridTypeLabels, type GridType, type GridLevelWithStatus, type GridStrategy } from '../types';

interface GridExecutionSheetProps {
  visible: boolean;
  strategy: GridStrategy;
  gridType: GridType;
  gridLevel: GridLevelWithStatus;
  currentNav: number;
  action: 'buy' | 'sell';
  onExecute: (gridType: GridType, level: number) => Promise<void>;
  onClose: () => void;
}

export const GridExecutionSheet: React.FC<GridExecutionSheetProps> = ({
  visible,
  strategy,
  gridType,
  gridLevel,
  currentNav,
  action,
  onExecute,
  onClose,
}) => {
  const [executing, setExecuting] = React.useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(gridType, gridLevel.level);
      Toast.show({ content: action === 'buy' ? '买入记录已创建' : '卖出记录已创建', position: 'bottom' });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '执行失败';
      Toast.show({ content: msg, position: 'bottom' });
    } finally {
      setExecuting(false);
    }
  };

  const actions = [
    {
      text: executing ? '执行中...' : action === 'buy' ? '确认买入' : '确认卖出',
      key: 'execute',
      bold: true,
      danger: action === 'sell',
      onClick: handleExecute,
    },
  ];

  const isBuy = action === 'buy';

  return (
    <ActionSheet
      visible={visible}
      actions={actions}
      onClose={onClose}
      extra={
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
            {strategy.fund_name}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#666' }}>网格类型</span>
            <span style={{ fontWeight: 500 }}>{GridTypeLabels[gridType]}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#666' }}>网格层级</span>
            <span style={{ fontWeight: 500 }}>第 {gridLevel.level} 格</span>
          </div>

          {isBuy ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>触发价</span>
                <span style={{ fontWeight: 500 }}>{gridLevel.trigger_price.toFixed(4)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>当前净值</span>
                <span style={{ fontWeight: 500, color: '#1677ff' }}>{currentNav.toFixed(4)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>投资金额</span>
                <span style={{ fontWeight: 600, fontSize: 16, color: '#ff4d4f' }}>
                  {gridLevel.investment.toLocaleString()} 元
                </span>
              </div>

              <div style={{
                marginTop: 12,
                padding: 8,
                background: '#fffbe6',
                borderRadius: 6,
                fontSize: 12,
                color: '#d48806',
              }}>
                注意：实际成交价为当日净值，非网格触发价
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>止盈价</span>
                <span style={{ fontWeight: 500 }}>{gridLevel.sell_price.toFixed(4)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>当前净值</span>
                <span style={{ fontWeight: 500, color: '#1677ff' }}>{currentNav.toFixed(4)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#666' }}>利润留存</span>
                <span style={{ fontWeight: 500 }}>{(gridLevel.profit_retention_pct * 100).toFixed(0)}%</span>
              </div>

              {gridLevel.execution && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#666' }}>买入份额</span>
                    <span style={{ fontWeight: 500 }}>{gridLevel.execution.executed_shares?.toFixed(2)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#666' }}>卖出份额</span>
                    <span style={{ fontWeight: 500 }}>
                      {((gridLevel.execution.executed_shares || 0) * (1 - gridLevel.profit_retention_pct)).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#666' }}>留利润份额</span>
                    <span style={{ fontWeight: 500, color: '#52c41a' }}>
                      {((gridLevel.execution.executed_shares || 0) * gridLevel.profit_retention_pct).toFixed(2)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#666' }}>预估金额</span>
                    <span style={{ fontWeight: 600, fontSize: 16, color: '#52c41a' }}>
                      {(((gridLevel.execution.executed_shares || 0) * (1 - gridLevel.profit_retention_pct)) * currentNav).toFixed(2)} 元
                    </span>
                  </div>
                </>
              )}

              <div style={{
                marginTop: 12,
                padding: 8,
                background: '#f6ffed',
                borderRadius: 6,
                fontSize: 12,
                color: '#389e0d',
              }}>
                留利润份额将永久保留为底仓，成本归零
              </div>
            </>
          )}
        </div>
      }
    />
  );
};
