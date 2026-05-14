-- ============================================
-- 迁移脚本: 添加基金缓存和搜索功能
-- ============================================

-- 创建基金缓存表（用于存储搜索到的基金信息）
create table if not exists fund_cache (
  id text primary key,
  code text not null unique,
  name text not null,
  category text,
  nav numeric,
  nav_date date,
  pe numeric,
  pb numeric,
  dividend_yield numeric,
  source text default 'search', -- 来源：search（搜索添加）/ import（导入）/ system（系统预设）
  is_holding boolean default false, -- 是否为持仓基金
  holding_shares numeric default 0, -- 持仓份额（关联 holdings 表）
  search_count integer default 1, -- 被搜索次数（用于排序）
  last_updated timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 创建基金搜索历史表
CREATE TABLE IF NOT EXISTS fund_search_history (
  id serial PRIMARY KEY,
  keyword text NOT NULL,
  results_count integer DEFAULT 0,
  searched_at timestamptz DEFAULT now()
);

-- 启用 RLS
alter table fund_cache enable row level security;
alter table fund_search_history enable row level security;

-- RLS 策略：所有人可以读写（简化模式）
create policy "Allow all operations on fund_cache" 
on fund_cache for all using (true) with check (true);

create policy "Allow all operations on fund_search_history" 
on fund_search_history for all using (true) with check (true);

-- 创建更新时间戳触发器
create trigger update_fund_cache_updated_at before update on fund_cache
  for each row execute function update_updated_at_column();

-- 创建索引
create index if not exists idx_fund_cache_code on fund_cache(code);
create index if not exists idx_fund_cache_name on fund_cache(name);
create index if not exists idx_fund_cache_is_holding on fund_cache(is_holding);
create index if not exists idx_fund_cache_search_count on fund_cache(search_count desc);

-- 如果存在旧的 funds 表，将数据迁移到 fund_cache
do $$
begin
  if exists (select from information_schema.tables where table_name = 'funds') then
    insert into fund_cache (id, code, name, category, source, is_holding)
    select id, code, name, category, 'system' as source, false as is_holding
    from funds
    on conflict (code) do nothing;
  end if;
end $$;

-- 添加实时订阅
alter publication supabase_realtime add table fund_cache;
