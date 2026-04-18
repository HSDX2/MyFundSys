# Pages Directory

**Purpose**: React page components for mobile fund management app.

## Structure

| File | Purpose | Key Exports |
|------|---------|-------------|
| `Layout.tsx` | Main layout with TabBar navigation | `Layout` |
| `AuthPage.tsx` | Password login (localStorage-based) | `AuthPage` |
| `Dashboard.tsx` | Home page with market valuation + holdings summary | `Dashboard` |
| `Holdings.tsx` | Batch-based holdings management with sell actions | `Holdings` |
| `Transactions.tsx` | Transaction history with pending/completed filter | `Transactions` |
| `FundList.tsx` | Fund search + favorites management | `FundList` |
| `FundDetail.tsx` | Fund details with historical NAV chart | `FundDetail` |
| `Strategy.tsx` | Investment strategy + backtesting | `Strategy` |
| `Reports.tsx` | Performance reports + statistical analysis | `Reports` |
| `Articles.tsx` | Investment articles aggregation | `Articles` |
| `AIPosts.tsx` | AI-generated investment insights | `AIPosts` |
| `Settings.tsx` | App settings + data export/import | `Settings` |

## Routing Pattern

**NO React Router** - uses hash-based routing via `Layout.tsx`:

```typescript
// TabBar switches between main views
<TabBar activeKey={activeTab} onChange={setActiveTab}>
  <TabBar.Item key="dashboard" icon={<HomeOutline />} title="首页" />
  ...
</TabBar>

// Deep links use hash routing
useEffect(() => {
  const hash = window.location.hash;
  if (hash.startsWith('#fund/')) {
    const fundCode = hash.split('/')[1];
    setView('fundDetail');
    setSelectedFund(fundCode);
  }
}, []);
```

## Authentication Flow

1. `Layout.tsx` checks `isAuthenticated` from `useSupabase.ts`
2. If not authenticated, renders `AuthPage.tsx`
3. `AuthPage` validates password against `VITE_APP_PASSWORD` env var
4. Stores auth state in localStorage (NOT Supabase Auth)
5. All subsequent data access uses Supabase anon key (public)

## Key Patterns

### Page Component Structure
```typescript
import React, { useState, useEffect } from 'react';
import { NavBar, List, Button } from 'antd-mobile';
import { useSync } from '../hooks/useSync';

// 1. Props interface (if any)
interface Props {
  fundCode?: string;
}

// 2. Component definition
const PageName: React.FC<Props> = ({ fundCode }) => {
  // 3. State hooks
  const [loading, setLoading] = useState(false);
  
  // 4. Custom hooks for data
  const { holdings, refresh } = useSync();
  
  // 5. Effects
  useEffect(() => {
    refresh();
  }, []);
  
  // 6. Render
  return (
    <div>
      <NavBar back={null}>Page Title</NavBar>
      {/* Content */}
    </div>
  );
};

export default PageName;
```

### Mobile-First Styling
- Uses `antd-mobile` components exclusively (no antd desktop)
- Inline styles with style objects (no CSS modules)
- Bottom TabBar for primary navigation
- Pull-to-refresh patterns for lists
- Swipe actions for list items (Holdings.tsx)

### Data Fetching Pattern
```typescript
// 1. Load initial data on mount
useEffect(() => {
  loadData();
}, []);

// 2. Refresh function for pull-to-refresh
const handleRefresh = async () => {
  setRefreshing(true);
  await refresh(); // from useSync hook
  setRefreshing(false);
};

// 3. Periodic refresh for live data
useEffect(() => {
  const interval = setInterval(() => {
    refresh();
  }, 30000); // Every 30 seconds
  return () => clearInterval(interval);
}, []);
```

## Conventions

1. **File Naming**: PascalCase for components (`FundDetail.tsx`)
2. **Export**: Default export at bottom of file
3. **Imports Order**: React → third-party → hooks → services → types → utils
4. **Type-only imports**: `import type { Transaction } from '../types'`
5. **Props**: Define interface above component, use destructuring
6. **State**: useState hooks at top of component, group related state
7. **Effects**: useEffect for data fetching and side effects, cleanup in return
8. **Error handling**: Toast notifications for user-facing errors
9. **Loading states**: Loading indicators during async operations
10. **Mobile UX**: Bottom sheets, swipe actions, pull-to-refresh

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Add new page | Create file here → Add to Layout.tsx TabBar | Follow existing page structure |
| Modify routing | Layout.tsx | Update hash routing or TabBar items |
| Change auth flow | AuthPage.tsx + useSupabase.ts | Local password validation |
| Add page-specific data | Page component + useSync.ts | Use existing hooks |
| Mobile UI patterns | Holdings.tsx, Transactions.tsx | Reference swipe actions, pull-to-refresh |

## Notes

- All pages share the same `Layout.tsx` wrapper with TabBar
- Hash routing (`#fund/CODE`) used only for fund detail deep links
- No nested routes - all pages are top-level tabs
- Authentication is localStorage-based, not Supabase Auth
- All Supabase calls go through hooks in `../hooks/` directory
