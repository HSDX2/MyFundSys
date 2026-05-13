import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, useTheme, ActivityIndicator, Chip } from 'react-native-paper';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { fetchMarketValuation } from '../services/fundApi';
import { processPendingTransactions, deriveRealizedLots } from '../services/navUpdateService';
import { fetchUnresolvedAlertCount } from '../services/alertService';
import { formatMoney, getValuationStatus } from '../utils';
import { useNavigation } from '@react-navigation/native';

export default function DashboardScreen() {
  const { holdings, refresh } = useHoldings();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [valuation, setValuation] = useState<any>(null);
  const [alertCount, setAlertCount] = useState(0);
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  useEffect(() => {
    fetchMarketValuation().then(setValuation).catch(() => {});
    processPendingTransactions().then(r => { if (r.processedCount > 0) { refresh(); refreshTransactions(); } });
    fetchUnresolvedAlertCount().then(setAlertCount);
  }, []);

  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const realizedPnL = deriveRealizedLots(transactions).reduce((s, l) => s + l.profit, 0);
  const totalAssets = holdings.reduce((s, h) => s + (h.currentValue ?? h.totalCost), 0);
  const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
  const vs = valuation ? getValuationStatus(valuation.percentile) : null;

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>MyFundSys</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
          {pendingCount > 0 && <Chip icon="clock-outline" onPress={() => navigation.navigate('Transactions')}>在途交易 {pendingCount}笔</Chip>}
          {alertCount > 0 && <Chip icon="alert" onPress={() => navigation.navigate('Transactions')}>告警 {alertCount}条</Chip>}
        </View>
      </ScrollView>

      {valuation && vs && (
        <Card style={[styles.card, { borderLeftColor: vs.color, borderLeftWidth: 4 }]}>
          <Card.Content>
            <Text variant="titleMedium">市场估值: {vs.text}</Text>
            <Text variant="bodySmall">PE: {valuation.pe?.toFixed(2)} | PB: {valuation.pb?.toFixed(2)} | 百分位: {(valuation.percentile * 100).toFixed(1)}%</Text>
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">总资产</Text>
          <Text variant="headlineLarge" style={{ color: '#faad14' }}>{formatMoney(totalAssets)}</Text>
          <Text variant="bodySmall" style={{ color: (totalAssets - totalCost) >= 0 ? '#ff4d4f' : '#52c41a' }}>
            浮动盈亏: {(totalAssets - totalCost) >= 0 ? '+' : ''}{formatMoney(totalAssets - totalCost)}
          </Text>
          <Text variant="bodySmall" style={{ color: (totalAssets - totalCost + realizedPnL) >= 0 ? '#ff4d4f' : '#52c41a' }}>
            累计盈亏: {(totalAssets - totalCost + realizedPnL) >= 0 ? '+' : ''}{formatMoney(totalAssets - totalCost + realizedPnL)}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>持仓概览</Text>
          {holdings.length === 0 ? <Text variant="bodyMedium" style={{ color: '#999' }}>暂无持仓</Text> : (
            holdings.slice(0, 5).map(h => (
              <View key={h.fundCode} style={styles.holdingRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" style={{ fontWeight: 600 }}>{h.fundName || h.fundCode}</Text>
                  <Text variant="bodySmall" style={{ color: '#999' }}>{h.fundCode}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyMedium">{formatMoney(h.currentValue ?? h.totalCost)}</Text>
                  <Text variant="bodySmall" style={{ color: (h.profit ?? 0) >= 0 ? '#ff4d4f' : '#52c41a' }}>
                    {(h.profit ?? 0) >= 0 ? '+' : ''}{formatMoney(h.profit ?? 0)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { padding: 16, paddingBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 12 },
  holdingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
});
