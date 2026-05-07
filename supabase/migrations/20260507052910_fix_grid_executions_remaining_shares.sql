-- 补全 grid_executions 缺失的 remaining_shares 字段
ALTER TABLE grid_executions
ADD COLUMN IF NOT EXISTS remaining_shares NUMERIC(15,4);
