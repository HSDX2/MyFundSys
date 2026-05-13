import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, Button, List } from 'react-native-paper';
import { exportDatabase, resetDatabase } from '../db';
import { signOut } from '../hooks/useSupabase';

export default function SettingsScreen() {
  const handleExport = async () => {
    try {
      await exportDatabase();
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    signOut();
  };

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>设置</Text>

      <Card style={{ marginHorizontal: 16, marginBottom: 16 }}>
        <Card.Content>
          <List.Item title="导出 JSON 备份" description="完整数据备份" onPress={handleExport} />
          <List.Item title="重置数据" description="清空所有数据" onPress={resetDatabase} />
          <List.Item title="退出登录" onPress={handleLogout} />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { padding: 16, paddingBottom: 8 },
});
