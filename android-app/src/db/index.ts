import { supabase, isSupabaseConfigured } from '../lib/supabase';

export async function resetDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const tables = ['holdings', 'transactions', 'favorite_funds', 'fund_cache', 'grid_strategies', 'grid_executions'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '0');
    if (error) continue;
  }
}

export async function exportDatabase(): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const [h, t, gs, ge, ff] = await Promise.all([
    supabase.from('holdings').select('*'), supabase.from('transactions').select('*'),
    supabase.from('grid_strategies').select('*'), supabase.from('grid_executions').select('*'),
    supabase.from('favorite_funds').select('*'),
  ]);
  return JSON.stringify({
    version: '3.0.0', exportDate: new Date().toISOString(),
    holdings: h.data || [], transactions: t.data || [],
    grid_strategies: gs.data || [], grid_executions: ge.data || [],
    favorite_funds: ff.data || [],
  }, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const data = JSON.parse(jsonString);
  const obj = data as Record<string, any>;
  const tables = ['holdings', 'transactions', 'favorite_funds', 'grid_strategies', 'grid_executions'] as const;
  for (const table of tables) {
    const rows = Array.isArray(obj[table]) ? obj[table] : [];
    if (rows.length) {
      await supabase.from(table).delete().neq('id', '0');
      await supabase.from(table).insert(rows as any);
    }
  }
}
