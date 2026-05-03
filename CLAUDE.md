# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Principles

以第一性原理！从原始需求和问题本质出发，不从惯例或模板出发。

1. 不要假设我清楚自己想要什么。动机或目标不清晰时，停下来讨论。
2. 目标清晰但路径不是最短的，直接告诉我并建议更好的办法。
3. 遇到问题追根因，不打补丁。每个决策都要能回答"为什么"。
4. 输出说重点，砍掉一切不改变决策的信息。

---

## Project Overview

个人基金投资管理系统，移动端 Web 应用，基于 E大（ETF拯救世界）投资理念。

**技术栈**: React 18 + TypeScript + Vite + Ant Design Mobile + Supabase (PostgreSQL + Edge Functions)

**部署**: GitHub Pages (`npm run deploy`)，生产地址 <https://twmissingu.github.io/MyFundSys/>

**API**: 东方财富 (通过 Supabase Edge Functions 代理，解决 CORS)

---

## Common Commands

All commands run from `frontend/` directory:

```bash
# Development
cd frontend && npm run dev          # http://localhost:5173/

# Testing
npm test                            # Run all tests (Vitest)
npm run test:watch                  # Watch mode
npm run test:watch -- src/__tests__/services/fundApi.test.ts   # Single file watch
npx vitest run src/__tests__/services/syncService.test.ts      # Run single test file once
npx vitest run -t "test name"       # By test name
npm run test:coverage               # Coverage report
npm run test:e2e                    # Playwright E2E tests
npm run test:e2e:ui                 # Playwright E2E with UI

# Build & Deploy
npm run build                       # TypeScript compile + Vite build → dist/
npm run deploy                      # Push to gh-pages branch

# Edge Functions (from repo root)
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav --project-ref xeddgyxugpwmgwmeetme
```

---

## Architecture

### API Call Chain (REQUIRED)

```
Frontend → supabase.functions.invoke(fnName, {body: {...}})
         → Supabase Edge Function (Deno, server-side)
         → EastMoney API (no CORS)
```

- **Always use POST** for `invoke`. Edge Functions must read from `req.json()` body, NOT URL path/query string
- EastMoney API requires mobile UA: `EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)` + `Referer: https://fund.eastmoney.com/`
- **Never** call EastMoney API directly from frontend (CORS blocked)

Edge Function 契约：

| Function | Input | Output |
|----------|-------|--------|
| `fund-nav` | `{ code }` | `{ code, name, nav, navDate, estimateNav?, estimateRate? }` |
| `fund-search` | `{ keyword }` | `Array<{ code, name, type }>` |
| `fund-history` | `{ code, pageSize?, pageIndex?, startDate?, endDate? }` | `Array<{ date, nav, accNav, dailyChangeRate, buyStatus, sellStatus }>` |

### Data Architecture — Lot Derivation (核心业务逻辑)

Supabase 是唯一数据源。持仓从 `transactions` 表派生，不直接读写 `holdings` 表。

```
deriveLots(transactions) → Lot[]
  - 所有 buy 交易 → 批次（含在途 isPending）
  - sell 按成本最低批次匹配（非按时间 FIFO）
  - remainingShares > 0 → 持仓批次
  - remainingShares < 0.01 → realized lot（已实现盈亏）
```

关键函数（`navUpdateService.ts`）：
- `deriveLots()` — 从交易记录派生批次，卖出按成本升序匹配
- `deriveRealizedLots()` — 计算已实现盈亏批次
- `summarizeHoldings()` — 按 fundCode 汇总持仓
- `matchSellLots()` — 卖出时匹配扣减持仓批次
- `processPendingTransactions()` — 在途交易自动确认（使用 `window.__pendingTransactionsProcessing` 防重复调用）

### Data Source

Supabase 是唯一数据源（IndexedDB 已弃用）。所有读写通过 Supabase 客户端或 Edge Functions。

- Use `isSupabaseConfigured()` to gate operations, never hardcode environment checks
- **Never** use `if (isGitHubPages)` workarounds (already removed, do not reintroduce)

### Routing

Hash-based routing（非 react-router routes），Layout.tsx 底部 TabBar 导航 6 个 tab。特殊路由 `#fund/{code}` 渲染 FundDetail。

### Authentication

简单密码认证（`VITE_APP_PASSWORD` 环境变量），无 Supabase Auth。Auth 状态存 localStorage，30 天过期。

### Supabase Key Format

- Must use JWT format anon key (starts with `eyJ`)
- `sb_publishable_` format causes 401 on Edge Functions

---

## Key Files

| File | Purpose |
| ---- | ------- |
| `frontend/src/pages/Layout.tsx` | Main layout + bottom Tab navigation + hash routing |
| `frontend/src/services/navUpdateService.ts` | Core business logic: lot derivation, sell matching, realized P&L |
| `frontend/src/services/fundApi.ts` | Fund data API (search/nav/cache/history) |
| `frontend/src/hooks/useSync.ts` | Data access hooks (holdings derived from transactions) |
| `frontend/src/hooks/useSupabase.ts` | Supabase CRUD hooks |
| `frontend/src/lib/supabase.ts` | Supabase client + `isSupabaseConfigured()` |
| `frontend/src/types/index.ts` | Global TypeScript types |
| `frontend/src/types/database.ts` | Supabase database types |
| `frontend/vitest.config.ts` | Test configuration (separate from vite.config.ts) |
| `supabase/functions/fund-nav/index.ts` | Edge Function: fetch fund NAV |
| `supabase/functions/fund-search/index.ts` | Edge Function: search funds |
| `supabase/functions/fund-history/index.ts` | Edge Function: historical NAV |

---

## Testing

- **Framework**: Vitest v4 + @testing-library/react + fake-indexeddb
- **Setup file**: `src/__tests__/setup.ts` (imports jest-dom + fake-indexeddb/auto)

**Mock pattern** — use `vi.hoisted()` for mocks that must exist before module load:

```typescript
const mockInsert = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: () => ({ insert: mockInsert }) }
}));
```

**Test isolation** — always reset mocks in `beforeEach`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

## Database Schema

| Table | Description |
|-------|-------------|
| `transactions` | 交易记录（buy/sell，pending/completed）— 主表 |
| `holdings` | 持仓记录（兼容性保留，实际从 transactions 派生） |
| `favorite_funds` | 自选基金 |
| `fund_cache` | 基金搜索缓存 |
| `fund_search_history` | 搜索历史 |

RLS enabled with ALLOW ALL policy (single-user mode, no user_id field).

---

## Code Standards

**File naming**:
- Components/Pages: PascalCase (`FundDetail.tsx`)
- Hooks: `use` prefix (`useSync.ts`)
- Services/Utils: camelCase (`fundApi.ts`)
- Tests: `*.test.ts`

**Data operations**:
- Read: Use `useSync.ts` hooks (fetches from Supabase, derives holdings)
- Write: Use `useSupabase.ts` functions or `navUpdateService.ts` transaction helpers

**TypeScript**:
- Strict mode enabled
- Avoid `any` except for third-party API responses
- Supabase insert operations may need `as any` due to client type limitations

---

## Environment Variables

```
frontend/.env          → 生产 Supabase（CI/CD 用）
frontend/.env.local    → 测试 Supabase（本地优先，不提交）
```

必需变量：`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`（JWT 格式，以 `eyJ` 开头）, `VITE_APP_PASSWORD`

---

## CI/CD

- **deploy.yml**: Push to `main` 自动部署 Edge Functions 到 Supabase + 构建前端到 GitHub Pages
- **update-valuation.yml**: 每 2 小时 cron，抓取沪深 300 估值数据写入 `frontend/public/valuation.json`
- **Dev proxy**: Vite 开发服务器代理 `/api` → Supabase Edge Functions（本地开发免 CORS）

---

## Unused Dependencies

`dexie`, `react-router-dom`, `axios` 在 package.json 中但源码未引用，可清理。

---

## Decision Framework

- **Autonomous**: Code style, bug fixes, obvious optimizations
- **Quick consult**: Technical choices, architecture patterns (timeout = auto-decision)
- **Must confirm**: Business logic changes, data structure modifications

Stop and ask when conflicts arise or business requirements are unclear.
