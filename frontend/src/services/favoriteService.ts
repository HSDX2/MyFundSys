import { supabase } from '../lib/supabase';

export async function addFavoriteFund(
  fundCode: string,
  fundName: string,
  category?: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('favorite_funds')
    .upsert({ fund_code: fundCode, fund_name: fundName, category } as any, {
      onConflict: 'fund_code',
      ignoreDuplicates: true,
    });
  return !error;
}

export async function reorderFavorites(ids: string[]): Promise<void> {
  // 批量更新排序序号：数组顺序即新排序（序号 0=最前）
  const updates = ids.map((id, index) => ({
    id,
    sort_order: index,
  }));
  for (const u of updates) {
    await (supabase.from('favorite_funds') as any).update({ sort_order: u.sort_order }).eq('id', u.id);
  }
}
