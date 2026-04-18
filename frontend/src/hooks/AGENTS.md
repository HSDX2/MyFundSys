# Hooks Directory

**Purpose**: Custom React hooks for data access, synchronization, and local authentication.

## Structure

| File | Purpose | Key Exports |
|------|---------|-------------|
| `useSync.ts` | Data access hooks (transactions → holdings derivation) | `useTransactions`, `useHoldings`, `useLots`, `useRealizedPnL` |
| `useSupabase.ts` | Local authentication state management | `useSupabaseAuth`, `isAuthenticated`, `login`, `logout` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Components                          │
│  (Dashboard, Holdings, Transactions, FundDetail...)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ uses
┌─────────────────────────────────────────────────────────────┐
│                     useSync.ts Hooks                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │useTransactions│  │useHoldings  │  │useLots/useRealizedPnL│  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────┘  │
│         │                │                      │             │
│         └────────────────┴──────────────────────┘             │
│                        │                                     │
│                        ▼ calls                               │
│              ┌───────────────────┐                         │
│              │  navUpdateService │ deriveLots(),           │
│              │  (business logic) │ calculateRealizedPnL()  │
│              └───────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ calls
┌─────────────────────────────────────────────────────────────┐
│                     useSupabase.ts                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Local Authentication (NOT Supabase Auth)             │  │
│  │  - Password stored in localStorage                  │  │
│  │  - No user_id in database                           │  │
│  │  - Single-user mode (RLS ALLOW ALL)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## useSync.ts

### useTransactions

Returns all transactions with automatic refresh capability.

```typescript
const { 
  transactions,      // Transaction[] - all buy/sell transactions
  loading,           // boolean
  error,             // Error | null
  refresh,           // () => Promise<void> - manual refresh
  saveTransaction,   // (tx: Transaction) => Promise<void>
  removeTransaction  // (id: string) => Promise<void>
} = useTransactions();
```

**Usage**:
```typescript
// In Transactions.tsx
const { transactions, loading, refresh } = useTransactions();

useEffect(() => {
  refresh();
}, []);

// Render transaction list
return (
  <List>
    {transactions.map(tx => (
      <List.Item key={tx.id}>
        {tx.fundName} - {tx.type === 'buy' ? '买入' : '卖出'}
      </List.Item>
    ))}
  </List>
);
```

### useHoldings

Returns current holdings derived from transactions.

```typescript
const {
  holdings,        // Holding[] - active lots aggregated by fund
  totalAssets,     // number - total market value
  totalCost,       // number - total cost basis
  floatingPnL,     // number - unrealized P&L
  loading,
  refresh
} = useHoldings();
```

**Holding Structure**:
```typescript
interface Holding {
  fundId: string;          // Fund code
  fundName: string;        // Fund name
  totalShares: number;     // Total remaining shares
  avgCost: number;         // Weighted average cost
  currentNav: number;      // Latest NAV
  marketValue: number;     // totalShares * currentNav
  floatingPnL: number;     // Market value - total cost
  lots: Lot[];             // Individual lots (for drill-down)
}
```

**Usage**:
```typescript
// In Dashboard.tsx
const { holdings, totalAssets, floatingPnL, refresh } = useHoldings();

// Auto-refresh every 30 seconds
useEffect(() => {
  refresh();
  const interval = setInterval(refresh, 30000);
  return () => clearInterval(interval);
}, []);

// Render total assets
return (
  <Card>
    <div>总资产: ¥{totalAssets.toFixed(2)}</div>
    <div>浮动盈亏: ¥{floatingPnL.toFixed(2)}</div>
  </Card>
);
```

### useLots & useRealizedPnL

Access raw lots and realized profit/loss.

```typescript
const { lots, loading } = useLots();
// Returns: Lot[] - all lots including sold ones

const { realizedPnL, totalRealizedPnL } = useRealizedPnL();
// Returns: { realizedPnL: RealizedPnL[], totalRealizedPnL: number }
```

**Realized P&L Structure**:
```typescript
interface RealizedPnL {
  id: string;              // Sell transaction ID
  fundId: string;          // Fund code
  fundName: string;        // Fund name
  sellDate: string;        // Sell date
  sellPrice: number;       // Sell NAV
  shares: number;          // Shares sold
  matchedLots: MatchedLot[]; // Which lots were sold
  profit: number;          // Total profit
  profitPercentage: number; // Profit / total cost
}

interface MatchedLot {
  lotId: string;
  buyDate: string;
  cost: number;
  shares: number;
  profit: number;
}
```

## useSupabase.ts

**IMPORTANT**: This is NOT Supabase Auth. It's a lightweight local authentication wrapper.

### Architecture

```
┌─────────────────────────────────────────────┐
│           useSupabase.ts                    │
├─────────────────────────────────────────────┤
│  localStorage:                              │
│    - myfundsys_password (SHA-256 hashed)    │
│    - myfundsys_authenticated (boolean)      │
├─────────────────────────────────────────────┤
│  Functions:                                 │
│    - login(password): bool                  │
│    - logout(): void                         │
│    - isAuthenticated(): bool                │
└─────────────────────────────────────────────┘
                    │
                    ▼ uses
┌─────────────────────────────────────────────┐
│           Supabase Client                   │
│  (anon key only - no user authentication)   │
│  - RLS policy: ALLOW ALL                    │
│  - No user_id fields in tables              │
└─────────────────────────────────────────────┘
```

### Usage

```typescript
// In Layout.tsx
const { isAuthenticated, login, logout } = useSupabaseAuth();

if (!isAuthenticated) {
  return <AuthPage onLogin={login} />;
}

return (
  <div>
    <Button onClick={logout}>退出登录</Button>
    {/* Main app content */}
  </div>
);
```

```typescript
// In AuthPage.tsx
const handleLogin = async (password: string) => {
  const success = await login(password);
  if (success) {
    Toast.show({ icon: 'success', content: '登录成功' });
  } else {
    Toast.show({ icon: 'fail', content: '密码错误' });
  }
};
```

### Security Notes

1. **Password Storage**: SHA-256 hashed, not encrypted (sufficient for local-only use)
2. **No Brute Force Protection**: Simple delay added in AuthPage.tsx (`await new Promise(r => setTimeout(r, 500))`)
3. **No Session Expiry**: Authentication persists until explicit logout
4. **Single User**: No multi-user support, no user_id in database
5. **RLS Policy**: `ALLOW ALL` - anon key gives full access (acceptable for single-user local app)

## Conventions

1. **Hook Naming**: `use` prefix + descriptive noun (`useSync`, `useTransactions`)
2. **Return Structure**: Object with `{ data, loading, error, refresh }` pattern
3. **Async Operations**: Always track `loading` state, handle errors with `Toast`
4. **Caching**: Limited - mostly real-time data from Supabase
5. **Refresh Pattern**: Expose `refresh()` function for manual refresh, auto-refresh on interval
6. **Type Safety**: Full TypeScript interfaces for all data structures
7. **Chinese Comments**: Business logic explained in Chinese for clarity

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add transaction | `useSync.ts` `saveTransaction()` | Validates and inserts to Supabase |
| Refresh holdings | `useSync.ts` `useHoldings()` | Calls `deriveLots()` from navUpdateService |
| Check auth status | `useSupabase.ts` `isAuthenticated()` | Checks localStorage |
| Login/logout | `useSupabase.ts` `login()` / `logout()` | Updates localStorage |
| Realized P&L | `useSync.ts` `useRealizedPnL()` | Gets sold lots with profit calculations |

## Notes

- **No Redux/Zustand/React Query** - all state management via custom hooks
- **No React Context** - data passed via hook return values
- **Supabase real-time not used** - manual refresh pattern instead
- **Authentication is local-only** - no server-side session management
- **All data operations async** - consistent loading/error state pattern
- **Business logic delegated to services** - hooks are thin wrappers around services
