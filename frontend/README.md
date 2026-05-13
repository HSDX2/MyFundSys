# MyFundSys 前端模块

> 个人基金投资管理系统的前端项目，基于 React + TypeScript + Vite + Ant Design Mobile 构建。

## 📋 概述

本项目是 MyFundSys 系统的前端部分，提供移动端友好的基金管理界面，支持多设备访问，数据通过 Supabase 云端存储。

**核心功能**:
- 🔐 **本地密码验证** — 密码登录保护，仅本人可访问数据
- 💼 **批次持仓管理** — 每笔买入独立追踪，精确计算浮动/已实现盈亏
- 📝 **交易记录** — 完整的买入/卖出记录，支持在途交易（T+1 净值自动确认）
- 🎯 **落袋为安** — 已实现盈亏追踪，胜率、累计收益统计
- ☁️ **云端同步** — Supabase 云存储，手机/电脑多设备数据无缝同步
- 📊 **市场估值** — 全市场 PE/PB 估值温度计，颜色分级显示，每2小时自动更新
- 🔍 **基金搜索** — 支持按代码/名称搜索基金，自选基金收藏管理
- 📈 **基金详情** — 历史净值走势图表，支持日期范围查询
- 🎯 **策略回测** — 自定义投资策略回测，收益分析与验证
- 📊 **收益报告** — 多维度持仓与收益统计报告
- 📰 **投资资讯** — 投资文章聚合，市场动态推送
- 🤖 **AI 观点** — AI 生成的投资分析与观点
- 💾 **数据管理** — JSON/CSV 格式数据导入导出备份，支持批量操作

## 🏗️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.x | 前端框架 |
| TypeScript | 5.5.x | 类型安全 |
| Vite | 5.4.x | 构建工具 |
| Ant Design Mobile | 5.x | 移动端 UI 组件库 |
| Recharts | 2.x | 图表库 |
| Dayjs | 1.x | 日期时间处理 |
| Supabase JS | 2.x | Supabase 客户端 |
| Vitest | 4.x | 单元测试框架 |
| Playwright | 1.x | E2E 测试 |

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 9+

### 启动开发服务

```bash
# 1. 进入 frontend 目录
cd frontend

# 2. 安装依赖
npm install

# 3. 配置环境变量
# 复制 .env.example 为 .env.local，并填入实际的 Supabase 配置
cp .env.example .env.local

# 编辑 .env.local，填入以下内容:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGci... (必须为 JWT 格式，以 eyJ 开头)
# VITE_APP_PASSWORD=your_login_password

# 4. 启动开发服务器
npm run dev

# 访问 http://localhost:5173/
```

### 构建与部署

```bash
# 生产构建，产物输出到 dist/ 目录
npm run build

# 预览生产构建
npm run preview

# 部署到 GitHub Pages (需要配置 gh-pages 权限)
npm run deploy
```

### 测试

```bash
# 运行所有单元测试
npm test

# 运行单个测试文件
npx vitest run src/__tests__/services/fundApi.test.ts

# 按测试名称运行
npx vitest run -t "测试名称"

# 运行 E2E 测试
npm run test:e2e
```

## 📁 项目结构

```
frontend/
├── src/
│   ├── pages/                  # 页面组件
│   │   ├── Layout.tsx          # 主布局 + 底部 Tab 导航 + Hash 路由
│   │   ├── Dashboard.tsx       # 首页（市场估值 + 持仓概览）
│   │   ├── Holdings.tsx        # 持仓管理（批次展示 + 卖出操作）
│   │   ├── Transactions.tsx    # 交易记录（在途/完成交易展示）
│   │   ├── FundList.tsx        # 基金搜索 + 自选基金管理
│   │   ├── FundDetail.tsx      # 基金详情（历史净值 + 买卖操作）
│   │   ├── Strategy.tsx        # 投资策略展示 + 回测
│   │   ├── Settings.tsx        # 设置页（数据导入导出 + 关于）
│   │   └── AuthPage.tsx        # 登录页
│   ├── components/             # 可复用 UI 组件
│   │   ├── TotalAssetsCard.tsx # 总资产卡片
│   │   ├── FavoriteFunds.tsx   # 自选基金列表
│   │   ├── SparklineChart.tsx  # 迷你折线图
│   │   └── FundHistoryCard.tsx # 历史净值卡片
│   ├── services/               # 业务逻辑与 API 服务
│   │   ├── fundApi.ts          # 基金数据 API（调用 Edge Functions）
│   │   ├── navUpdateService.ts # 批次派生、卖出匹配、在途交易处理
│   │   └── csv.ts              # CSV 导入导出工具
│   ├── hooks/                  # 自定义 React Hooks
│   │   ├── useSync.ts          # 数据访问 Hooks（从 transactions 派生持仓）
│   │   └── useSupabase.ts      # 本地认证状态管理
│   ├── lib/
│   │   └── supabase.ts         # Supabase 客户端初始化
│   ├── types/                  # TypeScript 类型定义
│   │   ├── index.ts            # 全局业务类型
│   │   └── database.ts         # Supabase 数据库类型（自动生成）
│   └── utils/                  # 通用工具函数
│       ├── index.ts            # 日期、金额格式化等
│       └── technicalIndicators.ts # 技术指标计算
├── public/                     # 静态资源
│   └── valuation.json          # 市场估值数据（GitHub Actions 自动更新）
├── __tests__/                  # 单元测试
├── e2e/                        # E2E 测试
├── vite.config.ts              # Vite 构建配置
├── vitest.config.ts            # Vitest 测试配置
├── playwright.config.ts        # Playwright E2E 配置
├── .env.example                # 环境变量示例
└── package.json
```

## 🔧 核心架构

### 数据流向

```
Supabase 数据库 →  transactions 表 → useSync Hook → deriveLots 函数 → 批次数据 → 页面渲染
```

**重要特性**:
- **单一数据源**: 所有持仓数据从 transactions 表派生，没有独立的 holdings 表（兼容保留）
- **批次会计**: 每笔买入作为独立批次，卖出时按成本最低优先匹配
- **在途交易**: T+1 交易自动处理，净值确认后自动标记为完成
- **云端同步**: 所有数据存储在 Supabase，支持多设备访问

### API 调用规则

所有基金数据请求必须通过 Supabase Edge Functions 代理：

```typescript
// ✅ 正确方式
const { data } = await supabase.functions.invoke('fund-nav', {
  body: { code: '000001' } // POST 请求，参数通过 body 传递
});

// ❌ 禁止
const response = await fetch('https://api.eastmoney.com/...'); // 直接调用第三方 API 会被 CORS 拦截
```

## 🧪 测试覆盖

核心业务逻辑均有单元测试覆盖：

| 测试文件 | 覆盖内容 | 测试数量 |
|----------|---------|---------|
| `lotDerivation.test.ts` | 批次派生、已实现盈亏、卖出匹配、持仓汇总 | 18 |
| `fundApi.test.ts` | API 服务、搜索逻辑、净值缓存 | 12 |
| `useSync.test.ts` | 持仓计算、交易处理 | 10 |
| `transactionDateNav.test.tsx` | 交易日期与净值逻辑 | 8 |
| **合计 (Web)** | **Vitest** | **503 tests, 19 文件** |
| **Android App** | **Jest + jest-expo** | **24 tests, 4 文件** |

## 📱 Android App

React Native (Expo) 客户端位于 `android-app/`，与 Web 端共享同一 Supabase 数据库和 Edge Functions。

```bash
cd android-app
# app.json → extra 填入 Supabase 凭据后运行
npx expo start
```

## 📄 相关文档

- [根目录 README.md](../README.md) - 项目整体说明
- [EDGE_FUNCTIONS_API.md](../docs/EDGE_FUNCTIONS_API.md) - Supabase Edge Functions 接口文档
- [代码审查问题记录](../docs/CODE_REVIEW_ISSUES_20260406.md) - 已知问题与修复计划

## 🔒 安全说明

- 本地密码仅做前端验证，不提交到后端
- Supabase Anon Key 为公开可访问，但 RLS 策略限制只有表所有者可修改
- 所有第三方 API 调用通过 Edge Functions 代理，不暴露敏感信息
