# Hooks Directory

**Purpose**: Custom React hooks for data access, synchronization, and local authentication.

## Structure

| File | Purpose | Key Exports |
|------|---------|-------------|
| `useSync.ts` | Data access hooks (transactions → holdings derivation) | `useTransactions`, `useHoldings`, `useLots`, `useRealizedPnL` |
| `useSupabase.ts` | Local authentication state management | `useSupabaseAuth`, `isAuthenticated`, `login`, `logout` |

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
- See `CLAUDE.md` for full architecture: lot derivation, auth flow, data flow
