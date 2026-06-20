/**
 * 数据访问 Hooks
 * 
 * Supabase 为唯一数据源
 * 持仓从交易记录派生，不再依赖 holdings 表
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { removeTransactionWithHoldingUpdate, removeHoldingWithTransactions, deriveLots, summarizeHoldings, addTransactionWithHoldingUpdate } from '../services/navUpdateService';
import { batchFetchNav } from '../services/fundApi';
import type { Holding, Transaction } from '../types';
import type { Lot, RealizedLot } from '../services/navUpdateService';

// ============================================
// 同步状态 Hook
// ============================================

export interface SyncStatus {
  isOnline: boolean;
  isConfigured: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  lastSyncTime: Date | null;
  lastSyncError: string | null;
  pendingChanges: number;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isConfigured: isSupabaseConfigured(),
    isSyncing: false,
    lastSync: null,
    lastSyncTime: null,
    lastSyncError: null,
    pendingChanges: 0,
  });

  useEffect(() => {
    const handleOnline = () => setStatus(s => ({ ...s, isOnline: true }));
    const handleOffline = () => setStatus(s => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setStatus(s => ({ ...s, isSyncing: true }));
    try {
      const { error } = await supabase.from('favorite_funds').select('id', { count: 'exact', head: true }).limit(1);
      if (error) throw error;
      setStatus(s => ({
        ...s, isSyncing: false, lastSync: new Date(), lastSyncTime: new Date(),
        lastSyncError: null, pendingChanges: 0,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '同步失败';
      setStatus(s => ({ ...s, isSyncing: false, lastSyncError: msg }));
    }
  }, []);

  return { status, triggerSync };
}

// ============================================
// 数据访问 Hooks
// ============================================

function mapTransaction(t: any): Transaction {
  return {
    id: t.id,
    fundId: t.fund_code,
    fundCode: t.fund_code,
    fundName: t.fund_name,
    type: t.type,
    date: t.date,
    confirmDate: t.confirm_date || t.date,
    amount: t.amount,
    price: t.nav,
    shares: t.shares,
    fee: t.fee,
    status: t.status,
    source: t.source || 'manual',
    gridExecutionId: t.grid_execution_id,
    lotId: t.lot_id,
    createdAt: t.created_at,
  };
}

/**
 * 持仓 Hook
 * 从交易记录派生批次，汇总为基金级持仓，再获取最新净值计算盈亏
 */
export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHoldings = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data: txData, error } = await supabase.from('transactions').select('*');
        if (!error && txData) {
          const transactions = txData.map(mapTransaction);
          // 从交易派生批次
          const derivedLots = deriveLots(transactions);
          setLots(derivedLots);
          // 汇总为基金级持仓
          const summaries = summarizeHoldings(derivedLots);
          // 获取最新净值，计算市值和盈亏
          const enriched = await enrichHoldingsWithNav(summaries);
          setHoldings(enriched);
          return;
        }
        if (error) {
          console.error('加载持仓失败:', error);
        }
      }
    } catch (err) {
      console.error('加载持仓异常:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHoldings();
  }, [loadHoldings]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadHoldings();
  }, [loadHoldings]);

  const removeHolding = useCallback(async (fundCode: string) => {
    await removeHoldingWithTransactions(fundCode);
  }, []);

  return { holdings, lots, loading, removeHolding, refresh };
}

/**
 * 交易记录 Hook
 */
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('transactions').select('*');
        if (!error && data) {
          setTransactions(data.map(mapTransaction));
          return;
        }
        if (error) {
          console.error('加载交易记录失败:', error);
        }
      }
    } catch (err) {
      console.error('加载交易记录异常:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadTransactions();
  }, [loadTransactions]);

  const saveTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    // 复用 navUpdateService 的写入路径，统一支持 source / confirm_date / grid_execution_id / lot_id，
    // 并带 schema cache 回退逻辑。修复 #10：消除两套 insert 实现。
    const { transactionId } = await addTransactionWithHoldingUpdate(transaction);
    return transactionId;
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await removeTransactionWithHoldingUpdate(id);
  }, []);

  return { transactions, loading, saveTransaction, removeTransaction, refresh };
}

/**
 * 批量获取持仓的最新净值，实时计算市值和盈亏
 */
async function enrichHoldingsWithNav(summaries: ReturnType<typeof summarizeHoldings>): Promise<Holding[]> {
  if (summaries.length === 0) return [];

  const fundCodes = [...new Set(summaries.map(s => s.fundCode))];
  const navMap = await batchFetchNav(fundCodes);

  return summaries.map(summary => {
    const navInfo = navMap.get(summary.fundCode);
    if (navInfo) {
      const currentValue = navInfo.nav * summary.shares;
      const profit = currentValue - summary.totalCost;
      const profitRate = summary.totalCost > 0 ? profit / summary.totalCost : 0;
      return {
        id: summary.fundCode,
        fundId: summary.fundCode,
        fundCode: summary.fundCode,
        fundName: summary.fundName || navInfo.name || summary.fundCode,
        shares: summary.shares,
        avgCost: summary.avgCost,
        totalCost: summary.totalCost,
        currentNav: navInfo.nav,
        currentValue,
        profit,
        profitRate,
        createdAt: '',
        updatedAt: '',
      };
    }
    return {
      id: summary.fundCode,
      fundId: summary.fundCode,
      fundCode: summary.fundCode,
      fundName: summary.fundName,
      shares: summary.shares,
      avgCost: summary.avgCost,
      totalCost: summary.totalCost,
      currentNav: undefined, // NAV 不可用，UI 可据此显示提示
      currentValue: undefined, // 不用成本冒充市值，UI 应显示"--"
      profit: undefined,
      profitRate: undefined,
      createdAt: '',
      updatedAt: '',
    };
  });
}

// ============================================
// 策略 Hooks
// ============================================

export function useStrategies() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    try {
      // 从 localStorage 加载自定义策略
      const raw = localStorage.getItem('customStrategies');
      const customStrategies = raw ? JSON.parse(raw) : [];
      setStrategies(Array.isArray(customStrategies) ? customStrategies : []);
    } catch (err) {
      console.error('加载本地策略失败:', err);
      localStorage.removeItem('customStrategies');
      setStrategies([]);
      // 延迟 Toast 避免初始化时渲染问题
      toastTimerRef.current = setTimeout(() => {
        import('antd-mobile').then(({ Toast }) => {
          Toast.show({ content: '本地策略数据已损坏，已自动重置', position: 'bottom' });
        });
      }, 500);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const refresh = useCallback(async () => {
    await loadStrategies();
  }, [loadStrategies]);

  return { strategies, loading, refresh };
}
