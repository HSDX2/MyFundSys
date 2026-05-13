import React, { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, Searchbar, SegmentedButtons, Dialog, Portal, TextInput, IconButton, useTheme } from 'react-native-paper';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { deriveLots, deriveRealizedLots } from '../services/navUpdateService';
import { batchFetchNav, fetchFundNav } from '../services/fundApi';
import { formatMoney, formatPercent } from '../utils';

export default function HoldingsScreen() {
  const { holdings, lots, loading, refresh } = useHoldings();
  const { transactions, saveTransaction, refresh: refreshTransactions } = useTransactions();
  const [tab, setTab] = useState('lots');
  const [sellLot, setSellLot] = useState<any>(null);
  const [sellShares, setSellShares] = useState('');

  const realizedPnL = useMemo(() => deriveRealizedLots(transactions).reduce((s, l) => s + l.profit, 0), [transactions]);
  const realizedLots = useMemo(() => deriveRealizedLots(transactions), [transactions]);
  const holdValue = holdings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
  const holdCost = holdings.reduce((s, h) => s + h.totalCost, 0);
  const pendingAmt = transactions.filter(t => t.status === 'pending' && t.type === 'buy').reduce((s, t) => s + t.amount, 0);

  const handleSell = async () => {
    if (!sellLot) return;
    const shares = parseFloat(sellShares);
    if (isNaN(shares) || shares <= 0) return;
    try {
      const nav = sellLot.nav || (await fetchFundNav(sellLot.fundCode))?.nav || sellLot.cost;
      await saveTransaction({
        fundId: sellLot.fundCode, fundCode: sellLot.fundCode, fundName: sellLot.fundName,
        type: 'sell', date: new Date().toISOString().split('T')[0],
        amount: shares * nav, price: nav, shares, fee: 0, status: 'completed',
      });
      setSellLot(null); setSellShares(''); await refresh(); await refreshTransactions();
    } catch (e) { console.error(e); }
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>持仓管理</Text>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
        <Card style={{ flex: 1, padding: 12, backgroundColor: '#fffbe6' }}>
          <Text variant="titleMedium" style={{ color: '#faad14' }}>{formatMoney(holdValue + pendingAmt)}</Text>
          <Text variant="bodySmall">总资产</Text>
        </Card>
        <Card style={{ flex: 1, padding: 12, backgroundColor: '#f6ffed' }}>
          <Text variant="titleMedium" style={{ color: (holdValue - holdCost + realizedPnL) >= 0 ? '#ff4d4f' : '#52c41a' }}>{(holdValue - holdCost + realizedPnL) >= 0 ? '+' : ''}{formatMoney(holdValue - holdCost + realizedPnL)}</Text>
          <Text variant="bodySmall">累计盈亏</Text>
        </Card>
      </View>

      <SegmentedButtons value={tab} onValueChange={setTab} buttons={[{ value: 'lots', label: '持仓明细' }, { value: 'realized', label: '落袋为安' }]} style={{ paddingHorizontal: 16, marginBottom: 12 }} />

      {tab === 'lots' && (
        <Card style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Card.Content>
            {lots.length === 0 ? <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无持仓</Text> : (
              lots.map((lot, i) => (
                <View key={`${lot.fundCode}-${i}`} style={styles.lotRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: 600 }}>{lot.fundName || lot.fundCode}</Text>
                    <Text variant="bodySmall" style={{ color: '#999' }}>{lot.fundCode} | {lot.date}</Text>
                    {lot.isPending && <Text variant="bodySmall" style={{ color: '#faad14' }}>在途买入 {formatMoney(lot.amount ?? 0)}</Text>}
                    {!lot.isPending && <Text variant="bodySmall" style={{ color: '#666' }}>份额: {lot.remainingShares.toFixed(2)} | 成本: {lot.cost.toFixed(4)}</Text>}
                  </View>
                  {!lot.isPending && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="bodyMedium">{formatMoney(lot.cost * lot.remainingShares)}</Text>
                      <IconButton icon="currency-usd" size={20} onPress={() => setSellLot(lot)} />
                    </View>
                  )}
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      )}

      {tab === 'realized' && (
        <Card style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: 8, color: realizedPnL >= 0 ? '#ff4d4f' : '#52c41a' }}>落袋为安: {realizedPnL >= 0 ? '+' : ''}{formatMoney(realizedPnL)}</Text>
            {realizedLots.length === 0 ? <Text style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无记录</Text> : (
              realizedLots.map((lot, i) => (
                <View key={i} style={styles.lotRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: 600 }}>{lot.fundName || lot.fundCode}</Text>
                    <Text variant="bodySmall" style={{ color: '#999' }}>{lot.buyDate} → {lot.sellDate} | {lot.holdingDays}天</Text>
                  </View>
                  <Text variant="bodyMedium" style={{ color: lot.profit >= 0 ? '#ff4d4f' : '#52c41a' }}>{lot.profit >= 0 ? '+' : ''}{formatMoney(lot.profit)}</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      )}

      <Portal>
        <Dialog visible={!!sellLot} onDismiss={() => setSellLot(null)}>
          <Dialog.Title>卖出</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{sellLot?.fundName}</Text>
            <Text variant="bodySmall">可用: {sellLot?.remainingShares.toFixed(2)} 份</Text>
            <TextInput label="份额" value={sellShares} onChangeText={setSellShares} mode="outlined" keyboardType="decimal-pad" style={{ marginTop: 8 }} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSellLot(null)}>取消</Button>
            <Button onPress={handleSell}>确认卖出</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { padding: 16, paddingBottom: 8 },
  lotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
});
