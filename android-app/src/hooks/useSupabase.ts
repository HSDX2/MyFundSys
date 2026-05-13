import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useAuthStatus() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const auth = await AsyncStorage.getItem('myfundsys_auth');
      const authTime = await AsyncStorage.getItem('myfundsys_auth_time');
      if (auth === 'true' && authTime) {
        const elapsed = Date.now() - parseInt(authTime);
        if (elapsed < 30 * 24 * 60 * 60 * 1000) {
          setIsAuthenticated(true);
        } else {
          await AsyncStorage.multiRemove(['myfundsys_auth', 'myfundsys_auth_time']);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  return { isAuthenticated, loading };
}

export function signOut() {
  AsyncStorage.multiRemove(['myfundsys_auth', 'myfundsys_auth_time']);
}
