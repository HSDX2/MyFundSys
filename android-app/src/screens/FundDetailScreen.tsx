import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, Chip, ActivityIndicator, IconButton } from 'react-native-paper';
import { fetchFundNav } from '../services/fundApi';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatMoney } from '../utils';

export default function FundDetailScreen({ route }: any) {
  const { fundCode = '' } = route.params ?? {};
  const [fundData, setFundData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchFundNav(fundCode).then(d => { setFundData(d); setLoading(false); }).catch(() => setLoading(false));
    if (isSupabaseConfigured()) supabase.from('favorite_funds').select('*').eq('fund_code', fundCode).maybeSingle().then(({ data }) => setIsFavorite(!!data)).catch(() => {});
  }, [fundCode]);

  const toggleFav = async () => {
    if (isFavorite) { await supabase.from('favorite_funds').delete().eq('fund_code', fundCode); setIsFavorite(false); }
    else { await supabase.from('favorite_funds').insert({ fund_code: fundCode, fund_name: fundData?.name || fundCode } as any); setIsFavorite(true); }
  };

  return (
    <ScrollView style={styles.container}>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : fundData ? (
        <>
          <Card style={{ margin: 16, backgroundColor: fundData.dailyChangeRate >= 0 ? '#ff4d4f' : '#52c41a' }}>
            <Card.Content style={{ alignItems: 'center', padding: 20 }}>
              <Text variant="headlineLarge" style={{ color: '#fff', fontWeight: 'bold' }}>{fundData.dailyChangeRate >= 0 ? '+' : ''}{fundData.dailyChangeRate.toFixed(2)}%</Text>
              <Text variant="bodyMedium" style={{ color: '#fff', opacity: 0.9 }}>{fundData.dailyChange >= 0 ? '+' : ''}{fundData.dailyChange.toFixed(4)}</Text>
            </Card.Content>
          </Card>

          <Card style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="titleMedium">{fundData.name}</Text>
                <IconButton icon={isFavorite ? 'star' : 'star-outline'} onPress={toggleFav} iconColor={isFavorite ? '#faad14' : '#d9d9d9'} />
              </View>
              <Text variant="bodySmall" style={{ color: '#999' }}>{fundCode}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <Text variant="bodySmall">净值: {fundData.nav.toFixed(4)}</Text>
                <Text variant="bodySmall">日期: {fundData.navDate}</Text>
              </View>
            </Card.Content>
          </Card>
        </>
      ) : <Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>基金不存在</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
});
