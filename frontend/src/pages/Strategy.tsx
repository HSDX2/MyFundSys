import React, { useState } from 'react';
import { Button, Dialog, Toast, SpinLoading } from 'antd-mobile';
import { useGridStrategies } from '../hooks/useGrid';
import { GridFundCard } from '../components/GridFundCard';
import { GridBatchImport } from '../components/GridBatchImport';
import './Layout.css';

const StrategyPage: React.FC = () => {
  const { overviews, loading, error, refresh } = useGridStrategies();
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleNavigateToDetail = (fundCode: string) => {
    window.location.hash = `grid/${fundCode}`;
  };

  const handleImportComplete = async () => {
    setShowImportDialog(false);
    await refresh();
    Toast.show({ content: '导入完成', position: 'bottom' });
  };

  // 计算汇总数据
  const totalBudget = overviews.reduce((s, o) => s + o.total_budget, 0);
  const totalDeployed = overviews.reduce((s, o) => s + o.capital_deployed, 0);
  const totalTriggered = overviews.reduce((s, o) => s + o.triggered_pending_count, 0);

  return (
    <div className="page-container">
      <h1 className="page-title">网格策略</h1>

      {/* 汇总卡片 */}
      {overviews.length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{overviews.length}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>基金数</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{totalDeployed.toLocaleString()}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>已投入</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{totalBudget.toLocaleString()}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>总预算</div>
            </div>
            {totalTriggered > 0 && (
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, color: '#ffeb3b' }}>{totalTriggered}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>待执行</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Button block color="primary" onClick={() => setShowImportDialog(true)}>
          导入策略
        </Button>
      </div>

      {/* 基金列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading />
        </div>
      ) : error ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, marginBottom: 8, color: '#ff4d4f' }}>加载失败</div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>{error}</div>
          <Button size="small" onClick={refresh}>重试</Button>
        </div>
      ) : overviews.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>暂无网格策略</div>
          <div style={{ fontSize: 12 }}>点击"导入策略"按钮加载网格配置</div>
        </div>
      ) : (
        overviews.map(overview => (
          <GridFundCard
            key={overview.strategy.id}
            overview={overview}
            onClick={() => handleNavigateToDetail(overview.strategy.fund_code)}
          />
        ))
      )}

      {/* 导入对话框 */}
      <Dialog
        visible={showImportDialog}
        title="导入网格策略"
        content={
          <GridBatchImport onComplete={handleImportComplete} />
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '关闭',
              onClick: () => setShowImportDialog(false),
            },
          ],
        ]}
      />
    </div>
  );
};

export default StrategyPage;
