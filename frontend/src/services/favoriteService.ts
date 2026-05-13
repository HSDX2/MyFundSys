import { supabase } from '../lib/supabase';

export async function addFavoriteFund(
  fundCode: string,
  fundName: string,
  category?: string | null
): Promise<boolean> {
  const { error } = await (supabase
    .from('favorite_funds') as any)
    .insert({ fund_code: fundCode, fund_name: fundName, category })
    .onConflict('fund_code')
    .ignore();
  return !error;
}
