import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGetItem = jest.fn();
const mockMultiRemove = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: any[]) => mockGetItem(...args),
  multiRemove: (...args: any[]) => mockMultiRemove(...args),
}));

import { useAuthStatus, signOut } from '../../hooks/useSupabase';
import { renderHook, act } from '@testing-library/react-native';

describe('useAuthStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading is true initially, then false after check', async () => {
    mockGetItem.mockResolvedValue(null);
    const { result } = renderHook(() => useAuthStatus());
    expect(result.current.loading).toBe(true);
    // Wait for effect
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns authenticated=true when auth token exists and not expired', async () => {
    const recent = (Date.now() - 1000).toString(); // 1 second ago
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'myfundsys_auth') return Promise.resolve('true');
      if (key === 'myfundsys_auth_time') return Promise.resolve(recent);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => useAuthStatus());
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('returns authenticated=false when token expired (30 days)', async () => {
    const old = (Date.now() - 31 * 24 * 60 * 60 * 1000).toString();
    mockGetItem.mockImplementation((key: string) => {
      if (key === 'myfundsys_auth') return Promise.resolve('true');
      if (key === 'myfundsys_auth_time') return Promise.resolve(old);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => useAuthStatus());
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('signOut', () => {
  it('removes auth keys from storage', () => {
    signOut();
    expect(mockMultiRemove).toHaveBeenCalledWith(['myfundsys_auth', 'myfundsys_auth_time']);
  });
});
