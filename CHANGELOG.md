# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2026-06-21

### Fixed
三轮全面业务逻辑审核，共修复 20 项漏洞：

**卖出批次与盈亏（核心账务）**
- **卖出按批次精确匹配** — `transactions` 新增 `lot_id` 列，手动按批次卖出时精确扣减指定批次；匹配优先级统一为 `lotId → gridExecutionId → 成本升序`，修复 UI「按批次卖出」与底层「成本最低匹配」的语义裂缝
- **抽取单一卖出匹配函数** `matchSellAgainstLots` + `calcLotProfit`，消除 5 处重复实现的分歧
- **已实现盈亏正确分摊手续费**（买入费计入成本、卖出费抵减收入；fee 值仍为 0）
- **派生排序加 `createdAt` 二级键**，同日多笔交易匹配结果稳定

**在途交易**
- **取不到确认日真实净值时不再降级用最新净值凑数成交**，保持 pending 并按阈值写告警
- **告警去重** — `pending_alerts` 新增 `(transaction_id, reason)` 唯一约束，`createAlert` 改 upsert，防止反复运行膨胀

**网格交易**
- 卖出/清仓基于 `remaining_shares` 而非 `executed_shares`，杜绝部分卖出后超卖
- 在途网格买入确认后回填 `grid_executions` 的真实成交净值/份额
- `executeGrid` 服务层校验卖出份额不超过剩余可卖份额
- `cancelGridExecution` 重排序（删交易→标 cancelled→幂等恢复份额）+ 恢复封顶 `executed_shares`
- **通用删除入口同步网格** — `removeTransactionWithHoldingUpdate` 删网格卖出回补份额、删被引用的网格买入则阻止

**数据安全与一致性**
- **`importDatabase` 修复逻辑反转** — 原实现「插入后又按导入数据 id 删除」会清空刚导入的数据；改为「删旧→插新」
- `reorderFavorites` 改原子化 upsert + 错误检查；`addFavoriteFund` 分配 `sort_order`
- CSV 导入去重 + 触发在途处理 + 失败明细；导出转义换行符；导入日期规范化 + 数值严格校验（拒绝 Infinity/尾部垃圾/负数）
- 回测年化收益率改用真实日历跨度替代 `length / 252`
- `useRiskMetrics` 估值信号阈值与 `getValuationStatus` 五档对齐

### Changed
- 单元测试 **538**（原 511）；e2e **9** 个 Playwright spec 全绿（修复 fund-search 失效的 3 个）
- 迁移 `20260620000000`：`transactions.lot_id` 列 + `pending_alerts` 唯一约束（已部署生产库）

## [2.6.0] - 2026-05-14

### Added
- **已收藏基金拖拽排序** — `@dnd-kit/core` + `sortable` 实现，长按/拖动调整顺序，自动持久化到 `sort_order`
- **pending_alerts 表迁移** — 新增 `pending_alerts` 表，记录在途交易自动处理失败告警
- **交易批次 Tab 大修** — 在途买入显示"待确认"视图、网格/手动标签、盈亏计算计入手续费、NaN 防护、加载失败 Toast
- **保存交易双次重试** — schema cache 未刷新时自动降级到基础列，兼容未迁移的 Supabase 项目

### Fixed
- `addTransactionWithHoldingUpdate` / `saveTransaction` schema cache 兼容（`source`/`confirm_date`/`grid_execution_id` 列未迁移时自动降级）
- `resetDatabase` 改为先 SELECT ID 再逐条 DELETE，彻底解决 PostgREST 运算符兼容问题
- `fetchFundNav` 添加 10s 超时，防止边缘函数挂起导致收藏列表无法加载
- `fetchAlerts`/`fetchUnresolvedAlertCount` 添加 try-catch 处理 `pending_alerts` 表不存在
- 迁移 `004` RLS policy 重复创建修复、`funds` 表不存在条件判断

### Changed
- 全项目测试 **511**（Web 511 + Android 24）
- `supabase/config.toml` major_version 15 → 17

## [2.5.0] - 2026-05-14

### Fixed
- **10 轮深度代码审核，70+ bug 修复** — 分两个阶段覆盖全部源码
  - **Round 1-5**（服务层 + 页面 + hooks）：17 个严重 + 10+ 中等 bug（零值映射、NaN 传播、`remaining_shares` 部分卖出、非空断言、catch 未处理 Promise、`as any` 审计、setTimeout 泄漏等）
  - **Round 6-10**（fundApi/syncService/backtest/Edge Functions/Android App）：45+ bug（缓存击穿、DELETE+INSERT 事务丢失、`hasPoison` 栈溢出、CSV `\r\n`/千位分隔符、`window` undefined 崩溃、Edge Function 超时/URL 编码/NaN 等）
- **Edge Functions**: 添加 fetch 10s 超时、POST 方法校验、`encodeURIComponent`、`parseFloat` NaN 防护
- **Android App**: `window` undefined 崩溃修复、`price=0` 数据损坏修复、`route.params` 空守卫

### Changed
- 全项目测试从 **527** 增长到 **535**（Web 511 + Android 24）
- 构建包体积保持稳定（JS ~120KB gzip）

### Added
- `favoriteService.ts` 新增 `addFavoriteFund`（策略导入自动收藏）

## [2.4.0] - 2026-05-13

### Added
- **策略导入自动收藏** — 导入网格策略时，新建的基金代码自动添加到收藏列表（`favoriteService.ts`）
- **`favoriteService.ts`** — 新增收藏工具函数 `addFavoriteFund`，封装 `onConflict` 去重逻辑

### Changed
- 全项目测试从 526 增长到 **527**（Web 503 + Android 24）

## [2.3.0] - 2026-05-13

### Added
- **Android App 测试覆盖** — 24 tests, 4 suites (Jest + jest-expo)，覆盖核心业务逻辑和认证 hooks

### Changed
- 全项目测试从 502 增长到 **526**（Web 502 + Android 24）
- README / AGENTS.md 更新至最新测试数和架构说明

## [2.2.1] - 2026-05-13

### Fixed
- 两轮 10 次审核修复 28+ 个 bug（fetchFundNav 冗余 try-catch、history 不必要调用、PendingAlertCard 未接入致命 bug、CSV pending 逻辑不一致、CSV 注入防护、filterRecentData 引用返回等）
- GridExecutionSheet 错误提示透传真实错误信息
- triggerSync 从全表 SELECT 改为轻量查询

### Changed
- Android App (Expo) 初始版本发布，与 Web 共享同一数据库

## [2.2.0] - 2026-05-13

### Added
- **投资组合驾驶舱** — Dashboard 重构，风险仪表盘（仓位/集中度/估值信号）、行动卡片（网格触发/在途交易/告警），502 测试覆盖
- **交易全链路追溯** — 按买入批次聚合生命周期，FundDetail 新增"交易批次"Tab，逐批展示买入→部分卖出→剩余浮盈
- **净值更新异常告警** — pending_alerts 表、processPendingTransactions 写入告警、手动输入净值/忽略/删除三操作
- **在途交易手动刷新按钮** — Transactions 页新增一键刷新 pending 交易

### Fixed
- 三轮代码审核 23+2 个 bug（成本按比例计算、gridExecutionId 回填、日期比较、除零保护等）

### Changed
- 测试从 470 增长到 502，19 个测试文件
- useRiskMetrics 从外部接收估值百分位，消除 Dashboard 重复请求

## [2.1.0] - 2026-05-07

### Added
- 网格交易策略模块 — 支持自定义网格参数、自动执行记录、盈亏追踪
- 网格交易与持仓的精确匹配（gridExecutionId）

### Changed
- 代码清理与文档统一

## [2.0.0] - 2026-03

### Added
- 完整测试框架（Vitest v4 + @testing-library/react + fake-indexeddb），131 个测试用例
- Supabase Edge Functions：fund-nav（净值查询）、fund-search（基金搜索）、fund-history（历史净值）
- 在途交易自动确认机制（pending → completed）
- 沪深300估值数据自动更新（GitHub Actions cron）
- 已实现盈亏（Realized P&L）追踪

### Changed
- 数据架构重构：从 IndexedDB 迁移到 Supabase 单一数据源
- 持仓派生模式：从交易记录派生 Lot 批次，不再直接读写 holdings 表
- 卖出匹配逻辑：按成本升序匹配（非 FIFO），支持网格精确匹配
- 移除 react-router-dom，改用 hash-based 路由

### Fixed
- 修复两轮深度审计发现的 24 个 bug
- 修复 Edge Functions 参数传递方式（POST body 替代 URL query）
- 修复东方财富 API 移动端 UA 要求
- 修复 GitHub Pages base 路径问题

## [1.0.0] - 2025-08

### Added
- 初始版本：个人基金投资管理系统
- 基金净值查询（东方财富 API）
- 买入/卖出交易记录管理
- 持仓概览与盈亏计算
- 自选基金功能
- 简单密码认证
- GitHub Pages 自动部署
