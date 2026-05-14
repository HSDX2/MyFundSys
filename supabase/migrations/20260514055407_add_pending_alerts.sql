-- 在途交易告警表
-- 当 processPendingTransactions 无法自动处理在途交易时，记录告警供用户手动处理
CREATE TABLE IF NOT EXISTS pending_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    fund_code VARCHAR(10) NOT NULL,
    confirm_date VARCHAR(20) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    detail TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved', 'ignored')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- RLS
ALTER TABLE pending_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on pending_alerts" ON pending_alerts;
CREATE POLICY "Allow all operations on pending_alerts"
ON pending_alerts FOR ALL USING (true) WITH CHECK (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pending_alerts_status ON pending_alerts(status);
CREATE INDEX IF NOT EXISTS idx_pending_alerts_transaction_id ON pending_alerts(transaction_id);
