# 投资管理系统三期改进计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use dispatching-parallel-agents or subagent-driven-development to implement this plan.

**Goal:** 实现投资组合驾驶舱(#3)、交易全链路追溯(#4)、净值更新异常告警(#5)

**Architecture:** 三个功能相互独立，分别由 CoderAgent + TestEngineer 并行实施。共享现有 hooks/services 层，不引入新依赖。

**Tech Stack:** React 18 + TypeScript + Vitest + Recharts + Ant Design Mobile + Supabase

---

### Feature #3: 投资组合驾驶舱 (Dashboard Cockpit)

**Files:**
- Create: `frontend/src/hooks/useRiskMetrics.ts`
- Create: `frontend/src/components/ActionCard.tsx` (+ `.css`)
- Modify: `frontend/src/pages/Dashboard.tsx` — 重构布局
- Create: `frontend/src/__tests__/hooks/useRiskMetrics.test.ts`
- Modify: `frontend/src/__tests__/pages/dateNavChange.test.ts` — 适配新布局

**核心逻辑：**
1. `useRiskMetrics` hook：从 `useHoldings` + `useGridStrategies` + `fetchMarketValuation` 聚合总资产、仓位、集中度、估值信号
2. `ActionCard` 组件：条件渲染行动卡片（在途交易/网格触发/估值信号）
3. 趋势线：复用现有 Recharts LineChart，用 holdings 历史快照（无历史则用最近数据点）

**测试策略：**
- `useRiskMetrics`：mock `useHoldings` 返回值，验证仓位/集中度/信号计算
- `ActionCard`：0 条 action → 不渲染；有 actions → 渲染对应卡片
- Dashboard: 新快照测试

---

### Feature #4: 交易全链路追溯 (Lot Traceability)

**Files:**
- Create: `frontend/src/services/lotTraceService.ts`
- Create: `frontend/src/components/LotTimeline.tsx` (+ `.css`)
- Modify: `frontend/src/pages/FundDetail.tsx` — 新增"交易批次"Tab
- Modify: `frontend/src/types/index.ts` — 新增 `LotTimeline` 类型
- Create: `frontend/src/__tests__/services/lotTraceService.test.ts`
- Create: `frontend/src/__tests__/components/LotTimeline.test.tsx`

**核心逻辑：**
1. `lotTraceService.ts` 中的 `groupTransactionsByLot(transactions, fundCode)`：复用 `deriveLots` + `deriveRealizedLots` 的匹配结果，按买入批号聚合为 `LotTimeline[]`
2. `LotTimeline` 组件：展示单批买入的完整生命周期
3. FundDetail 新增第三个 Tab

**测试策略：**
- `groupTransactionsByLot`：mock transactions 数组，验证批次聚合（买入1000，分3次卖出300/200/200，剩余300）
- `LotTimeline`：渲染测试 + 空数据

---

### Feature #5: 净值更新异常告警 (Pending Alert)

**Files:**
- Create: `frontend/src/services/alertService.ts`
- Create: `frontend/src/types/database.ts` — 新增 `pending_alerts` 表类型
- Modify: `frontend/src/services/navUpdateService.ts` — `processPendingTransactions` 写入告警
- Modify: `frontend/src/pages/Dashboard.tsx` — 展示告警卡片
- Modify: `frontend/src/pages/Transactions.tsx` — 手动刷新按钮
- Create: `frontend/src/components/PendingAlertCard.tsx` (+ `.css`)
- Create: `frontend/src/__tests__/services/alertService.test.ts`
- Create: `frontend/src/__tests__/components/PendingAlertCard.test.tsx`

**核心逻辑：**
1. `alertService.ts`：`createAlert()` / `fetchAlerts()` / `resolveAlert()` —— 读写 `pending_alerts` 表
2. `processPendingTransactions`：在 continue/skip 场景改为写入告警
3. `PendingAlertCard`：展示告警详情 + 手动输入净值/忽略/删除交易三个操作
4. Dashboard ActionCard 接入告警数

**测试策略：**
- `alertService.createAlert`：mock supabase.insert，验证参数
- `PendingAlertCard`：三种操作按钮渲染 + 点击回调
- `processPendingTransactions`：新增告警分支的 mock 测试
