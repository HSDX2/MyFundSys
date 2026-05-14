/**
 * @fileoverview Supabase 客户端配置
 * @description 配置 Supabase 客户端，用于数据持久化和实时同步
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (supabaseUrl && !supabaseUrl.startsWith('http')) {
  throw new Error('VITE_SUPABASE_URL 格式无效');
}
if (supabaseKey && !supabaseKey.startsWith('eyJ')) {
  throw new Error('VITE_SUPABASE_ANON_KEY 格式无效，请使用 JWT 格式');
}

/**
 * Supabase 客户端实例
 * @description 用于数据库操作和实时订阅
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * 检查 Supabase 是否已配置
 * @returns {boolean} 是否已配置
 */
export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseKey;
};

/**
 * 获取基金净值（通过 Edge Function）
 * @param code - 基金代码
 * @returns 基金净值数据
 */
export async function fetchFundNavFromEdge(code: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.functions.invoke('fund-nav', {
    body: { code },
  });

  if (error) throw error;
  return data;
}

/**
 * 搜索基金（通过 Edge Function）
 * @param keyword - 搜索关键词
 * @returns 基金列表
 */
export async function searchFundsFromEdge(keyword: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.functions.invoke('fund-search', {
    body: { keyword },
  });

  if (error) throw error;
  return data;
}

/**
 * 订阅交易数据变化
 * @param callback - 数据变化回调函数
 * @param id - 调用方唯一标识，防止 React 严格模式下通道名冲突
 * @returns 取消订阅函数
 */
export function subscribeTransactions(callback: (payload: any) => void, id = 'default'): (() => void) | undefined {
  if (!isSupabaseConfigured()) return;
  const channelName = `transactions_${id}`;
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      callback
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('交易数据订阅失败:', channelName, status);
      }
    });
  return () => { supabase.removeChannel(subscription); };
}

/**
 * 订阅持仓数据变化
 * @param callback - 数据变化回调函数
 * @param id - 调用方唯一标识，防止 React 严格模式下通道名冲突
 * @returns 取消订阅函数
 */
export function subscribeHoldings(callback: (payload: any) => void, id = 'default'): (() => void) | undefined {
  if (!isSupabaseConfigured()) return;
  const channelName = `holdings_${id}`;
  const subscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'holdings' },
      callback
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('持仓数据订阅失败:', channelName, status);
      }
    });
  return () => { supabase.removeChannel(subscription); };
}
