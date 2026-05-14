-- 为自选基金添加排序字段，支持拖拽排序
ALTER TABLE favorite_funds ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 已有数据按 created_at 倒序排列（最新的排最前）
UPDATE favorite_funds SET sort_order = sub.rn
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) - 1 AS rn
  FROM favorite_funds
) sub
WHERE favorite_funds.id = sub.id AND favorite_funds.sort_order = 0;

-- 索引
CREATE INDEX IF NOT EXISTS idx_favorite_funds_sort_order ON favorite_funds(sort_order);
