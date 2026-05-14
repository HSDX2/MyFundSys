import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatMoney,
  formatPercent,
  getValuationStatus,
  calculateMA,
  calculateStdDev,
  getProfitColor,
  formatNumber,
  formatDate,
  generateId,
  downloadJSON,
  readJSONFile,
  isTradeDay,
  getNextTradeDay,
} from '../../utils';

describe('formatMoney', () => {
  it('正数：正确格式化人民币', () => {
    expect(formatMoney(1234.56)).toBe('¥1,234.56');
  });

  it('零值：显示 ¥0.00', () => {
    expect(formatMoney(0)).toBe('¥0.00');
  });

  it('负数：正确格式化负金额', () => {
    expect(formatMoney(-500)).toBe('-¥500.00');
  });

  it('大数：正确添加千位分隔符', () => {
    expect(formatMoney(1000000)).toBe('¥1,000,000.00');
  });
});

describe('formatPercent', () => {
  it('0% 显示 0.00%', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('50% 显示 50.00%', () => {
    expect(formatPercent(0.5)).toBe('50.00%');
  });

  it('100% 显示 100.00%', () => {
    expect(formatPercent(1)).toBe('100.00%');
  });

  it('负数百分比', () => {
    expect(formatPercent(-0.1)).toBe('-10.00%');
  });
});

describe('getValuationStatus', () => {
  it('百分位 < 0.2 → 钻石坑', () => {
    expect(getValuationStatus(0.1).text).toBe('钻石坑');
  });

  it('百分位 0.2-0.4 → 低估', () => {
    expect(getValuationStatus(0.3).text).toBe('低估');
  });

  it('百分位 0.4-0.6 → 合理', () => {
    expect(getValuationStatus(0.5).text).toBe('合理');
  });

  it('百分位 0.6-0.8 → 高估', () => {
    expect(getValuationStatus(0.7).text).toBe('高估');
  });

  it('百分位 >= 0.8 → 危险', () => {
    expect(getValuationStatus(0.9).text).toBe('危险');
  });

  it('边界值 0.2 → 低估', () => {
    expect(getValuationStatus(0.2).text).toBe('低估');
  });
});

describe('calculateMA', () => {
  const data = [1, 2, 3, 4, 5, 6];

  it('period=3 时，前2个值为 NaN', () => {
    const result = calculateMA(data, 3);
    expect(isNaN(result[0])).toBe(true);
    expect(isNaN(result[1])).toBe(true);
  });

  it('period=3 时，第3个值为前3个均值', () => {
    const result = calculateMA(data, 3);
    expect(result[2]).toBeCloseTo(2); // (1+2+3)/3=2
  });

  it('period=3 时，第4个值正确', () => {
    const result = calculateMA(data, 3);
    expect(result[3]).toBeCloseTo(3); // (2+3+4)/3=3
  });

  it('空数组返回空数组', () => {
    expect(calculateMA([], 3)).toEqual([]);
  });
});

describe('calculateStdDev', () => {
  it('空数组返回 0', () => {
    expect(calculateStdDev([])).toBe(0);
  });

  it('全相同值时标准差为 0', () => {
    expect(calculateStdDev([5, 5, 5, 5])).toBe(0);
  });

  it('[2, 4, 4, 4, 5, 5, 7, 9] 标准差约为 2', () => {
    expect(calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2);
  });
});

describe('getProfitColor', () => {
  it('正数 → 红色（A股涨为红）', () => {
    expect(getProfitColor(1)).toBe('#ff4d4f');
  });

  it('负数 → 绿色（A股跌为绿）', () => {
    expect(getProfitColor(-1)).toBe('#52c41a');
  });

  it('零 → 灰色', () => {
    expect(getProfitColor(0)).toBe('#8c8c8c');
  });
});

describe('formatNumber', () => {
  it('正常值：保留两位小数', () => {
    expect(formatNumber(1234.567)).toBe('1,234.57');
  });

  it('零值：显示 0.00', () => {
    expect(formatNumber(0)).toBe('0.00');
  });

  it('负数：正确显示负号', () => {
    expect(formatNumber(-999.99)).toBe('-999.99');
  });

  it('自定义小数位：保留4位', () => {
    expect(formatNumber(3.1415926, 4)).toBe('3.1416');
  });

  it('大额数字：正确添加千位分隔符', () => {
    expect(formatNumber(12345678.9, 1)).toBe('12,345,678.9');
  });
});

describe('formatDate', () => {
  it('正常日期字符串：正确格式化', () => {
    expect(formatDate('2024-03-15')).toBe('2024/03/15');
  });

  it('带时间戳的字符串：只保留日期部分', () => {
    expect(formatDate('2024-03-15T08:30:00.000Z')).toBe('2024/03/15');
  });

  it('无效日期字符串：返回空字符串', () => {
    expect(formatDate('not-a-date')).toBe('');
  });

  it('空字符串：返回空字符串', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('generateId', () => {
  it('无前缀：返回包含下划线的非空字符串', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(id).toContain('_');
  });

  it('带前缀：以指定前缀开头', () => {
    const id = generateId('txn_');
    expect(id.startsWith('txn_')).toBe(true);
  });

  it('每次调用返回不同值', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});

describe('downloadJSON', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let mockLink: HTMLAnchorElement;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    clickSpy = vi.fn();
    mockLink = { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('正确生成 Blob 并触发下载', () => {
    const data = { name: 'test', value: 42 };
    downloadJSON(data, 'test.json');

    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(removeChildSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURLSpy).toHaveBeenCalledOnce();
  });

  it('设置正确的 href 和 download 属性', () => {
    const data = { name: 'test', value: 42 };
    downloadJSON(data, 'test.json');

    expect(mockLink.href).toBe('blob:mock-url');
    expect(mockLink.download).toBe('test.json');
  });

  it('Blob 内容为格式化的 JSON', () => {
    const data = { name: 'test', value: 42 };
    downloadJSON(data, 'test.json');

    const blob = (createObjectURLSpy.mock.calls[0] as [Blob])[0];
    expect(blob.type).toBe('application/json');
  });
});

describe('readJSONFile', () => {
  let mockInstances: Array<{
    readAsText: ReturnType<typeof vi.fn>;
    onload: ((e: { target: { result: string } }) => void) | null;
    onerror: ((error: Error) => void) | null;
  }> = [];

  beforeEach(() => {
    mockInstances = [];
    const MockFileReader = vi.fn(function (this: any) {
      const instance = {
        readAsText: vi.fn(),
        onload: null as ((e: { target: { result: string } }) => void) | null,
        onerror: null as ((error: Error) => void) | null,
      };
      mockInstances.push(instance);
      return instance;
    });
    Object.defineProperty(globalThis, 'FileReader', {
      value: MockFileReader,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('成功读取并解析 JSON', async () => {
    const file = new File(['{"name":"test"}'], 'test.json', { type: 'application/json' });
    const promise = readJSONFile(file);

    mockInstances[0].onload!({ target: { result: '{"name":"test"}' } });

    const result = await promise;
    expect(result).toEqual({ name: 'test' });
  });

  it('无效 JSON 时拒绝 Promise', async () => {
    const file = new File(['not-json'], 'test.json', { type: 'application/json' });
    const promise = readJSONFile(file);

    mockInstances[0].onload!({ target: { result: 'not-json' } });

    await expect(promise).rejects.toBeInstanceOf(SyntaxError);
  });

  it('FileReader 出错时拒绝 Promise', async () => {
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    const promise = readJSONFile(file);

    mockInstances[0].onerror!(new Error('Read failed'));

    await expect(promise).rejects.toBeInstanceOf(Error);
  });
});

describe('isTradeDay', () => {
  it('周一 → true', () => {
    expect(isTradeDay(new Date('2024-03-11'))).toBe(true);
  });

  it('周二 → true', () => {
    expect(isTradeDay(new Date('2024-03-12'))).toBe(true);
  });

  it('周五 → true', () => {
    expect(isTradeDay(new Date('2024-03-15'))).toBe(true);
  });

  it('周六 → false', () => {
    expect(isTradeDay(new Date('2024-03-16'))).toBe(false);
  });

  it('周日 → false', () => {
    expect(isTradeDay(new Date('2024-03-17'))).toBe(false);
  });
});

describe('getNextTradeDay', () => {
  it('周一 → 周二', () => {
    const next = getNextTradeDay(new Date('2024-03-11'));
    expect(next.toISOString().startsWith('2024-03-12')).toBe(true);
    expect(isTradeDay(next)).toBe(true);
  });

  it('周五 → 下周一', () => {
    const next = getNextTradeDay(new Date('2024-03-15'));
    expect(next.toISOString().startsWith('2024-03-18')).toBe(true);
    expect(isTradeDay(next)).toBe(true);
  });

  it('周六 → 下周一', () => {
    const next = getNextTradeDay(new Date('2024-03-16'));
    expect(next.toISOString().startsWith('2024-03-18')).toBe(true);
    expect(isTradeDay(next)).toBe(true);
  });

  it('周日 → 周一', () => {
    const next = getNextTradeDay(new Date('2024-03-17'));
    expect(next.toISOString().startsWith('2024-03-18')).toBe(true);
    expect(isTradeDay(next)).toBe(true);
  });
});
