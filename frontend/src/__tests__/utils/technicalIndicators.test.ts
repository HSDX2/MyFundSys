import { describe, it, expect } from 'vitest';
import {
  calculateEMA,
  calculateMACD,
  calculateKDJ,
  calculateMA,
  filterRecentData,
  getDaysFromRange,
  formatShortDate,
  getMACDParams,
  getKDJParams,
} from '../../utils/technicalIndicators';
import type { HistoryPoint } from '../../utils/technicalIndicators';

function makeHistoryPoints(count: number, navBase = 1.0, navStep = 0.01): HistoryPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    nav: navBase + i * navStep,
  }));
}

describe('calculateEMA', () => {
  it('单元素数组返回自身', () => {
    expect(calculateEMA([10], 12)).toEqual([10]);
  });

  it('多元素按EMA公式平滑计算', () => {
    const result = calculateEMA([10, 12, 11], 12);
    const alpha = 2 / 13;
    expect(result[0]).toBe(10);
    expect(result[1]).toBeCloseTo(alpha * 12 + (1 - alpha) * 10, 4);
    expect(result[2]).toBeCloseTo(alpha * 11 + (1 - alpha) * result[1], 4);
  });

  it('数据恒定时EMA保持不变', () => {
    const result = calculateEMA([5, 5, 5, 5, 5], 12);
    expect(result.every(v => v === 5)).toBe(true);
  });

  it('空数组返回空数组', () => {
    expect(calculateEMA([], 12)).toEqual([]);
  });
});

describe('calculateMACD', () => {
  it('数据充足时返回完整MACD数组', () => {
    const data = makeHistoryPoints(40);
    const result = calculateMACD(data);
    expect(result.length).toBe(40);
    expect(result[0]).toMatchObject({
      date: expect.any(String),
      dif: expect.any(Number),
      dea: expect.any(Number),
      macd: expect.any(Number),
    });
  });

  it('数据不足slowPeriod+signalPeriod时返回空数组', () => {
    const data = makeHistoryPoints(30);
    expect(calculateMACD(data)).toEqual([]);
  });

  it('刚好满足最小数据量时返回非空', () => {
    const data = makeHistoryPoints(35);
    const result = calculateMACD(data);
    expect(result.length).toBe(35);
  });

  it('价格恒定时MACD全为0', () => {
    const data = Array.from({ length: 40 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      nav: 1.0,
    }));
    const result = calculateMACD(data);
    expect(result.length).toBe(40);
    result.forEach(point => {
      expect(point.dif).toBe(0);
      expect(point.dea).toBe(0);
      expect(point.macd).toBe(0);
    });
  });

  it('自定义短周期参数计算正确', () => {
    const data = makeHistoryPoints(20);
    const result = calculateMACD(data, 5, 10, 5);
    expect(result.length).toBe(20);
  });

  it('空数组返回空数组', () => {
    expect(calculateMACD([])).toEqual([]);
  });
});

describe('calculateKDJ', () => {
  it('数据充足时返回完整KDJ数组', () => {
    const data = makeHistoryPoints(15);
    const result = calculateKDJ(data);
    expect(result.length).toBe(15);
    expect(result[0]).toMatchObject({
      date: expect.any(String),
      k: expect.any(Number),
      d: expect.any(Number),
      j: expect.any(Number),
    });
  });

  it('数据不足n时返回空数组', () => {
    const data = makeHistoryPoints(5);
    expect(calculateKDJ(data)).toEqual([]);
  });

  it('前n-1天使用默认值50', () => {
    const data = makeHistoryPoints(10);
    const result = calculateKDJ(data, 9, 3, 3);
    expect(result[0]).toEqual({ date: '2024-01-01', k: 50, d: 50, j: 50 });
    expect(result[7]).toEqual({ date: '2024-01-08', k: 50, d: 50, j: 50 });
  });

  it('最高价等于最低价时RSV为0', () => {
    const flatData = Array.from({ length: 12 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      nav: 1.0,
    }));
    const result = calculateKDJ(flatData, 9, 3, 3);
    // 索引8（第9天）开始计算，RSV=0
    expect(result[8].k).toBe(33.33);
  });

  it('自定义短周期参数计算正确', () => {
    const data = makeHistoryPoints(5);
    const result = calculateKDJ(data, 3, 3, 3);
    expect(result.length).toBe(5);
  });
});

describe('calculateMA', () => {
  it('period=3时正确计算移动平均', () => {
    const data = makeHistoryPoints(5, 1.0, 1.0);
    const result = calculateMA(data, 3);
    expect(result[0].value).toBeUndefined();
    expect(result[1].value).toBeUndefined();
    expect(result[2].value).toBeCloseTo(2, 4);
    expect(result[3].value).toBeCloseTo(3, 4);
    expect(result[4].value).toBeCloseTo(4, 4);
  });

  it('空数组返回空数组', () => {
    expect(calculateMA([], 5)).toEqual([]);
  });

  it('刚好满足period时最后一个有值', () => {
    const data = makeHistoryPoints(3, 1.0, 1.0);
    const result = calculateMA(data, 3);
    expect(result[0].value).toBeUndefined();
    expect(result[1].value).toBeUndefined();
    expect(result[2].value).toBeCloseTo(2, 4);
  });
});

describe('filterRecentData', () => {
  it('正常过滤最近N天并按时间升序返回', () => {
    const data = makeHistoryPoints(5);
    const result = filterRecentData(data, 3);
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2024-01-03');
    expect(result[1].date).toBe('2024-01-04');
    expect(result[2].date).toBe('2024-01-05');
  });

  it('空数组返回空数组', () => {
    expect(filterRecentData([], 5)).toEqual([]);
  });

  it('days >= 9999返回全部数据', () => {
    const data = makeHistoryPoints(3);
    expect(filterRecentData(data, 9999)).toHaveLength(3);
    expect(filterRecentData(data, 10000)).toHaveLength(3);
  });

  it('days大于数据长度返回全部', () => {
    const data = makeHistoryPoints(2);
    expect(filterRecentData(data, 10)).toHaveLength(2);
  });

  it('乱序数据正确排序后过滤', () => {
    const data = [
      { date: '2024-01-05', nav: 1.0 },
      { date: '2024-01-01', nav: 1.0 },
      { date: '2024-01-03', nav: 1.0 },
      { date: '2024-01-02', nav: 1.0 },
      { date: '2024-01-04', nav: 1.0 },
    ];
    const result = filterRecentData(data, 3);
    expect(result.map(d => d.date)).toEqual(['2024-01-03', '2024-01-04', '2024-01-05']);
  });

  it('days为0返回空数组', () => {
    const data = makeHistoryPoints(2);
    expect(filterRecentData(data, 0)).toEqual([]);
  });
});

describe('getDaysFromRange', () => {
  it('1m返回约22个交易日', () => {
    expect(getDaysFromRange('1m')).toBe(22);
  });

  it('1y返回约250个交易日', () => {
    expect(getDaysFromRange('1y')).toBe(250);
  });

  it('all返回9999天', () => {
    expect(getDaysFromRange('all')).toBe(9999);
  });
});

describe('formatShortDate', () => {
  it('should format dates as M/D', () => {
    expect(formatShortDate('2024-03-15')).toBe('3/15');
    expect(formatShortDate('2024-01-01')).toBe('1/1');
    expect(formatShortDate('2024-03-15T08:30:00.000Z')).toBe('3/15');
    expect(formatShortDate('not-a-date')).toBe('NaN/NaN');
  });
});

describe('getMACDParams', () => {
  it('1m返回超短周期参数', () => {
    expect(getMACDParams('1m')).toEqual({
      fastPeriod: 5,
      slowPeriod: 10,
      signalPeriod: 5,
      label: '超短(5,10,5)',
    });
  });

  it('3m返回短线参数', () => {
    expect(getMACDParams('3m')).toEqual({
      fastPeriod: 6,
      slowPeriod: 13,
      signalPeriod: 5,
      label: '短线(6,13,5)',
    });
  });

  it('6m返回平衡参数', () => {
    expect(getMACDParams('6m')).toEqual({
      fastPeriod: 8,
      slowPeriod: 17,
      signalPeriod: 7,
      label: '平衡(8,17,7)',
    });
  });

  it('1y返回标准参数', () => {
    expect(getMACDParams('1y')).toEqual({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      label: '标准(12,26,9)',
    });
  });

  it('all返回标准参数', () => {
    expect(getMACDParams('all')).toEqual({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      label: '标准(12,26,9)',
    });
  });
});

describe('getKDJParams', () => {
  it('1m返回超短周期参数', () => {
    expect(getKDJParams('1m')).toEqual({
      n: 3,
      m1: 3,
      m2: 3,
      label: '超短(3,3,3)',
    });
  });

  it('6m返回平衡参数', () => {
    expect(getKDJParams('6m')).toEqual({
      n: 7,
      m1: 3,
      m2: 3,
      label: '平衡(7,3,3)',
    });
  });

  it('1y返回标准参数', () => {
    expect(getKDJParams('1y')).toEqual({
      n: 9,
      m1: 3,
      m2: 3,
      label: '标准(9,3,3)',
    });
  });

  it('all返回标准参数', () => {
    expect(getKDJParams('all')).toEqual({
      n: 9,
      m1: 3,
      m2: 3,
      label: '标准(9,3,3)',
    });
  });
});
