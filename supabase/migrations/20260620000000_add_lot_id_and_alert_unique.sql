-- 修复 #1：sell 交易精确指向被卖出的买入批次
-- transactions.lot_id 指向被卖出买入交易的 id（手动按批次卖出场景）
-- 派生持仓/已实现盈亏时优先按 lot_id 精确匹配，避免 UI「按批次卖出」与底层「成本升序匹配」语义不一致
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lot_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_lot_id ON transactions(lot_id);

-- 修复 #2：在途告警去重
-- 同一笔交易、同一原因只保留一条告警，processPendingTransactions 反复运行不再膨胀
-- 先清理可能已存在的重复行，再建唯一约束
DELETE FROM pending_alerts a
USING pending_alerts b
WHERE a.ctid < b.ctid
  AND a.transaction_id = b.transaction_id
  AND a.reason = b.reason;

ALTER TABLE pending_alerts
  DROP CONSTRAINT IF EXISTS uq_pending_alerts_tx_reason;
ALTER TABLE pending_alerts
  ADD CONSTRAINT uq_pending_alerts_tx_reason UNIQUE (transaction_id, reason);
