# ARCHITECTURE.md — 当前架构

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 框架 | React | ^18.3.1 |
| 语言 | TypeScript | ^5.5.3 |
| 构建 | Vite | ^5.4.0 |
| UI | Ant Design Mobile | ^5.37.1 |
| 图表 | Recharts | ^2.12.7 |
| 数据库 | Supabase (PostgreSQL) | ^2.49.1 |
| 拖拽 | @dnd-kit | core ^6.3.1 |
| 日期 | dayjs | ^1.11.12 |
| 测试 | Vitest v4 + @testing-library/react | |

## 目录结构

```
frontend/src/
├── pages/          # 10 个页面组件（hash 路由）
├── components/     # 11 个共享 UI 组件
├── services/       # 9 个业务逻辑服务
├── hooks/          # 4 个自定义 hook
├── types/          # 2 个类型定义文件
├── utils/          # 3 个工具函数
├── lib/            # Supabase 客户端配置
├── db/             # 数据库操作
├── data/           # 静态数据（网格策略 JSON）
└── __tests__/      # 19 个测试文件，538 个用例
```

## 数据流

```
Supabase DB → fetchAllDataFromSupabase() → transactions[]
  → deriveLots(transactions) → Lot[]
  → summarizeHoldings(lots) → Holding[]
  → batchFetchNav(codes) → 导航增强
  → UI 组件
```

## API 调用链

```
前端 → supabase.functions.invoke(fnName, {body})
     → Supabase Edge Function (Deno)
     → 东方财富 API（移动端 UA）
```

## 状态管理

无全局状态库（无 Redux/Zustand/Context）。数据流：
1. Supabase 为唯一数据源
2. 自定义 hooks 封装数据访问（useSync.ts, useGrid.ts）
3. fundApi.ts 内存缓存（NAV 5min, history 24h）
4. localStorage 仅用于 auth 状态

## 路由

Hash-based routing，Layout.tsx 底部 TabBar 导航 6 个 tab。
特殊路由：`#fund/{code}` → FundDetail，`#grid/{code}` → GridDetail。

## 测试架构

- Vitest v4 + jsdom + fake-indexeddb
- 覆盖范围：services（重点）、hooks、utils、1 个页面测试
- 覆盖率排除：pages、components、db、lib、main.tsx
- Mock 模式：vi.hoisted() + vi.mock()
