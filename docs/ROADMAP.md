# ROADMAP.md — 项目路线图

## 已完成（v2.7.0）

- [x] 核心持仓管理（批次派生、卖出匹配、已实现盈亏）
- [x] 基金搜索与自选（东方财富 API 代理）
- [x] 网格策略系统（创建、执行、取消、清算、梯形图）
- [x] 交易记录管理（买入/卖出/在途，筛选/搜索/删除）
- [x] 仪表板（总资产、估值信号、操作卡片）
- [x] 数据导出/导入（CSV、JSON 备份）
- [x] 文章库（E大文章阅读）
- [x] Supabase 集成（Edge Functions 代理东方财富 API）
- [x] 测试套件（542 测试全绿）
- [x] CI/CD（GitHub Actions 自动部署）
- [x] 简单密码认证

## 打磨完成（2026-06-21）

- [x] 消除 lotTraceService.ts 重复匹配逻辑（复用 matchSellAgainstLots）
- [x] 消除 window.location.reload()（事件驱动刷新）
- [x] 清理冗余 console.error/warn（28→9）
- [x] 写入操作增加 auth 校验
- [x] 各维度评分 ≥7/10

## 后续迭代

- [ ] 全局状态管理 / 页面间数据同步
- [ ] 大数据量分页
- [ ] 离线模式
- [ ] 组件级测试覆盖
- [ ] 正式 CHANGELOG
- [ ] Settings.tsx JSON 导入/重置 handlers 补充 finally 块
