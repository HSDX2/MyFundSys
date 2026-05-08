# Services Directory

**Purpose**: Core business logic services for fund data API, lot derivation, NAV updates, and investment calculations.

## Structure

| File | Purpose | Key Exports |
|------|---------|-------------|
| `fundApi.ts` | Fund data API via Supabase Edge Functions | `fetchFundNav`, `searchFunds`, `fetchFundHistory`, `batchFetchNav` |
| `navUpdateService.ts` | Lot derivation, sell matching, P&L calculation | `deriveLots`, `deriveRealizedLots`, `matchSellLots`, `summarizeHoldings`, `processPendingTransactions` |
| `articleService.ts` | Investment strategy articles (static content) | `loadLocalArticles` |

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
- See `CLAUDE.md` for full architecture: lot derivation, sell matching, P&L, API call chain
