import React, { useState, useRef } from 'react';
import { Button, Toast } from 'antd-mobile';
import { batchImportGridStrategies } from '../services/gridService';

interface GridBatchImportProps {
  onComplete: () => void;
}

export const GridBatchImport: React.FC<GridBatchImportProps> = ({ onComplete }) => {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Array<{ fund_code: string; fund_name: string }> | null>(null);
  const [jsonData, setJsonData] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!Array.isArray(data)) {
          Toast.show({ content: 'JSON 格式错误：应为数组', position: 'bottom' });
          return;
        }

        // 验证基本结构
        const isValid = data.every(
          (item: any) => item.fund_code && item.fund_name && item.grid_config
        );
        if (!isValid) {
          Toast.show({ content: 'JSON 格式错误：缺少必要字段', position: 'bottom' });
          return;
        }

        setJsonData(data);
        setPreview(data.map((item: any) => ({ fund_code: item.fund_code, fund_name: item.fund_name })));
      } catch {
        Toast.show({ content: 'JSON 解析失败', position: 'bottom' });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!jsonData) return;

    setImporting(true);
    try {
      const result = await batchImportGridStrategies(jsonData as any);
      if (result.errors.length > 0) {
        Toast.show({ content: `导入完成：${result.success} 成功，${result.errors.length} 失败`, position: 'bottom' });
      } else {
        Toast.show({ content: `成功导入 ${result.success} 只基金`, position: 'bottom' });
      }
      onComplete();
    } catch (err) {
      Toast.show({ content: '导入失败', position: 'bottom' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {!preview ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Button color="primary" onClick={() => fileInputRef.current?.click()}>
            选择 JSON 文件
          </Button>
          <div style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
            支持批量导入网格策略配置
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            即将导入 {preview.length} 只基金：
          </div>
          <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 12 }}>
            {preview.map((item, i) => (
              <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                {item.fund_code} - {item.fund_name}
              </div>
            ))}
          </div>
          <Button block color="primary" loading={importing} onClick={handleImport}>
            确认导入
          </Button>
        </div>
      )}
    </div>
  );
};
