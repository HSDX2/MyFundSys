import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface PendingAlert {
  id: string;
  transactionId: string;
  fundCode: string;
  confirmDate: string;
  reason: string;
  detail: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  createdAt: string;
  resolvedAt: string | null;
}

export async function createAlert(alert: {
  transactionId: string;
  fundCode: string;
  confirmDate: string;
  reason: string;
  detail: string;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  // 修复 #2：同一笔交易、同一原因去重，避免 processPendingTransactions 反复运行时告警膨胀。
  // 依赖 pending_alerts (transaction_id, reason) 唯一约束 + upsert。
  // 若约束尚未迁移（旧库），upsert 回退为普通 insert 并忽略冲突错误。
  const row = {
    transaction_id: alert.transactionId,
    fund_code: alert.fundCode,
    confirm_date: alert.confirmDate,
    reason: alert.reason,
    detail: alert.detail,
  };
  const { error } = await (supabase.from('pending_alerts') as any).upsert(row, {
    onConflict: 'transaction_id,reason',
    ignoreDuplicates: true,
  });
  // ignoreDuplicates 下重复行不会报错；仅当 upsert 因唯一约束缺失等原因失败时，
  // 退回普通 insert（best-effort，不抛出阻塞主流程）。
  if (error) {
    try {
      await (supabase.from('pending_alerts') as any).insert(row);
    } catch { /* 忽略 */ }
  }
}

export async function fetchAlerts(): Promise<PendingAlert[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await (supabase
      .from('pending_alerts') as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return ((data as any[]) || []).map(mapDbAlert);
  } catch {
    return [];
  }
}

export async function resolveAlert(alertId: string, status: 'resolved' | 'ignored'): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await (supabase.from('pending_alerts') as any).update({
    status,
    resolved_at: new Date().toISOString(),
  }).eq('id', alertId);
}

export async function fetchUnresolvedAlertCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const { count, error } = await (supabase
      .from('pending_alerts') as any)
      .select('id', { count: 'exact', head: true })
      .eq('status', 'unresolved');
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

function mapDbAlert(row: any): PendingAlert {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    fundCode: row.fund_code,
    confirmDate: row.confirm_date,
    reason: row.reason,
    detail: row.detail,
    status: row.status || 'unresolved',
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}
