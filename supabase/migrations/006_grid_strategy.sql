-- 网格策略表：每只基金一行
CREATE TABLE IF NOT EXISTS grid_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fund_code VARCHAR(10) NOT NULL UNIQUE,
    fund_name VARCHAR(100) NOT NULL,
    peak_price NUMERIC(10,4) NOT NULL,
    bottom_price NUMERIC(10,4) NOT NULL,
    grid_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 网格执行记录表
CREATE TABLE IF NOT EXISTS grid_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID NOT NULL REFERENCES grid_strategies(id) ON DELETE CASCADE,
    fund_code VARCHAR(10) NOT NULL,
    grid_type VARCHAR(10) NOT NULL CHECK (grid_type IN ('small', 'medium', 'large')),
    grid_level INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('buy', 'sell')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled')),
    transaction_id UUID REFERENCES transactions(id),
    executed_nav NUMERIC(10,4),
    executed_amount NUMERIC(15,2),
    executed_shares NUMERIC(15,4),
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- transactions 表增加 source 和 grid_execution_id 字段
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS grid_execution_id UUID REFERENCES grid_executions(id);

-- grid_executions 增加 remaining_shares 用于追踪该格剩余份额
ALTER TABLE grid_executions ADD COLUMN IF NOT EXISTS remaining_shares NUMERIC(15,4);

-- 索引
CREATE INDEX IF NOT EXISTS idx_grid_strategies_fund_code ON grid_strategies(fund_code);
CREATE INDEX IF NOT EXISTS idx_grid_executions_strategy_id ON grid_executions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_grid_executions_fund_code ON grid_executions(fund_code);
CREATE INDEX IF NOT EXISTS idx_grid_executions_status ON grid_executions(status);

-- RLS
ALTER TABLE grid_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_executions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'grid_strategies'
    ) THEN
        CREATE POLICY "Allow all" ON grid_strategies FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'grid_executions'
    ) THEN
        CREATE POLICY "Allow all" ON grid_executions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- updated_at 触发器
CREATE TRIGGER update_grid_strategies_updated_at
    BEFORE UPDATE ON grid_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grid_executions_updated_at
    BEFORE UPDATE ON grid_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
