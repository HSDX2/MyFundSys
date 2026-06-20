import { supabase } from '../lib/supabase';

export async function addFavoriteFund(
  fundCode: string,
  fundName: string,
  category?: string | null
): Promise<boolean> {
  // 修复 M：为新收藏分配 sort_order（排到末尾），避免多个 NULL 排序不定。
  let nextSortOrder = 0;
  try {
    const { data } = await (supabase
      .from('favorite_funds') as any)
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && typeof data.sort_order === 'number') {
      nextSortOrder = data.sort_order + 1;
    }
  } catch {
    // sort_order 列不存在等情况，回退为 0
  }

  // 先尝试带 sort_order 的 upsert；若该列不存在则回退到不含 sort_order
  for (let attempt = 0; attempt < 2; attempt++) {
    const row: Record<string, unknown> = { fund_code: fundCode, fund_name: fundName, category };
    if (attempt === 0) row.sort_order = nextSortOrder;
    const { error } = await supabase
      .from('favorite_funds')
      .upsert(row as any, { onConflict: 'fund_code', ignoreDuplicates: true });
    if (!error) return true;
    const msg = error.message || '';
    if (attempt === 0 && msg.includes('Could not find') && msg.includes('schema cache')) {
      continue; // 回退重试
    }
    return false;
  }
  return false;
}

export async function reorderFavorites(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // 修复 M：原子化批量更新。逐条串行 update 中途失败会留下重复/乱序的 sort_order，
  // 且错误被吞掉。改为单次 upsert（依赖主键 id），并检查错误后抛出供调用方处理。
  //
  // 需带 fund_code/fund_name 以满足 NOT NULL 约束：先读现有记录再合并 sort_order。
  const { data: existing, error: fetchErr } = await (supabase
    .from('favorite_funds') as any)
    .select('id, fund_code, fund_name, category')
    .in('id', ids);
  if (fetchErr) throw new Error(`读取收藏失败: ${fetchErr.message}`);

  const byId = new Map<string, any>((existing || []).map((r: any) => [r.id, r]));
  const rows = ids.map((id, index) => {
    const base = byId.get(id);
    if (!base) return null;
    return {
      id,
      fund_code: base.fund_code,
      fund_name: base.fund_name,
      category: base.category ?? null,
      sort_order: index,
    };
  }).filter(Boolean);

  if (rows.length === 0) return;
  const { error } = await (supabase.from('favorite_funds') as any).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`保存排序失败: ${error.message}`);
}
