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
  await supabase.from('pending_alerts').insert({
    transaction_id: alert.transactionId,
    fund_code: alert.fundCode,
    confirm_date: alert.confirmDate,
    reason: alert.reason,
    detail: alert.detail,
  } as any);
}

export async function fetchAlerts(): Promise<PendingAlert[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('pending_alerts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return ((data as any[]) || []).map(mapDbAlert);
}

export async function resolveAlert(alertId: string, status: 'resolved' | 'ignored'): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.from('pending_alerts').update({
    status,
    resolved_at: new Date().toISOString(),
  } as any).eq('id', alertId);
}

export async function fetchUnresolvedAlertCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await supabase
    .from('pending_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'unresolved');
  return count || 0;
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
