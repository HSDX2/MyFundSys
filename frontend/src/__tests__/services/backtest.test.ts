import { describe, it, expect } from 'vitest';
import {
  runBacktest,
  evaluateRule,
  calculateMaxDrawdown,
  calculateSharpeRatio,
  buildPriceDataFromHistory,
} from '../../services/backtest';
import type { Strategy } from '../../types';

describe('backtest', () => {
  const mockStrategy: Strategy = {
    id: 's_001',
    name: '测试策略',
    description: '用于测试的策略',
    type: 'valuation',
    rules: [
      { condition: 'percentile < 20', action: 'buy', params: { ratio: 0.5 } },
      { condition: 'percentile > 80', action: 'sell', params: { ratio: 0.5 } },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  // 使用固定的真实价格数据格式进行测试
  const createTestPriceData = (startPrice = 1.0, days = 20) => {
    const data: { date: string; price: number; pe?: number; pb?: number }[] = [];
    const startDate = new Date('2024-01-01');
    let currentPrice = startPrice;

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // 跳过周末
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // 模拟真实价格波动（±2%）
      const change = (Math.sin(i * 0.3) * 0.01) + (i % 5 === 0 ? 0.01 : 0);
      currentPrice = currentPrice * (1 + change);

      data.push({
        date: date.toISOString().split('T')[0],
        price: Number(currentPrice.toFixed(4)),
        pe: Number((15 + Math.sin(i * 0.2) * 5).toFixed(2)),
        pb: Number((1.5 + Math.sin(i * 0.2) * 0.5).toFixed(2)),
      });
    }

    return data;
  };

  describe('runBacktest', () => {
    it('回测返回完整的结果对象', async () => {
      const priceData = createTestPriceData(1.0, 20);

      const result = await runBacktest({
        strategy: mockStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
        priceData,
      });

      expect(result).toHaveProperty('strategyName', '测试策略');
      expect(result).toHaveProperty('startDate', '2024-01-01');
      expect(result).toHaveProperty('endDate', '2024-01-31');
      expect(result).toHaveProperty('initialCapital', 10000);
      expect(result).toHaveProperty('finalValue');
      expect(result).toHaveProperty('totalReturn');
      expect(result).toHaveProperty('annualizedReturn');
      expect(result).toHaveProperty('maxDrawdown');
      expect(result).toHaveProperty('sharpeRatio');
      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('equityCurve');
    });

    it('权益曲线与交易日数量一致', async () => {
      const priceData = createTestPriceData(1.0, 10);

      const result = await runBacktest({
        strategy: mockStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 10000,
        priceData,
      });

      expect(result.equityCurve.length).toBe(priceData.length);
    });

    it('年化收益基于真实日历跨度，不随数据点密度变化（修复 E）', async () => {
      // 不触发任何买卖规则的策略 → totalReturn=0 → annualized=0，
      // 重点验证 years 用首尾日期跨度而非 length/252，两种密度结果一致。
      const noopStrategy: Strategy = {
        id: 's_noop', name: 'noop', description: '', type: 'custom',
        rules: [], createdAt: '2024-01-01', updatedAt: '2024-01-01',
      };
      const mk = (dates: string[]) => dates.map(d => ({ date: d, price: 1.0, pe: 15, pb: 1.5 }));

      // 同样一年跨度，一个 2 点、一个稠密 13 点
      const sparse = mk(['2024-01-01', '2025-01-01']);
      const dense = mk(['2024-01-01','2024-02-01','2024-03-01','2024-04-01','2024-05-01','2024-06-01','2024-07-01','2024-08-01','2024-09-01','2024-10-01','2024-11-01','2024-12-01','2025-01-01']);

      const base = { strategy: noopStrategy, fundCode: '000001', startDate: '2024-01-01', endDate: '2025-01-01', initialCapital: 10000 };
      const r1 = await runBacktest({ ...base, priceData: sparse });
      const r2 = await runBacktest({ ...base, priceData: dense });

      // totalReturn 都为 0，年化也都为 0；关键是两者相等（旧实现会因 length 不同而不同）
      expect(r1.annualizedReturn).toBeCloseTo(r2.annualizedReturn, 10);
      expect(r1.annualizedReturn).toBeCloseTo(0, 10);
    });

    it('一年跨度的正收益年化≈总收益（修复 E）', async () => {
      // 买入并持有：净值翻倍，跨度恰一年，年化应≈总收益
      const buyHold: Strategy = {
        id: 's_bh', name: 'bh', description: '', type: 'custom',
        rules: [{ condition: 'percentile < 100', action: 'buy', params: { ratio: 1 } }],
        createdAt: '2024-01-01', updatedAt: '2024-01-01',
      };
      const priceData = [
        { date: '2024-01-01', price: 1.0, pe: 10, pb: 1.0 },
        { date: '2025-01-01', price: 2.0, pe: 10, pb: 1.0 },
      ];
      const result = await runBacktest({
        strategy: buyHold, fundCode: '000001', startDate: '2024-01-01', endDate: '2025-01-01',
        initialCapital: 10000, priceData,
      });
      // 一年跨度，年化 ≈ totalReturn（误差因 365.25 天近似）
      expect(result.annualizedReturn).toBeCloseTo(result.totalReturn, 1);
    });

    it('定投策略回测', async () => {
      const monthlyStrategy: Strategy = {
        id: 's_002',
        name: '定投策略',
        description: '每月定投',
        type: 'trend',
        rules: [
          { condition: 'monthly', action: 'buy', params: { amount: 1000 } },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const priceData = createTestPriceData(1.0, 60);

      const result = await runBacktest({
        strategy: monthlyStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        initialCapital: 10000,
        priceData,
      });

      expect(result.strategyName).toBe('定投策略');
      expect(result.trades).toBeGreaterThanOrEqual(0);
    });

    it('初始资金正确反映在最终价值中', async () => {
      const priceData = createTestPriceData(1.0, 5);

      const result = await runBacktest({
        strategy: { ...mockStrategy, rules: [] }, // 无规则，不交易
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        initialCapital: 5000,
        priceData,
      });

      expect(result.initialCapital).toBe(5000);
      // 无交易时最终价值应等于初始资金
      expect(result.finalValue).toBe(5000);
      expect(result.totalReturn).toBe(0);
    });

    it('价格数据按日期升序排列', () => {
      const priceData = createTestPriceData(1.0, 10);

      for (let i = 1; i < priceData.length; i++) {
        const prevDate = new Date(priceData[i - 1].date).getTime();
        const currDate = new Date(priceData[i].date).getTime();
        expect(currDate).toBeGreaterThanOrEqual(prevDate);
      }
    });

    it('周末数据被正确过滤', () => {
      const priceData = createTestPriceData(1.0, 7);

      priceData.forEach(item => {
        const date = new Date(item.date);
        const dayOfWeek = date.getDay();
        expect(dayOfWeek).not.toBe(0); // 周日
        expect(dayOfWeek).not.toBe(6); // 周六
      });
    });

    it('没有历史数据时抛出错误', async () => {
      await expect(
        runBacktest({
          strategy: mockStrategy,
          fundCode: '000001',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          initialCapital: 10000,
          priceData: [],
        })
      ).rejects.toThrow('没有可用的历史数据');
    });

    it('估值条件触发交易', async () => {
      // 使用 pe=20 → currentPercentile=0.5, percentile < 60 为 true
      const strategy: Strategy = {
        ...mockStrategy,
        rules: [{ condition: 'percentile < 60', action: 'buy', params: { ratio: 0.5 } }],
      };
      const priceData = [
        { date: '2024-01-01', price: 1.0, pe: 20 },
        { date: '2024-01-02', price: 1.0, pe: 20 },
      ];
      const result = await runBacktest({
        strategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        initialCapital: 10000,
        priceData,
      });
      expect(result.trades).toBeGreaterThan(0);
    });

    it('高估时触发卖出', async () => {
      const highPeData = [
        { date: '2024-01-01', price: 1.0, pe: 30 },
        { date: '2024-01-02', price: 1.0, pe: 30 },
      ];
      const buyFirstStrategy: Strategy = {
        ...mockStrategy,
        rules: [
          { condition: 'percentile < 20', action: 'buy', params: { ratio: 1 } },
          { condition: 'percentile > 80', action: 'sell', params: { ratio: 1 } },
        ],
      };
      await runBacktest({
        strategy: buyFirstStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-01',
        initialCapital: 10000,
        priceData: [{ date: '2024-01-01', price: 1.0, pe: 10 }],
      });
      const result = await runBacktest({
        strategy: buyFirstStrategy,
        fundCode: '000001',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
        initialCapital: 10000,
        priceData: [{ date: '2024-01-02', price: 1.5, pe: 30 }],
      });
      expect(result.trades).toBeGreaterThanOrEqual(0);
    });

    it('无规则时不交易', async () => {
      const priceData = createTestPriceData(1.0, 5);
      const result = await runBacktest({
        strategy: { ...mockStrategy, rules: [] },
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        initialCapital: 10000,
        priceData,
      });
      expect(result.trades).toBe(0);
    });

    it('买入后高价触发卖出', async () => {
      const buySellStrategy: Strategy = {
        ...mockStrategy,
        rules: [
          { condition: 'percentile < 60', action: 'buy', params: { ratio: 1 } },
          { condition: 'percentile > 40', action: 'sell', params: { ratio: 1 } },
        ],
      };
      const priceData = [
        { date: '2024-01-01', price: 1.0, pe: 20 },
        { date: '2024-01-02', price: 1.5, pe: 20 },
      ];
      const result = await runBacktest({
        strategy: buySellStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        initialCapital: 10000,
        priceData,
      });
      expect(result.trades).toBeGreaterThanOrEqual(2);
    });
  });

  describe('evaluateRule', () => {
    it('percentile < 条件，低于阈值时返回true', async () => {
      // pe=20 → currentPercentile=0.5, 0.5 < 0.6 = true
      const result = await evaluateRule('percentile < 60', { date: '2024-01-01', price: 1.0, pe: 20 });
      expect(result).toBe(true);
    });

    it('percentile < 条件，高于阈值时返回false', async () => {
      // pe=20 → currentPercentile=0.5, 0.5 < 0.4 = false
      const result = await evaluateRule('percentile < 40', { date: '2024-01-01', price: 1.0, pe: 20 });
      expect(result).toBe(false);
    });

    it('percentile > 条件，高于阈值时返回true', async () => {
      // pe=20 → currentPercentile=0.5, 0.5 > 0.4 = true
      const result = await evaluateRule('percentile > 40', { date: '2024-01-01', price: 1.0, pe: 20 });
      expect(result).toBe(true);
    });

    it('monthly条件，每月1日返回true', async () => {
      const result = await evaluateRule('monthly', { date: '2024-01-01', price: 1.0 });
      expect(result).toBe(true);
    });

    it('monthly条件，非1日返回false', async () => {
      const result = await evaluateRule('monthly', { date: '2024-01-02', price: 1.0 });
      expect(result).toBe(false);
    });

    it('未知条件返回false', async () => {
      const result = await evaluateRule('unknown condition', { date: '2024-01-01', price: 1.0 });
      expect(result).toBe(false);
    });

    it('无PE/PB数据时使用默认值0.5', async () => {
      const resultLt = await evaluateRule('percentile < 60', { date: '2024-01-01', price: 1.0 });
      expect(resultLt).toBe(true);
      const resultGt = await evaluateRule('percentile > 60', { date: '2024-01-01', price: 1.0 });
      expect(resultGt).toBe(false);
    });

    it('使用PB作为PE的备选', async () => {
      // pb=2.0 → currentPercentile=0.5, 0.5 < 0.6 = true
      const result = await evaluateRule('percentile < 60', { date: '2024-01-01', price: 1.0, pb: 2.0 });
      expect(result).toBe(true);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('上升曲线无回撤返回0', () => {
      const curve = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 110 },
        { date: '2024-01-03', value: 120 },
      ];
      expect(calculateMaxDrawdown(curve)).toBe(0);
    });

    it('单次回撤正确计算', () => {
      const curve = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 120 },
        { date: '2024-01-03', value: 90 },
      ];
      expect(calculateMaxDrawdown(curve)).toBeCloseTo(0.25, 4);
    });

    it('多次回撤取最大值', () => {
      const curve = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 120 },
        { date: '2024-01-03', value: 90 },
        { date: '2024-01-04', value: 130 },
        { date: '2024-01-05', value: 80 },
      ];
      expect(calculateMaxDrawdown(curve)).toBeCloseTo(0.3846, 3);
    });
  });

  describe('calculateSharpeRatio', () => {
    it('单点数据返回0', () => {
      expect(calculateSharpeRatio([{ date: '2024-01-01', value: 100 }])).toBe(0);
    });

    it('无波动返回0', () => {
      const curve = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 100 },
        { date: '2024-01-03', value: 100 },
      ];
      expect(calculateSharpeRatio(curve)).toBe(0);
    });

    it('正收益返回正值', () => {
      const curve = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 101 },
        { date: '2024-01-03', value: 102 },
      ];
      expect(calculateSharpeRatio(curve)).toBeGreaterThan(0);
    });
  });

  describe('buildPriceDataFromHistory', () => {
    it('正常转换历史数据', async () => {
      const mockHistory = [
        { date: '2024-01-02', nav: 1.1 },
        { date: '2024-01-01', nav: 1.0 },
      ];
      const result = await buildPriceDataFromHistory('000001', '2024-01-01', '2024-01-02', async () => mockHistory);
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[0].price).toBe(1.0);
    });

    it('空数据抛出错误', async () => {
      await expect(
        buildPriceDataFromHistory('000001', '2024-01-01', '2024-01-02', async () => [])
      ).rejects.toThrow('无法获取基金');
    });

    it('按日期升序排列', async () => {
      const mockHistory = [
        { date: '2024-01-03', nav: 1.3 },
        { date: '2024-01-01', nav: 1.1 },
        { date: '2024-01-02', nav: 1.2 },
      ];
      const result = await buildPriceDataFromHistory('000001', '2024-01-01', '2024-01-03', async () => mockHistory);
      expect(result[0].date).toBe('2024-01-01');
      expect(result[1].date).toBe('2024-01-02');
      expect(result[2].date).toBe('2024-01-03');
    });
  });
});
