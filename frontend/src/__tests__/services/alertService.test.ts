import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());
const mockOrder = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn(() => ({
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
})));
const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: { from: mockFrom },
}));

import { createAlert, fetchAlerts, resolveAlert, fetchUnresolvedAlertCount } from '../../services/alertService';

describe('alertService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAlert', () => {
    it('supabase.from("pending_alerts").insert 被正确调用', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await createAlert({
        transactionId: 'tx_001',
        fundCode: '000001',
        confirmDate: '2024-03-11',
        reason: 'no_nav_data',
        detail: '无法获取 000001 在 2024-03-11 的净值',
      });

      expect(mockFrom).toHaveBeenCalledWith('pending_alerts');
      expect(mockInsert).toHaveBeenCalledWith({
        transaction_id: 'tx_001',
        fund_code: '000001',
        confirm_date: '2024-03-11',
        reason: 'no_nav_data',
        detail: '无法获取 000001 在 2024-03-11 的净值',
      });
    });

    it('Supabase 未配置时不调用 insert', async () => {
      mockIsSupabaseConfigured.mockReturnValueOnce(false);

      await createAlert({
        transactionId: 'tx_001',
        fundCode: '000001',
        confirmDate: '2024-03-11',
        reason: 'no_nav_data',
        detail: 'test',
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('fetchAlerts', () => {
    it('正确映射返回数据', async () => {
      const mockData = [
        {
          id: 'alert_001',
          transaction_id: 'tx_001',
          fund_code: '000001',
          confirm_date: '2024-03-11',
          reason: 'no_nav_data',
          detail: 'test detail',
          status: 'unresolved',
          created_at: '2024-03-15T10:00:00Z',
          resolved_at: null,
        },
      ];
      mockSelect.mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      });

      const result = await fetchAlerts();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'alert_001',
        transactionId: 'tx_001',
        fundCode: '000001',
        confirmDate: '2024-03-11',
        reason: 'no_nav_data',
        detail: 'test detail',
        status: 'unresolved',
        createdAt: '2024-03-15T10:00:00Z',
        resolvedAt: null,
      });
    });

    it('查询出错返回空数组', async () => {
      mockSelect.mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'error' } }),
      });

      const result = await fetchAlerts();
      expect(result).toEqual([]);
    });

    it('Supabase 未配置返回空数组', async () => {
      mockIsSupabaseConfigured.mockReturnValueOnce(false);
      const result = await fetchAlerts();
      expect(result).toEqual([]);
    });
  });

  describe('resolveAlert', () => {
    it('调用 update 设置 status 和 resolved_at', async () => {
      mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      await resolveAlert('alert_001', 'resolved');

      expect(mockFrom).toHaveBeenCalledWith('pending_alerts');
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'resolved',
        resolved_at: expect.any(String),
      });
    });

    it('Supabase 未配置时不调用 update', async () => {
      mockIsSupabaseConfigured.mockReturnValueOnce(false);

      await resolveAlert('alert_001', 'ignored');

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('fetchUnresolvedAlertCount', () => {
    it('返回未解决告警数量', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
      });

      const result = await fetchUnresolvedAlertCount();
      expect(result).toBe(3);
    });

    it('查询出错返回 0', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'error' } }),
      });

      const result = await fetchUnresolvedAlertCount();
      expect(result).toBe(0);
    });

    it('Supabase 未配置返回 0', async () => {
      mockIsSupabaseConfigured.mockReturnValueOnce(false);
      const result = await fetchUnresolvedAlertCount();
      expect(result).toBe(0);
    });
  });
});
