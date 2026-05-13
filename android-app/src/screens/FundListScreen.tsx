import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, FlatList } from 'react-native';
import { Card, Text, Searchbar, ActivityIndicator, Chip } from 'react-native-paper';
import { searchByCode, searchByName } from '../services/fundApi';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import type { FundSearchResult } from '../types';

export default function FundListScreen() {
  const [codeText, setCodeText] = useState('');
  const [nameText, setNameText] = useState('');
  const [codeResults, setCodeResults] = useState<FundSearchResult[]>([]);
  const [nameResults, setNameResults] = useState<FundSearchResult[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (codeText.length >= 4) searchByCode(codeText).then(setCodeResults).catch(() => {});
    else setCodeResults([]);
  }, [codeText]);

  useEffect(() => {
    if (nameText.length >= 2) searchByName(nameText).then(setNameResults).catch(() => {});
    else setNameResults([]);
  }, [nameText]);

  useEffect(() => {
    if (isSupabaseConfigured()) supabase.from('favorite_funds').select('*').then(({ data }) => setFavorites(data || []));
  }, []);

  const renderFund = (fund: FundSearchResult) => (
    <Card key={fund.code} style={{ marginBottom: 8 }} onPress={() => navigation.navigate('FundDetail', { fundCode: fund.code })}>
      <Card.Content>
        <Text variant="bodyMedium" style={{ fontWeight: 600 }}>{fund.name}</Text>
        <Text variant="bodySmall" style={{ color: '#999' }}>{fund.code}</Text>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>基金搜索</Text>

      <Searchbar placeholder="按代码搜索(如: 000001)" value={codeText} onChangeText={setCodeText} style={{ marginHorizontal: 16, marginBottom: 8 }} />
      {codeResults.map(renderFund)}

      <Searchbar placeholder="按名称搜索" value={nameText} onChangeText={setNameText} style={{ marginHorizontal: 16, marginBottom: 8 }} />
      {nameResults.map(renderFund)}

      {favorites.length > 0 && (
        <>
          <Text variant="titleSmall" style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>已收藏基金</Text>
          {favorites.map((f: any) => (
            <Card key={f.id} style={{ marginHorizontal: 16, marginBottom: 8 }} onPress={() => navigation.navigate('FundDetail', { fundCode: f.fund_code })}>
              <Card.Content>
                <Text variant="bodyMedium" style={{ fontWeight: 600 }}>{f.fund_name}</Text>
                <Text variant="bodySmall" style={{ color: '#999' }}>{f.fund_code}</Text>
              </Card.Content>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { padding: 16, paddingBottom: 8 },
});
