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

  const errors: string[] = [];

  // 断开 FK 循环引用（transactions ↔ grid_executions）
  // 使用 id=not.is.null（IS NOT NULL）作为通用过滤器，所有列类型均兼容
  async function updateAll(table: string, set: Record<string, unknown>) {
    try {
      const { error } = await (supabase.from(table) as any).update(set).not('id', 'is', null);
      if (error) errors.push(`解除 ${table} FK 失败: ${error.message}`);
    } catch (e) {
      errors.push(`解除 ${table} FK 异常: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await updateAll('transactions', { grid_execution_id: null });
  await updateAll('grid_executions', { transaction_id: null });

  // 按依赖顺序逐表删除，子表先于父表
  const tables = ['grid_executions', 'transactions', 'grid_strategies', 'holdings', 'favorite_funds', 'fund_cache', 'fund_search_history'];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error) errors.push(`${table}: ${error.message}`);
    } catch (e) {
      errors.push(`${table}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`重置数据失败:\n${errors.join('\n')}`);
  }
}

export async function exportDatabase(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const [holdings, transactions, gridStrategies, gridExecutions, favoriteFunds] = await Promise.all([
    supabase.from('holdings').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('grid_strategies').select('*'),
    supabase.from('grid_executions').select('*'),
    supabase.from('favorite_funds').select('*'),
  ]);

  const data = {
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    holdings: holdings.data || [],
    transactions: transactions.data || [],
    grid_strategies: gridStrategies.data || [],
    grid_executions: gridExecutions.data || [],
    favorite_funds: favoriteFunds.data || [],
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
  function hasPoison(obj: unknown, seen?: Set<object>): boolean {
    if (!obj || typeof obj !== 'object') return false;
    if (!seen) seen = new Set();
    if (seen.has(obj)) return false;
    seen.add(obj);
    for (const [k, v] of Object.entries(obj)) {
      if (poisonKeys.includes(k)) return true;
      if (hasPoison(v, seen)) return true;
    }
    return false;
  }
  if (holdings.some(v => hasPoison(v)) || transactions.some(v => hasPoison(v))) {
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

  const obj = data as Record<string, unknown>;
  const gridStrategies = Array.isArray(obj.grid_strategies) ? obj.grid_strategies : [];
  const gridExecutions = Array.isArray(obj.grid_executions) ? obj.grid_executions : [];
  const favoriteFunds = Array.isArray(obj.favorite_funds) ? obj.favorite_funds : [];

  // 先 INSERT 再 DELETE，防止数据丢失
  if (holdings.length) {
    const { error: insErr } = await supabase.from('holdings').insert(holdings as any);
    if (!insErr) await supabase.from('holdings').delete().not('id', 'is', null);
  }
  if (transactions.length) {
    const { error: insErr } = await supabase.from('transactions').insert(transactions as any);
    if (!insErr) await supabase.from('transactions').delete().not('id', 'is', null);
  }
  if (gridStrategies.length) {
    const { error: insErr } = await supabase.from('grid_strategies').insert(gridStrategies as any);
    if (!insErr) await supabase.from('grid_strategies').delete().not('id', 'is', null);
  }
  if (gridExecutions.length) {
    const { error: insErr } = await supabase.from('grid_executions').insert(gridExecutions as any);
    if (!insErr) await supabase.from('grid_executions').delete().not('id', 'is', null);
  }
  if (favoriteFunds.length) {
    const { error: insErr } = await supabase.from('favorite_funds').insert(favoriteFunds as any);
    if (!insErr) await supabase.from('favorite_funds').delete().not('id', 'is', null);
  }
}
