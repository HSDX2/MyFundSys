import React, { useState } from 'react';
import { Card, Button, Dialog, Input, Toast } from 'antd-mobile';
import type { PendingAlert } from '../services/alertService';

interface PendingAlertCardProps {
  alert: PendingAlert;
  onResolve: (id: string, nav?: number) => void;
  onIgnore: (id: string) => void;
  onDeleteTransaction: (transactionId: string) => void;
}

const PendingAlertCard: React.FC<PendingAlertCardProps> = ({ alert, onResolve, onIgnore, onDeleteTransaction }) => {
  const [showNavDialog, setShowNavDialog] = useState(false);
  const [navInput, setNavInput] = useState('');

  const reasonLabels: Record<string, string> = {
    nav_date_mismatch: '净值日期不匹配',
    no_nav_data: '无法获取净值',
    api_error: 'API 错误',
  };

  const handleManualNav = () => {
    setNavInput('');
    setShowNavDialog(true);
  };

  const handleNavConfirm = () => {
    const nav = parseFloat(navInput);
    if (isNaN(nav) || nav <= 0) {
      Toast.show({ content: '请输入有效的净值', position: 'bottom' });
      return;
    }
    onResolve(alert.id, nav);
    setShowNavDialog(false);
    setNavInput('');
    Toast.show({ content: '已标记为已处理', position: 'bottom' });
  };

  const handleIgnore = () => {
    onIgnore(alert.id);
  };

  const handleDelete = () => {
    Dialog.confirm({
      content: '确定要删除该交易吗？删除后告警也会同时标记已处理。',
      onConfirm: () => {
        onDeleteTransaction(alert.transactionId);
      },
    });
  };

  return (
    <>
      <Card
        style={{
          borderLeft: '4px solid #ff4d4f',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
          {alert.fundCode}
          <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{alert.confirmDate}</span>
        </div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          {reasonLabels[alert.reason] || alert.reason}: {alert.detail}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" color="primary" onClick={handleManualNav}>手动输入净值</Button>
          <Button size="small" onClick={handleIgnore}>忽略</Button>
          <Button size="small" color="danger" fill="none" onClick={handleDelete}>删除交易</Button>
        </div>
      </Card>

      <Dialog
        visible={showNavDialog}
        title="手动输入净值"
        content={
          <div style={{ padding: '8px 0' }}>
            <Input
              type="number"
              placeholder="输入净值"
              value={navInput}
              onChange={(val) => setNavInput(val)}
              style={{ height: 44, fontSize: 16 }}
            />
          </div>
        }
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => setShowNavDialog(false) },
            {
              key: 'confirm',
              text: '确认',
              bold: true,
              onClick: handleNavConfirm,
            },
          ],
        ]}
        onClose={() => setShowNavDialog(false)}
      />
    </>
  );
};

export default PendingAlertCard;
