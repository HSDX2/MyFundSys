/**
 * @fileoverview 类型定义 + Supabase 数据操作
 * @description Supabase 为唯一数据源，不再使用 IndexedDB
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 类型定义（与实际数据库表结构匹配）
// ============================================

/**
 * 收藏基金（对应 favorite_funds 表）
 */
export interface FavoriteFund {
  id?: string;
  fund_code: string;
  fund_name: string;
  category?: string;
  created_at?: string;
}

// 移除未使用的类型定义（这些接口未在代码中使用）
// export interface FundCacheItem { ... }  // 未使用
// export interface ScheduledTask { ... } // 未使用
// export interface FeishuConfig { ... }  // 未使用

// ============================================
// Supabase 数据操作（替代原 IndexedDB 操作）
// ============================================

export async function resetDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const tables = ['holdings', 'transactions', 'favorite_funds', 'fund_cache', 'grid_strategies', 'grid_executions'];
  for (const table of tables) {
    const { data, error: fetchError } = await supabase.from(table).select('id');
    if (fetchError) {
      continue;
    }
    if (data && data.length > 0) {
      const ids = data.map((row: any) => row.id);
      const { error: deleteError } = await supabase.from(table).delete().in('id', ids);
      if (deleteError) {
        // 静默忽略删除错误，继续处理下一个表
      }
    }
  }
}

export async function exportDatabase(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const [holdings, transactions, gridStrategies, gridExecutions] = await Promise.all([
    supabase.from('holdings').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('grid_strategies').select('*'),
    supabase.from('grid_executions').select('*'),
  ]);

  const data = {
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    holdings: holdings.data || [],
    transactions: transactions.data || [],
    grid_strategies: gridStrategies.data || [],
    grid_executions: gridExecutions.data || [],
  };

  return JSON.stringify(data, null, 2);
}

function validateImportData(data: unknown): { holdings: unknown[]; transactions: unknown[] } {
  if (!data || typeof data !== 'object') {
    throw new Error('导入数据格式无效：应为 JSON 对象');
  }
  const obj = data as Record<string, unknown>;
  const holdings = Array.isArray(obj.holdings) ? obj.holdings : [];
  const transactions = Array.isArray(obj.transactions) ? obj.transactions : [];
  if (holdings.length === 0 && transactions.length === 0) {
    throw new Error('导入数据为空');
  }
  if (holdings.length > 10000 || transactions.length > 100000) {
    throw new Error('导入数据量超限');
  }
  // 拒绝原型污染键
  const poisonKeys = ['__proto__', 'constructor', 'prototype'];
  function hasPoison(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false;
    for (const [k, v] of Object.entries(obj)) {
      if (poisonKeys.includes(k)) return true;
      if (hasPoison(v)) return true;
    }
    return false;
  }
  if (holdings.some(hasPoison) || transactions.some(hasPoison)) {
    throw new Error('导入数据包含非法键');
  }
  return { holdings, transactions };
}

export async function importDatabase(jsonString: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new Error('导入数据不是有效的 JSON');
  }
  const { holdings, transactions } = validateImportData(data);

  if (holdings.length) {
    await supabase.from('holdings').delete().neq('id', '');
    await supabase.from('holdings').insert(holdings as any);
  }
  if (transactions.length) {
    await supabase.from('transactions').delete().neq('id', '');
    await supabase.from('transactions').insert(transactions as any);
  }

  // 导入网格数据（如果存在）
  const obj = data as Record<string, unknown>;
  const gridStrategies = Array.isArray(obj.grid_strategies) ? obj.grid_strategies : [];
  const gridExecutions = Array.isArray(obj.grid_executions) ? obj.grid_executions : [];
  if (gridStrategies.length) {
    await supabase.from('grid_strategies').delete().neq('id', '');
    await supabase.from('grid_strategies').insert(gridStrategies as any);
  }
  if (gridExecutions.length) {
    await supabase.from('grid_executions').delete().neq('id', '');
    await supabase.from('grid_executions').insert(gridExecutions as any);
  }
}
