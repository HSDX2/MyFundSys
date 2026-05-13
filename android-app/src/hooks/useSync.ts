import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { removeTransactionWithHoldingUpdate, removeHoldingWithTransactions, deriveLots, summarizeHoldings } from '../services/navUpdateService';
import { batchFetchNav, fetchFundNav } from '../services/fundApi';
import type { Holding, Transaction } from '../types';
import type { Lot } from '../services/navUpdateService';
import type { Database } from '../types/database';

type TransactionsInsert = Database['public']['Tables']['transactions']['Insert'];

function mapTransaction(t: any): Transaction {
  return {
    id: t.id, fundId: t.fund_code, fundCode: t.fund_code, fundName: t.fund_name,
    type: t.type, date: t.date, confirmDate: t.confirm_date || t.date,
    amount: t.amount, price: t.nav, shares: t.shares, fee: t.fee,
    status: t.status, source: t.source || 'manual',
    gridExecutionId: t.grid_execution_id, createdAt: t.created_at,
  };
}

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
          const derivedLots = deriveLots(transactions);
          setLots(derivedLots);
          const summaries = summarizeHoldings(derivedLots);
          const navMap = await batchFetchNav([...new Set(summaries.map(s => s.fundCode))]);
          const enriched = summaries.map(summary => {
            const navInfo = navMap.get(summary.fundCode);
            if (navInfo) {
              const currentValue = navInfo.nav * summary.shares;
              const profit = currentValue - summary.totalCost;
              return { id: summary.fundCode, fundId: summary.fundCode, fundCode: summary.fundCode, fundName: summary.fundName || navInfo.name, shares: summary.shares, avgCost: summary.avgCost, totalCost: summary.totalCost, currentNav: navInfo.nav, currentValue, profit, profitRate: summary.totalCost > 0 ? profit / summary.totalCost : 0, createdAt: '', updatedAt: '' };
            }
            return { id: summary.fundCode, fundId: summary.fundCode, fundCode: summary.fundCode, fundName: summary.fundName, shares: summary.shares, avgCost: summary.avgCost, totalCost: summary.totalCost, currentNav: undefined, currentValue: undefined, profit: undefined, profitRate: undefined, createdAt: '', updatedAt: '' };
          });
          setHoldings(enriched);
          return;
        }
        if (error) console.error('load holdings failed:', error);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHoldings(); }, [loadHoldings]);

  const removeHolding = useCallback(async (fundCode: string) => {
    await removeHoldingWithTransactions(fundCode);
  }, []);

  return { holdings, lots, loading, removeHolding, refresh: loadHoldings };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('transactions').select('*');
        if (!error && data) { setTransactions(data.map(mapTransaction)); return; }
        if (error) console.error('load transactions failed:', error);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const saveTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const payload: TransactionsInsert = {
      fund_code: transaction.fundCode, fund_name: transaction.fundName,
      type: transaction.type, shares: transaction.shares, nav: transaction.price,
      amount: transaction.amount, fee: transaction.fee || 0, date: transaction.date,
      status: transaction.status || 'completed', source: transaction.source || 'manual',
    };
    const { data, error } = await supabase.from('transactions').insert(payload as any).select();
    if (error) throw new Error(`Save failed: ${error.message}`);
    return (data as any)?.[0]?.id;
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await removeTransactionWithHoldingUpdate(id);
  }, []);

  return { transactions, loading, saveTransaction, removeTransaction, refresh: loadTransactions };
}
