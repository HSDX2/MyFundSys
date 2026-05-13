import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PASSWORD = 'myfundsys123';

export default function AuthScreen({ onAuthSuccess }: { onAuthSuccess?: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { colors } = useTheme();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 300));
    if (password === PASSWORD) {
      await AsyncStorage.setItem('myfundsys_auth', 'true');
      await AsyncStorage.setItem('myfundsys_auth_time', Date.now().toString());
    } else {
      setError('密码错误');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="lock" size={60} color={colors.primary} style={{ marginBottom: 20 }} />
      <Text variant="headlineMedium" style={{ marginBottom: 8 }}>MyFundSys</Text>
      <Text variant="bodyMedium" style={{ color: '#666', marginBottom: 32 }}>智能基金投资管理系统</Text>
      <TextInput label="访问密码" value={password} onChangeText={setPassword} secureTextEntry mode="outlined" style={{ width: '80%', marginBottom: 12 }} onSubmitEditing={handleLogin} />
      {error ? <Text style={{ color: '#ff4d4f', marginBottom: 8 }}>{error}</Text> : null}
      <Button mode="contained" onPress={handleLogin} loading={loading} style={{ width: '80%' }}>进入系统</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
});
