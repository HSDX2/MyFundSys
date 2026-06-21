import { useEffect, useState } from 'react';

// ============================================
// 认证相关 Hooks (简化版 - 本地密码验证)
// ============================================

const AUTH_KEY = 'myfundsys_auth';
const AUTH_TIME_KEY = 'myfundsys_auth_time';
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 天

/**
 * 同步检查认证状态（供 service 层在 mutation 前调用）
 */
export function isAuthenticated(): boolean {
  if (typeof localStorage === 'undefined') return true; // 测试环境无 localStorage，放行
  const auth = localStorage.getItem(AUTH_KEY);
  const authTime = localStorage.getItem(AUTH_TIME_KEY);
  if (auth !== 'true' || !authTime) return false;
  return Date.now() - parseInt(authTime) < SESSION_TTL;
}

// 检查是否已登录
export function useAuthStatus() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsAuth(isAuthenticated());
    setLoading(false);
  }, []);

  return { isAuthenticated: isAuth, loading };
}

// 登出
export function signOut() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_TIME_KEY);
  window.location.href = '/';
}
