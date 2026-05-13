# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
