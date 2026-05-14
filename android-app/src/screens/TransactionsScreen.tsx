import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, Searchbar, Chip, Dialog, Portal, TextInput, SegmentedButtons, IconButton, useTheme } from 'react-native-paper';
import { useTransactions, useHoldings } from '../hooks/useSync';
import { addTransactionWithHoldingUpdate, processPendingTransactions, canDeleteTransaction } from '../services/navUpdateService';
import { searchByCode, fetchFundNav, fetchFundHistory } from '../services/fundApi';
import { formatMoney } from '../utils';
import { formatLocalDate } from '../utils/csv';
import type { FundSearchResult } from '../types';

export default function TransactionsScreen() {
  const { transactions, loading, saveTransaction, removeTransaction, refresh } = useTransactions();
  const { refresh: refreshHoldings } = useHoldings();
  const [filterKey, setFilterKey] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [tradeDate, setTradeDate] = useState(formatLocalDate(new Date()));
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterKey === 'pending') return t.status === 'pending';
      if (filterKey === 'buy') return t.type === 'buy' && t.status === 'completed';
      if (filterKey === 'sell') return t.type === 'sell' && t.status === 'completed';
      return true;
    });
  }, [transactions, filterKey]);

  const handleAdd = async () => {
    if (!selectedFund) return;
    setSubmitting(true);
    try {
      const isPending = tradeDate >= formatLocalDate(new Date());
      const price = isPending ? 0 : (parseFloat(amount || '0') / (parseFloat(shares || '1') || 1));
      await addTransactionWithHoldingUpdate({
        fundId: selectedFund.code, fundCode: selectedFund.code, fundName: selectedFund.name,
        type: tradeType, date: tradeDate, amount: parseFloat(amount || '0'), price,
        shares: tradeType === 'buy' ? 0 : parseFloat(shares || '0'), fee: 0,
        status: isPending ? 'pending' : 'completed',
      });
      setShowAdd(false); resetForm(); await refresh(); await refreshHoldings();
    } catch (e: any) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => { setSelectedFund(null); setCodeSearch(''); setSearchResults([]); setAmount(''); setShares(''); setTradeDate(formatLocalDate(new Date())); };

  const handleDelete = (id: string) => {
    const check = canDeleteTransaction(transactions, id);
    if (!check.canDelete) return;
    removeTransaction(id).then(() => { refresh(); refreshHoldings(); });
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>交易记录</Text>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
        <Button mode="contained" onPress={() => { resetForm(); setShowAdd(true); }} style={{ flex: 1 }}>添加交易</Button>
        <Button mode="outlined" onPress={async () => { const r = await processPendingTransactions(); refresh(); refreshHoldings(); }} style={{ flex: 1 }}>刷新在途</Button>
      </View>

      <SegmentedButtons value={filterKey} onValueChange={setFilterKey} buttons={[{ value: 'all', label: '全部' }, { value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }, { value: 'pending', label: '在途' }]} style={{ paddingHorizontal: 16, marginBottom: 12 }} />

      <Card style={{ marginHorizontal: 16 }}>
        <Card.Content>
          {filtered.length === 0 ? <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无记录</Text> : (
            filtered.sort((a, b) => b.date.localeCompare(a.date)).map(t => (
              <View key={t.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: 600 }}>{t.fundName}</Text>
                  <Text variant="bodySmall" style={{ color: '#999' }}>{t.fundCode} | {t.date}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyMedium" style={{ color: t.type === 'buy' ? '#ff4d4f' : '#52c41a' }}>{t.type === 'buy' ? '买入' : '卖出'}</Text>
                  <Text variant="bodySmall">{t.status === 'pending' ? '待确认' : formatMoney(t.amount)}</Text>
                </View>
                <IconButton icon="delete" size={20} onPress={() => handleDelete(t.id)} />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <Portal>
        <Dialog visible={showAdd} onDismiss={() => setShowAdd(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>添加交易</Dialog.Title>
          <Dialog.ScrollArea>
            <View style={{ paddingVertical: 8 }}>
              {!selectedFund ? (
                <>
                  <Searchbar placeholder="输入基金代码" value={codeSearch} onChangeText={async (v) => { setCodeSearch(v); if (v.length >= 4) { const r = await searchByCode(v); setSearchResults(r); } else setSearchResults([]); }} />
                  {searchResults.map(f => (
                    <Chip key={f.code} onPress={() => { setSelectedFund(f); setCodeSearch(''); setSearchResults([]); }} style={{ marginTop: 4 }}>{f.name} ({f.code})</Chip>
                  ))}
                </>
              ) : (
                <Chip onClose={() => setSelectedFund(null)}>{selectedFund.name}</Chip>
              )}
              <SegmentedButtons value={tradeType} onValueChange={(v) => setTradeType(v as 'buy' | 'sell')} buttons={[{ value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }]} style={{ marginVertical: 12 }} />
              <TextInput label="日期" value={tradeDate} onChangeText={setTradeDate} mode="outlined" style={{ marginBottom: 8 }} />
              <TextInput label={tradeType === 'buy' ? '金额(元)' : '份额'} value={tradeType === 'buy' ? amount : shares} onChangeText={tradeType === 'buy' ? setAmount : setShares} mode="outlined" keyboardType="decimal-pad" />
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowAdd(false)}>取消</Button>
            <Button onPress={handleAdd} loading={submitting}>确定</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { padding: 16, paddingBottom: 8 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
});
