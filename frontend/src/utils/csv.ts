import { Toast } from 'antd-mobile';
import type { Holding, Transaction } from '../types';

// CSV 导出函数
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    Toast.show({ content: '没有数据可导出', position: 'bottom' });
    return;
  }

  // 获取表头
  const headers = Object.keys(data[0]);
  
  // 构建CSV内容
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // 修复 C：含换行符(\n/\r)的字段也必须用引号包裹，否则一条记录会被拆成多行破坏 CSV 结构
        if (typeof value === 'string' && (
          value.includes(',') || value.includes('"') ||
          value.includes('\n') || value.includes('\r') ||
          value.startsWith('=') || value.startsWith('@') || value.startsWith('+')
        )) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  Toast.show({ content: '导出成功', position: 'bottom' });
}

// CSV 解析函数
export function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? '';
    });
    return obj;
  });
}

// 解析CSV行（处理引号）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else if (char === '\r') {
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// 格式化日期为 YYYY-MM-DD 格式（避免时区问题）
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 导出持仓数据
export function exportHoldingsToCSV(holdings: Holding[]) {
  const data = holdings.map(h => ({
    '基金代码': h.fundCode,
    '基金名称': h.fundName,
    '持有份额': h.shares,
    '平均成本': h.avgCost,
    '总成本': h.totalCost,
    '当前市值': h.currentValue || '',
    '盈亏金额': h.profit || '',
    '盈亏比例': h.profitRate ? `${(h.profitRate * 100).toFixed(2)}%` : '',
  }));
  
  exportToCSV(data, `持仓数据_${formatLocalDate(new Date())}.csv`);
}

// 导出交易记录
export function exportTransactionsToCSV(transactions: Transaction[]) {
  const data = transactions.map(t => ({
    '日期': t.date,
    '基金代码': t.fundCode,
    '基金名称': t.fundName,
    '类型': t.type === 'buy' ? '买入' : '卖出',
    '金额': t.amount,
    '价格': t.price,
    '份额': t.shares,
    '手续费': t.fee || '',
    '备注': t.remark || '',
  }));
  
  exportToCSV(data, `交易记录_${formatLocalDate(new Date())}.csv`);
}

// ============================================
// CSV 导入（与导出格式一致）
// ============================================

/**
 * 规范化日期字符串为 YYYY-MM-DD（修复 D）。
 * 支持 2024-1-5 / 2024/1/5 / 2024.1.5 等常见写法；非法日期抛错，避免字符串比较误判在途。
 */
export function normalizeDateString(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) {
    throw new Error(`日期格式无效: "${raw}"（应为 YYYY-MM-DD）`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`日期数值越界: "${raw}"`);
  }
  // 用 Date 反校验真实存在的日期（如 2024-02-30 非法）
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    throw new Error(`日期不存在: "${raw}"`);
  }
  return `${m[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 解析交易记录 CSV 文件
 * @param csvText CSV 文件内容
 * @returns 交易记录数组（需调用 saveTransaction 保存到数据库）
 * @throws CSV 格式错误时抛出异常
 */
export function importTransactionsFromCSV(csvText: string): Omit<Transaction, 'id' | 'createdAt'>[] {
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    throw new Error('CSV 文件为空');
  }

  // 验证表头
  const requiredHeaders = ['日期', '基金代码', '基金名称', '类型', '金额', '价格', '份额'];
  const actualHeaders = Object.keys(rows[0]);
  const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 格式错误，缺少字段: ${missingHeaders.join(', ')}`);
  }

  const transactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 因为表头在第 1 行，索引从 0 开始

    // 验证必填字段
    if (!row['日期'] || !row['基金代码'] || !row['基金名称']) {
      throw new Error(`第 ${rowNumber} 行: 日期、基金代码、基金名称为必填项`);
    }

    // 解析类型
    const typeStr = String(row['类型']).trim();
    let type: 'buy' | 'sell';
    if (typeStr === '买入') {
      type = 'buy';
    } else if (typeStr === '卖出') {
      type = 'sell';
    } else {
      throw new Error(`第 ${rowNumber} 行: 类型必须为"买入"或"卖出"`);
    }

    // 解析数值（支持千位分隔符）。修复 D：用严格解析，拒绝 Infinity / 尾部垃圾 / 非有限值
    const toNum = (v: unknown): number => {
      const cleaned = String(v).replace(/,/g, '').trim();
      // 仅接受合法数字字面量（可带正负号与小数），拒绝 "12abc"、"1e999"→Infinity、"1.2.3"
      if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : NaN;
    };
    const amount = toNum(row['金额']);
    const price = toNum(row['价格']);
    const shares = toNum(row['份额']);
    const fee = row['手续费'] ? toNum(row['手续费']) : 0;

    if (isNaN(amount) || isNaN(price) || isNaN(shares)) {
      throw new Error(`第 ${rowNumber} 行: 金额、价格、份额必须为有效数字`);
    }
    if (isNaN(fee)) {
      throw new Error(`第 ${rowNumber} 行: 手续费必须为有效数字`);
    }
    if (amount < 0 || price < 0 || shares < 0 || fee < 0) {
      throw new Error(`第 ${rowNumber} 行: 金额、价格、份额、手续费不能为负数`);
    }

    const txDate = normalizeDateString(String(row['日期']));
    const today = formatLocalDate(new Date());
    const isPending = txDate >= today;

    transactions.push({
      fundId: String(row['基金代码']).trim(),
      fundCode: String(row['基金代码']).trim(),
      fundName: String(row['基金名称']).trim(),
      type,
      date: txDate,
      // 在途买入：保留金额（份额待净值确认后由 processPendingTransactions 计算）
      // 在途卖出：保留份额（金额待确认）
      // 在途 price 统一设为 0（确认时由 processPendingTransactions 填入实际净值）
      amount: isPending && type === 'sell' ? 0 : amount,
      price: isPending ? 0 : price,
      shares: isPending && type === 'buy' ? 0 : shares,
      fee,
      remark: row['备注'] ? String(row['备注']).trim() : undefined,
      status: isPending ? 'pending' : 'completed',
    });
  }

  return transactions;
}
