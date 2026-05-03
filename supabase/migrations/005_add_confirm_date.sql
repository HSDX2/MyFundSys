-- 添加 confirm_date 字段到 transactions 表
-- 用于区分交易日期和确认日期（在途交易的确认日可能晚于交易日）

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS confirm_date DATE;
