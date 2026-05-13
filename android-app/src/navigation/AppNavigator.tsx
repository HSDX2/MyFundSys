import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import DashboardScreen from '../screens/DashboardScreen';
import FundListScreen from '../screens/FundListScreen';
import FundDetailScreen from '../screens/FundDetailScreen';
import HoldingsScreen from '../screens/HoldingsScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import StrategyScreen from '../screens/StrategyScreen';
import GridDetailScreen from '../screens/GridDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import { useAuthStatus } from '../hooks/useSupabase';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  FundDetail: { fundCode: string };
  GridDetail: { fundCode: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Funds: undefined;
  Holdings: undefined;
  Transactions: undefined;
  Strategy: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarStyle: { height: 60, paddingBottom: 6, paddingTop: 4 } }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard" size={24} color={color} />, tabBarLabel: '首页' }} />
      <Tab.Screen name="Funds" component={FundListScreen} options={{ tabBarIcon: ({ color }) => <MaterialCommunityIcons name="format-list-bulleted" size={24} color={color} />, tabBarLabel: '基金' }} />
      <Tab.Screen name="Holdings" component={HoldingsScreen} options={{ tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-box" size={24} color={color} />, tabBarLabel: '持仓' }} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} options={{ tabBarIcon: ({ color }) => <MaterialCommunityIcons name="swap-horizontal-bold" size={24} color={color} />, tabBarLabel: '交易' }} />
      <Tab.Screen name="Strategy" component={StrategyScreen} options={{ tabBarIcon: ({ color }) => <MaterialCommunityIcons name="grid" size={24} color={color} />, tabBarLabel: '策略' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog" size={24} color={color} />, tabBarLabel: '设置' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuthStatus();
  if (loading) return null;
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
        <Stack.Screen name="FundDetail" component={FundDetailScreen} options={{ headerShown: true, title: '基金详情' }} />
        <Stack.Screen name="GridDetail" component={GridDetailScreen} options={{ headerShown: true, title: '网格详情' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
