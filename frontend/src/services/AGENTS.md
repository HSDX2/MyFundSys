# Services Directory

**Purpose**: Core business logic services for fund data API, lot derivation, NAV updates, and investment calculations.

## Structure

| File | Purpose | Key Exports |
|------|---------|-------------|
| `fundApi.ts` | Fund data API via Supabase Edge Functions | `searchFunds`, `getFundNav`, `getFundHistory` |
| `navUpdateService.ts` | Lot derivation, sell matching, P&L calculation | `deriveLots`, `calculateRealizedPnL`, `processPendingTransactions` |
| `articleService.ts` | Investment strategy articles (static content) | `getArticles` |
| `notificationService.ts` | Browser notification utilities | `requestNotificationPermission` |

## Key Concepts

### 1. Lot-Based Accounting

All holdings are derived from transaction history using lot-based accounting:

```typescript
interface Lot {
  id: string;              // Unique lot ID
  fundId: string;          // Fund code
  buyDate: string;         // Purchase date
  cost: number;            // Cost basis per share
  initialShares: number;   // Original shares
  remainingShares: number; // Current remaining shares
  status: 'holding' | 'sold';
}
```

**Lot Derivation Logic** (in `navUpdateService.ts`):

1. Sort all buy transactions by date
2. Create a lot for each buy transaction
3. When sell occurs, match against lots with **lowest cost first** (FIFO-like)
4. Deduct from lots until sell quantity satisfied
5. Lots with `remainingShares < 0.01` considered sold

```typescript
// From navUpdateService.ts
def deriveLots(transactions: Transaction[]): Lot[] {
  const buys = transactions.filter(t => t.type === 'buy');
  const sells = transactions.filter(t => t.type === 'sell');
  
  const lots: Lot[] = buys.map(buy => ({
    id: `lot_${buy.id}`,
    fundId: buy.fundCode,
    buyDate: buy.date,
    cost: buy.price,
    initialShares: buy.shares,
    remainingShares: buy.shares,
    status: 'holding'
  }));
  
  // Match sells against lots (lowest cost first)
  sells.forEach(sell => {
    let remainingToSell = sell.shares;
    const fundLots = lots
      .filter(l => l.fundId === sell.fundCode && l.status === 'holding')
      .sort((a, b) => a.cost - b.cost); // Lowest cost first
    
    for (const lot of fundLots) {
      if (remainingToSell <= 0) break;
      const deductShares = Math.min(lot.remainingShares, remainingToSell);
      lot.remainingShares -= deductShares;
      remainingToSell -= deductShares;
      if (lot.remainingShares < 0.01) {
        lot.status = 'sold';
      }
    }
  });
  
  return lots;
}
```

### 2. Realized vs Floating P&L

**Floating P&L** (Unrealized): Current value vs cost for active holdings
```typescript
const floatingPnL = lots
  .filter(l => l.status === 'holding')
  .reduce((sum, lot) => {
    const currentValue = lot.remainingShares * currentNav;
    const cost = lot.remainingShares * lot.cost;
    return sum + (currentValue - cost);
  }, 0);
```

**Realized P&L** (Realized): Profit from sold lots
```typescript
const calculateRealizedPnL = (sellTransaction: Transaction, matchedLots: Lot[]): number => {
  return matchedLots.reduce((sum, lot) => {
    const sellPrice = sellTransaction.price;
    const costBasis = lot.cost;
    const shares = Math.min(lot.remainingShares, sellTransaction.shares);
    return sum + (sellPrice - costBasis) * shares;
  }, 0);
};
```

### 3. Pending Transactions (T+1 Settlement)

Transactions can be in `pending` or `completed` status:

```typescript
interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  status: 'pending' | 'completed';
  date: string;           // Trade date
  confirmDate?: string; // Settlement date (T+1)
  price: number;          // NAV price
  shares: number;
  amount: number;
  // ... other fields
}
```

**Pending Handling Logic**:
1. Buy orders created with `status: 'pending'` on trade date
2. Next NAV update marks as `completed` with confirmed NAV
3. Pending buys included in cash position calculation
4. Pending sells don't affect holdings until completed

### 4. Fund Data API (fundApi.ts)

All fund data queries go through Supabase Edge Functions:

```typescript
// Search funds
const { data } = await supabase.functions.invoke('fund-search', {
  body: { keyword: '沪深300' }
});

// Get latest NAV
const { data } = await supabase.functions.invoke('fund-nav', {
  body: { codes: ['000001', '000002'] }
});

// Get historical NAV
const { data } = await supabase.functions.invoke('fund-history', {
  body: { 
    code: '000001',
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  }
});
```

**Key Constraints**:
- **Always use POST** with body parameters
- **Never use URL query strings** - Edge Functions read from `req.json()`
- **Mobile UA required** in Edge Functions: `EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)`

## Conventions

1. **File Naming**: camelCase for services (`fundApi.ts`, `navUpdateService.ts`)
2. **Function Naming**: camelCase, descriptive action verbs (`deriveLots`, `calculateRealizedPnL`)
3. **Type Naming**: PascalCase, descriptive (`Lot`, `RealizedPnL`)
4. **Comments**: Chinese for business logic explanations, English for code mechanics
5. **Error Handling**: Return `null` or empty arrays on failure, log to console
6. **No Side Effects**: Pure functions where possible, explicit data parameters
7. **Test Coverage**: Business logic in `navUpdateService.ts` has comprehensive unit tests in `__tests__/services/lotDerivation.test.ts`

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add new fund API | `fundApi.ts` | Follow Edge Function invoke pattern |
| Modify lot logic | `navUpdateService.ts` | Update `deriveLots()` or `matchSellToLots()` |
| Add P&L calculation | `navUpdateService.ts` | Extend `calculateRealizedPnL()` |
| Pending transaction logic | `navUpdateService.ts` | `processPendingTransactions()` |
| Investment articles | `articleService.ts` | Static content, no API calls |

## Notes

- **No external API calls from frontend** - all fund data goes through Supabase Edge Functions
- **All holdings derived from transactions** - no direct holdings table writes
- **Lot-based accounting is core** - understand lots before modifying P&L logic
- **Pending transactions use T+1 settlement** - trade date vs confirm date distinction
- **Tests are critical** - lot derivation has 103+ test cases covering edge cases
