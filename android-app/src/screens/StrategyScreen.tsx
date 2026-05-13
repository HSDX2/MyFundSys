import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, ActivityIndicator, ProgressBar } from 'react-native-paper';
import { useGridStrategies } from '../hooks/useGrid';
import { useNavigation } from '@react-navigation/native';
import { formatMoney } from '../utils';

export default function StrategyScreen() {
  const { overviews, loading, error, refresh } = useGridStrategies();
  const navigation = useNavigation<any>();

  const totalBudget = overviews.reduce((s, o) => s + o.total_budget, 0);
  const totalDeployed = overviews.reduce((s, o) => s + o.capital_deployed, 0);
  const totalTriggered = overviews.reduce((s, o) => s + o.triggered_pending_count, 0);

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>网格策略</Text>

      {overviews.length > 0 && (
        <Card style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#667eea' }}>
          <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}><Text variant="titleLarge" style={{ color: '#fff' }}>{overviews.length}</Text><Text style={{ color: '#fff', opacity: 0.8 }}>基金数</Text></View>
            <View style={{ alignItems: 'center' }}><Text variant="titleLarge" style={{ color: '#fff' }}>{totalDeployed.toLocaleString()}</Text><Text style={{ color: '#fff', opacity: 0.8 }}>已投入</Text></View>
            <View style={{ alignItems: 'center' }}><Text variant="titleLarge" style={{ color: '#fff' }}>{totalBudget.toLocaleString()}</Text><Text style={{ color: '#fff', opacity: 0.8 }}>总预算</Text></View>
            {totalTriggered > 0 && <View style={{ alignItems: 'center' }}><Text variant="titleLarge" style={{ color: '#ffeb3b' }}>{totalTriggered}</Text><Text style={{ color: '#fff', opacity: 0.8 }}>待执行</Text></View>}
          </Card.Content>
        </Card>
      )}

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : error ? <Text style={{ textAlign: 'center', marginTop: 40, color: '#ff4d4f' }}>{error}</Text> : overviews.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>暂无网格策略</Text>
      ) : (
        overviews.map(o => (
          <Card key={o.strategy.id} style={{ marginHorizontal: 16, marginBottom: 12 }} onPress={() => navigation.navigate('GridDetail', { fundCode: o.strategy.fund_code })}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View><Text variant="bodyLarge" style={{ fontWeight: 600 }}>{o.strategy.fund_name}</Text><Text style={{ fontSize: 12, color: '#999' }}>{o.strategy.fund_code}</Text></View>
                <Text variant="bodyLarge">{o.current_nav?.toFixed(4) ?? '--'}</Text>
              </View>
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#666' }}>已投入 {o.capital_deployed.toLocaleString()} / 总预算 {o.total_budget.toLocaleString()}</Text>
                <ProgressBar progress={o.total_budget > 0 ? o.capital_deployed / o.total_budget : 0} color="#1677ff" style={{ marginTop: 4 }} />
              </View>
              {o.triggered_pending_count > 0 && <Text style={{ color: '#ff6b35', fontSize: 12, marginTop: 4 }}>已触发 {o.triggered_pending_count} 个买入点</Text>}
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { padding: 16, paddingBottom: 8 },
});
