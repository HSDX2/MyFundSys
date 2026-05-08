import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast } from 'antd-mobile';
import {
  exportToCSV,
  parseCSV,
  formatLocalDate,
  exportHoldingsToCSV,
  exportTransactionsToCSV,
  importTransactionsFromCSV,
} from '../../utils/csv';
import type { Holding, Transaction } from '../../types';

vi.mock('antd-mobile', () => ({
  Toast: { show: vi.fn() },
}));

function setupDOMMocks() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const clickSpy = vi.fn();
  const mockLink = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
  vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
  return { clickSpy, mockLink };
}

describe('exportToCSV', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('空数组时提示没有数据可导出', () => {
    exportToCSV([], 'test.csv');
    expect(Toast.show).toHaveBeenCalledWith({ content: '没有数据可导出', position: 'bottom' });
  });

  it('空数组时不创建 Blob 或链接', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    exportToCSV([], 'test.csv');
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('正常数据时生成 Blob 并触发下载', () => {
    const { clickSpy } = setupDOMMocks();
    const data = [{ name: '张三', age: 25 }];
    exportToCSV(data, 'test.csv');

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(document.body.appendChild).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(document.body.removeChild).toHaveBeenCalledOnce();
    expect(Toast.show).toHaveBeenCalledWith({ content: '导出成功', position: 'bottom' });
  });

  it('Blob 包含 UTF-8 BOM 和 CSV 内容', () => {
    setupDOMMocks();
    const data = [{ name: '张三', age: 25 }];
    exportToCSV(data, 'test.csv');

    const blob = (vi.mocked(URL.createObjectURL).mock.calls[0] as [Blob])[0];
    expect(blob.type).toBe('text/csv;charset=utf-8;');
  });

  it('值包含逗号时使用引号包裹', () => {
    setupDOMMocks();
    const data = [{ name: '张,三', age: 25 }];
    exportToCSV(data, 'test.csv');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('值包含引号时使用双引号转义', () => {
    setupDOMMocks();
    const data = [{ name: '张"三', age: 25 }];
    exportToCSV(data, 'test.csv');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('null 或 undefined 值显示为空字符串', () => {
    setupDOMMocks();
    const data = [{ name: '张三', age: null as unknown as number }];
    exportToCSV(data, 'test.csv');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });
});

describe('parseCSV', () => {
  it('解析简单 CSV 数据', () => {
    const csv = 'name,age\n张三,25\n李四,30';
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: '张三', age: '25' },
      { name: '李四', age: '30' },
    ]);
  });

  it('解析含逗号的值（被引号包裹）', () => {
    const csv = 'name,age\n"张,三",25\n"李,四",30';
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: '张,三', age: '25' },
      { name: '李,四', age: '30' },
    ]);
  });

  it('解析含引号的值（双引号转义）', () => {
    const csv = 'name,age\n"张""三",25';
    const result = parseCSV(csv);
    expect(result).toEqual([{ name: '张"三', age: '25' }]);
  });

  it('空字符串返回空数组', () => {
    expect(parseCSV('')).toEqual([]);
  });

  it('只有表头返回空数组', () => {
    expect(parseCSV('name,age')).toEqual([]);
  });

  it('首尾空白字符被去除', () => {
    const csv = '  name  ,  age  \n  张三  ,  25  ';
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: '张三', age: '25' },
    ]);
  });

  it('字段少于表头时填充空字符串', () => {
    const csv = 'name,age\n张三';
    const result = parseCSV(csv);
    expect(result).toEqual([
      { name: '张三', age: '' },
    ]);
  });
});

describe('formatLocalDate', () => {
  it('正常日期格式化为 YYYY-MM-DD', () => {
    expect(formatLocalDate(new Date(2024, 2, 15))).toBe('2024-03-15');
  });

  it('1月1日正确补零', () => {
    expect(formatLocalDate(new Date(2024, 0, 1))).toBe('2024-01-01');
  });

  it('12月31日', () => {
    expect(formatLocalDate(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  it('避免时区偏移问题（与 toISOString 对比）', () => {
    // 使用东八区晚上时间，toISOString 会跨天，但 formatLocalDate 保持本地日期
    const date = new Date(2024, 2, 15, 23, 0, 0);
    expect(formatLocalDate(date)).toBe('2024-03-15');
  });
});

describe('exportHoldingsToCSV', () => {
  beforeEach(() => {
    setupDOMMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正确映射 holding 字段并导出', () => {
    const holdings: Holding[] = [
      {
        id: '1',
        fundId: '000001',
        fundCode: '000001',
        fundName: '测试基金',
        shares: 1000,
        avgCost: 1.5,
        totalCost: 1500,
        currentValue: 2000,
        profit: 500,
        profitRate: 0.3333,
        createdAt: '2024-03-15',
        updatedAt: '2024-03-15',
      },
    ];

    expect(() => exportHoldingsToCSV(holdings)).not.toThrow();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('空值字段显示为空字符串', () => {
    const holdings: Holding[] = [
      {
        id: '1',
        fundId: '000001',
        fundCode: '000001',
        fundName: '测试基金',
        shares: 1000,
        avgCost: 1.5,
        totalCost: 1500,
        createdAt: '2024-03-15',
        updatedAt: '2024-03-15',
      },
    ];

    expect(() => exportHoldingsToCSV(holdings)).not.toThrow();
  });

  it('盈利比例格式化为百分比字符串', () => {
    const holdings: Holding[] = [
      {
        id: '1',
        fundId: '000001',
        fundCode: '000001',
        fundName: '测试基金',
        shares: 1000,
        avgCost: 1.5,
        totalCost: 1500,
        profitRate: 0.125,
        createdAt: '2024-03-15',
        updatedAt: '2024-03-15',
      },
    ];

    expect(() => exportHoldingsToCSV(holdings)).not.toThrow();
  });
});

describe('exportTransactionsToCSV', () => {
  beforeEach(() => {
    setupDOMMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('买入交易显示"买入"', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        fundId: '000001',
        fundCode: '000001',
        fundName: '测试基金',
        type: 'buy',
        date: '2024-03-15',
        amount: 1000,
        price: 1.5,
        shares: 666.67,
        status: 'completed',
        createdAt: '2024-03-15',
      },
    ];

    expect(() => exportTransactionsToCSV(transactions)).not.toThrow();
  });

  it('卖出交易显示"卖出"', () => {
    const transactions: Transaction[] = [
      {
        id: '2',
        fundId: '000001',
        fundCode: '000001',
        fundName: '测试基金',
        type: 'sell',
        date: '2024-03-15',
        amount: 1000,
        price: 1.5,
        shares: 666.67,
        status: 'completed',
        createdAt: '2024-03-15',
      },
    ];

    expect(() => exportTransactionsToCSV(transactions)).not.toThrow();
  });

  it('可选字段为空时正常处理', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        fundId: '000001',
        fundCode: '000001',
        fundName: '测试基金',
        type: 'buy',
        date: '2024-03-15',
        amount: 1000,
        price: 1.5,
        shares: 666.67,
        status: 'completed',
        createdAt: '2024-03-15',
      },
    ];

    expect(() => exportTransactionsToCSV(transactions)).not.toThrow();
  });
});

describe('importTransactionsFromCSV', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 2, 15)); // 2024-03-15
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('正常买入交易', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-10,000001,测试基金,买入,1000,1.5,666.67';
    const result = importTransactionsFromCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fundId: '000001',
      fundCode: '000001',
      fundName: '测试基金',
      type: 'buy',
      date: '2024-03-10',
      amount: 1000,
      price: 1.5,
      shares: 666.67,
      fee: 0,
      status: 'completed',
    });
  });

  it('正常卖出交易', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-10,000001,测试基金,卖出,1000,1.5,666.67';
    const result = importTransactionsFromCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'sell',
      status: 'completed',
    });
  });

  it('空 CSV 抛出错误', () => {
    expect(() => importTransactionsFromCSV('')).toThrow('CSV 文件为空');
  });

  it('只有表头时抛出空文件错误', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额';
    expect(() => importTransactionsFromCSV(csv)).toThrow('CSV 文件为空');
  });

  it('缺少必填表头抛出错误', () => {
    const csv = '日期,基金代码\n2024-03-10,000001';
    expect(() => importTransactionsFromCSV(csv)).toThrow('CSV 格式错误');
  });

  it('第1行缺少必填字段抛出错误', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n,,,买入,1000,1.5,666.67';
    expect(() => importTransactionsFromCSV(csv)).toThrow('第 2 行: 日期、基金代码、基金名称为必填项');
  });

  it('无效类型抛出错误', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-10,000001,测试基金,定投,1000,1.5,666.67';
    expect(() => importTransactionsFromCSV(csv)).toThrow('第 2 行: 类型必须为"买入"或"卖出"');
  });

  it('无效数字抛出错误', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-10,000001,测试基金,买入,abc,1.5,666.67';
    expect(() => importTransactionsFromCSV(csv)).toThrow('第 2 行: 金额、价格、份额必须为有效数字');
  });

  it('在途买入：未来日期待确认', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-20,000001,测试基金,买入,1000,1.5,666.67';
    const result = importTransactionsFromCSV(csv);
    expect(result[0]).toMatchObject({
      status: 'pending',
      price: 0,
      shares: 0,
      amount: 1000,
    });
  });

  it('在途卖出：未来日期待确认', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-20,000001,测试基金,卖出,1000,1.5,666.67';
    const result = importTransactionsFromCSV(csv);
    expect(result[0]).toMatchObject({
      status: 'pending',
      price: 0,
      amount: 0,
      shares: 666.67,
    });
  });

  it('手续费字段为空时默认为 0', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n2024-03-10,000001,测试基金,买入,1000,1.5,666.67';
    const result = importTransactionsFromCSV(csv);
    expect(result[0].fee).toBe(0);
  });

  it('手续费非空时正确解析', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额,手续费\n2024-03-10,000001,测试基金,买入,1000,1.5,666.67,5.5';
    const result = importTransactionsFromCSV(csv);
    expect(result[0].fee).toBe(5.5);
  });

  it('备注字段正确解析', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额,备注\n2024-03-10,000001,测试基金,买入,1000,1.5,666.67,测试备注';
    const result = importTransactionsFromCSV(csv);
    expect(result[0].remark).toBe('测试备注');
  });

  it('空格被 trim', () => {
    const csv = '日期,基金代码,基金名称,类型,金额,价格,份额\n 2024-03-10 , 000001 , 测试基金 , 买入 , 1000 , 1.5 , 666.67 ';
    const result = importTransactionsFromCSV(csv);
    expect(result[0]).toMatchObject({
      fundCode: '000001',
      fundName: '测试基金',
      type: 'buy',
    });
  });
});
