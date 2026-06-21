import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreateClient = vi.hoisted(() =>
  vi.fn(() => ({
    functions: { invoke: vi.fn() },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  }))
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('isSupabaseConfigured', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('环境变量都存在时返回 true', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
    const { isSupabaseConfigured } = await import('../../lib/supabase');
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('URL 缺失时返回 false', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const { isSupabaseConfigured } = await import('../../lib/supabase');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('Key 缺失时返回 false', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { isSupabaseConfigured } = await import('../../lib/supabase');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('两者都缺失时返回 false', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { isSupabaseConfigured } = await import('../../lib/supabase');
    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('使用 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 创建客户端', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
    await import('../../lib/supabase');
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    );
  });

  it('空环境变量时用占位值调用 createClient（避免 supabaseUrl is required）', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    await import('../../lib/supabase');
    expect(mockCreateClient).toHaveBeenCalledWith('http://localhost:54321', 'placeholder-anon-key');
  });
});

describe('fetchFundNavFromEdge', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('未配置时抛出错误', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { fetchFundNavFromEdge } = await import('../../lib/supabase');
    await expect(fetchFundNavFromEdge('000001')).rejects.toThrow('Supabase 未配置');
  });

  it('已配置时调用 fund-nav Edge Function', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const invokeMock = vi.fn().mockResolvedValue({ data: { code: '000001', nav: 1.5 } });
    mockCreateClient.mockReturnValue({
      functions: { invoke: invokeMock },
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    });
    const { fetchFundNavFromEdge } = await import('../../lib/supabase');
    const result = await fetchFundNavFromEdge('000001');
    expect(invokeMock).toHaveBeenCalledWith('fund-nav', { body: { code: '000001' } });
    expect(result).toEqual({ code: '000001', nav: 1.5 });
  });

  it('Edge Function 返回 error 时抛出错误', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const invokeMock = vi.fn().mockResolvedValue({ error: new Error('Network error') });
    mockCreateClient.mockReturnValue({
      functions: { invoke: invokeMock },
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    });
    const { fetchFundNavFromEdge } = await import('../../lib/supabase');
    await expect(fetchFundNavFromEdge('000001')).rejects.toThrow('Network error');
  });
});

describe('searchFundsFromEdge', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('未配置时抛出错误', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { searchFundsFromEdge } = await import('../../lib/supabase');
    await expect(searchFundsFromEdge('沪深300')).rejects.toThrow('Supabase 未配置');
  });

  it('已配置时调用 fund-search Edge Function', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const invokeMock = vi.fn().mockResolvedValue({ data: [{ code: '000001', name: '测试基金' }] });
    mockCreateClient.mockReturnValue({
      functions: { invoke: invokeMock },
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    });
    const { searchFundsFromEdge } = await import('../../lib/supabase');
    const result = await searchFundsFromEdge('沪深300');
    expect(invokeMock).toHaveBeenCalledWith('fund-search', { body: { keyword: '沪深300' } });
    expect(result).toEqual([{ code: '000001', name: '测试基金' }]);
  });

  it('Edge Function 返回 error 时抛出错误', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const invokeMock = vi.fn().mockResolvedValue({ error: new Error('Search API error') });
    mockCreateClient.mockReturnValue({
      functions: { invoke: invokeMock },
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    });
    const { searchFundsFromEdge } = await import('../../lib/supabase');
    await expect(searchFundsFromEdge('沪深300')).rejects.toThrow('Search API error');
  });
});

describe('subscribeTransactions', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('创建 transactions 频道订阅', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const subscribeMock = vi.fn();
    const onMock = vi.fn().mockReturnThis();
    const channelMock = vi.fn(() => ({ on: onMock, subscribe: subscribeMock }));
    mockCreateClient.mockReturnValue({
      channel: channelMock,
      functions: { invoke: vi.fn() },
    });
    const { subscribeTransactions } = await import('../../lib/supabase');
    const callback = vi.fn();
    subscribeTransactions(callback);
    expect(channelMock).toHaveBeenCalledWith('transactions_default');
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      callback
    );
    expect(subscribeMock).toHaveBeenCalledOnce();
  });
});

describe('subscribeHoldings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('创建 holdings 频道订阅', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'eyJ.test');
    const subscribeMock = vi.fn();
    const onMock = vi.fn().mockReturnThis();
    const channelMock = vi.fn(() => ({ on: onMock, subscribe: subscribeMock }));
    mockCreateClient.mockReturnValue({
      channel: channelMock,
      functions: { invoke: vi.fn() },
    });
    const { subscribeHoldings } = await import('../../lib/supabase');
    const callback = vi.fn();
    subscribeHoldings(callback);
    expect(channelMock).toHaveBeenCalledWith('holdings_default');
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'holdings' },
      callback
    );
    expect(subscribeMock).toHaveBeenCalledOnce();
  });
});
