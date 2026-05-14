import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { useGridDetail } from '../hooks/useGrid';
import { GridTypeLabels, GRID_TYPES } from '../types';

export default function GridDetailScreen({ route }: any) {
  const { fundCode = '' } = route.params ?? {};
  const { strategy, levelsByType, currentNav, loading, error, baseShares, shouldLiquidate, executeGridLevel, sellGridLevel, liquidateGridFund } = useGridDetail(fundCode);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!strategy || !currentNav) return <Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>{error || '未找到策略'}</Text>;

  return (
    <ScrollView style={styles.container}>
      <Card style={{ margin: 16 }}>
        <Card.Content>
          <Text variant="titleLarge">{strategy.fund_name}</Text>
          <Text style={{ color: '#999' }}>{strategy.fund_code}</Text>
          <Text variant="headlineMedium" style={{ color: '#1677ff', marginTop: 8 }}>{currentNav.toFixed(4)}</Text>
          {baseShares > 0 && <Chip icon="lock" style={{ marginTop: 8 }}>底仓 {baseShares.toFixed(2)}份</Chip>}
          {shouldLiquidate && <Button mode="contained" color="error" onPress={liquidateGridFund} style={{ marginTop: 12 }}>清仓（超出网格范围）</Button>}
        </Card.Content>
      </Card>

      {GRID_TYPES.map(gridType => {
        const levels = levelsByType[gridType];
        if (!levels?.length) return null;
        return (
          <Card key={gridType} style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <Card.Content>
              <Text variant="titleSmall" style={{ marginBottom: 8 }}>{GridTypeLabels[gridType]}</Text>
              {levels.map(level => (
                <View key={level.level} style={styles.levelRow}>
                  <Text style={[styles.levelText, level.status === 'triggered' && { color: '#ff6b35', fontWeight: 600 }]}>
                    第{level.level}格 {level.trigger_price.toFixed(4)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {level.status === 'triggered' && <Button mode="contained" compact onPress={() => executeGridLevel(gridType, level.level)}>买入</Button>}
                    {level.status === 'sell_triggered' && !shouldLiquidate && <Button mode="contained" compact color="error" onPress={() => sellGridLevel(gridType, level.level)}>卖出</Button>}
                    {level.status === 'executed' && !level.sellExecution && <Chip>持有中</Chip>}
                    {level.sellExecution && <Chip>已完成</Chip>}
                    {level.status === 'above' && <Chip>等待</Chip>}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  levelText: { fontSize: 13 },
});
