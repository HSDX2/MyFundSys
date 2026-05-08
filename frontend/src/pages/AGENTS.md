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
- See `CLAUDE.md` for full architecture: routing pattern, auth flow, data fetching
