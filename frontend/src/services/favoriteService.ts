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
