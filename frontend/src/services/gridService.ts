/**
 * 网格交易策略服务
 *
 * Supabase 为数据源，提供网格策略的 CRUD、执行、状态推导等功能
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { addTransactionWithHoldingUpdate } from './navUpdateService';
import { GRID_TYPES } from '../types';
import type {
  GridType,
  GridLevel,
  GridTypeConfig,
  GridStrategy,
  GridExecution,
  GridLevelStatus,
  GridLevelWithStatus,
  GridFundOverview,
} from '../types';

// ============================================
// 网格阶梯计算（纯函数）
// ============================================

export function calculateGridLevels(
  bottomPrice: number,
  spacingPct: number,
  gridCount: number,
  baseInvestment: number,
  incrementPct: number,
  profitRules: number[]
): GridLevel[] {
  const grids: GridLevel[] = [];
  let cumulative = 0;

  for (let i = 0; i < gridCount; i++) {
    // 买① = 极限底，向上按固定间距展开
    const triggerPrice = bottomPrice * Math.pow(1 + spacingPct, i);
    const investment = Math.round(baseInvestment * Math.pow(1 + incrementPct, i));
    cumulative += investment;
    const sellPrice = triggerPrice * (1 + spacingPct);
    const profit = Math.round(investment * spacingPct);
    const profitRetentionPct = profitRules[i] || 0;

    grids.push({
      level: i + 1,
      trigger_price: roundPrice(triggerPrice),
      investment,
      cumulative,
      sell_price: roundPrice(sellPrice),
      profit,
      profit_retention_pct: profitRetentionPct,
    });
  }

  return grids;
}

function roundPrice(price: number): number {
  return Math.round(price * 10000) / 10000;
}

// ============================================
// CRUD 操作
// ============================================

export async function fetchGridStrategies(): Promise<GridStrategy[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grid_strategies')
    .select('*')
    .or('is_active.eq.true,is_active.is.null')
    .order('fund_code');

  if (error) {
    console.error('fetchGridStrategies error:', error);
    return [];
  }

  return (data || []).map(mapDbGridStrategy);
}

export async function fetchGridStrategyByFund(fundCode: string): Promise<GridStrategy | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('grid_strategies')
    .select('*')
    .eq('fund_code', fundCode)
    .maybeSingle();

  if (error || !data) return null;

  return mapDbGridStrategy(data);
}

export async function createGridStrategy(
  strategy: Omit<GridStrategy, 'id' | 'created_at' | 'updated_at'>
): Promise<GridStrategy | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await (supabase
    .from('grid_strategies') as any)
    .insert({
      fund_code: strategy.fund_code,
      fund_name: strategy.fund_name,
      peak_price: strategy.peak_price,
      bottom_price: strategy.bottom_price,
      grid_config: strategy.grid_config as any,
      is_active: strategy.is_active,
    })
    .select()
    .single();

  if (error) {
    return null;
  }

  return mapDbGridStrategy(data);
}

export async function deleteGridStrategy(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await supabase.from('grid_strategies').delete().eq('id', id);
}

// ============================================
// 执行记录 CRUD
// ============================================

export async function fetchGridExecutions(fundCode: string): Promise<GridExecution[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grid_executions')
    .select('*')
    .eq('fund_code', fundCode)
    .order('created_at');

  if (error) {
    return [];
  }

  return (data || []).map(mapDbGridExecution);
}

export async function fetchAllGridExecutions(): Promise<GridExecution[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grid_executions')
    .select('*')
    .order('created_at');

  if (error) {
    return [];
  }

  return (data || []).map(mapDbGridExecution);
}

// ============================================
// 网格执行
// ============================================

export interface ExecuteGridParams {
  strategyId: string;
  fundCode: string;
  fundName: string;
  gridType: GridType;
  gridLevel: number;
  action: 'buy' | 'sell';
  triggerPrice: number;
  investmentAmount?: number;  // buy 用
  sellShares?: number;        // sell 用
  currentNav: number;
  buyExecutionId?: string;    // sell 用：指向买入的 grid_execution
}

export async function executeGrid(
  params: ExecuteGridParams
): Promise<{ executionId: string; transactionId: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { strategyId, fundCode, fundName, gridType, gridLevel, action, currentNav, buyExecutionId } = params;
  const today = new Date().toISOString().split('T')[0];

  if (action === 'buy') {
    const investmentAmount = params.investmentAmount!;
    const shares = investmentAmount / currentNav;
    const roundedShares = Math.round(shares * 10000) / 10000;

    // 1. 创建买入交易记录
    const { transactionId } = await addTransactionWithHoldingUpdate({
      fundId: fundCode,
      fundCode,
      fundName,
      type: 'buy',
      date: today,
      amount: investmentAmount,
      price: currentNav,
      shares: roundedShares,
      fee: 0,
      status: 'pending',
      source: 'grid',
    });

    // 2. 写入 grid_executions（买入）
    const { data, error } = await (supabase
      .from('grid_executions') as any)
      .insert({
        strategy_id: strategyId,
        fund_code: fundCode,
        grid_type: gridType,
        grid_level: gridLevel,
        action: 'buy',
        status: 'executed',
        transaction_id: transactionId,
        executed_nav: currentNav,
        executed_amount: investmentAmount,
        executed_shares: roundedShares,
        remaining_shares: roundedShares,
        executed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`写入买入执行记录失败: ${error.message}`);
    }

    return { executionId: (data as any).id, transactionId };
  }

  // action === 'sell'
  if (!buyExecutionId) {
    throw new Error('卖出操作必须指定 buyExecutionId');
  }

  const sellShares = params.sellShares!;
  const sellAmount = sellShares * currentNav;

  // 1. 创建卖出交易记录（关联买入 execution）
  const { transactionId } = await addTransactionWithHoldingUpdate({
    fundId: fundCode,
    fundCode,
    fundName,
    type: 'sell',
    date: today,
    amount: Math.round(sellAmount * 100) / 100,
    price: currentNav,
    shares: Math.round(sellShares * 10000) / 10000,
    fee: 0,
    status: 'completed',
    source: 'grid',
    gridExecutionId: buyExecutionId,
  });

  // 2. 写入 grid_executions（卖出）
  const { data: sellExecData, error: sellError } = await (supabase
    .from('grid_executions') as any)
    .insert({
      strategy_id: strategyId,
      fund_code: fundCode,
      grid_type: gridType,
      grid_level: gridLevel,
      action: 'sell',
      status: 'executed',
      transaction_id: transactionId,
      executed_nav: currentNav,
      executed_shares: Math.round(sellShares * 10000) / 10000,
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sellError) {
    throw new Error(`写入卖出执行记录失败: ${sellError.message}`);
  }

  // 3. 更新买入 execution 的 remaining_shares
  await (supabase
    .from('grid_executions') as any)
    .update({ remaining_shares: 0 })
    .eq('id', buyExecutionId);

  return { executionId: (sellExecData as any).id, transactionId };
}

export async function cancelGridExecution(executionId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await (supabase
    .from('grid_executions') as any)
    .update({ status: 'cancelled' })
    .eq('id', executionId);
}

// ============================================
// 状态推导（纯函数）
// ============================================

export function deriveGridStatuses(
  strategy: GridStrategy,
  executions: GridExecution[],
  currentNav: number
): Record<GridType, GridLevelWithStatus[]> {
  const result: Record<GridType, GridLevelWithStatus[]> = {
    small: [],
    medium: [],
    large: [],
  };

  // 清仓检测：当前净值 >= 最大网格 sell_price 时进入清仓模式
  const maxSellPrice = getMaxSellPrice(strategy);
  const isLiquidating = currentNav >= maxSellPrice;

  for (const gridType of GRID_TYPES) {
    const config = strategy.grid_config[gridType];
    if (!config) continue;

    const typeExecutions = executions.filter(e => e.grid_type === gridType);

    result[gridType] = config.grids.map(grid => {
      const buyExec = typeExecutions.find(e => e.grid_level === grid.level && e.action === 'buy' && e.status === 'executed');
      const sellExec = typeExecutions.find(e => e.grid_level === grid.level && e.action === 'sell' && e.status === 'executed');

      let status: GridLevelStatus;
      let distancePct: number;

      if (sellExec) {
        // 已完全卖出
        status = 'executed';
        distancePct = ((currentNav - grid.sell_price) / grid.sell_price) * 100;
      } else if (buyExec) {
        // 已买入
        if (isLiquidating) {
          // 清仓模式下，已买入格子保持持有中状态，不显示可卖出按钮
          status = 'executed';
        } else {
          status = currentNav >= grid.sell_price ? 'sell_triggered' : 'executed';
        }
        distancePct = ((currentNav - grid.sell_price) / grid.sell_price) * 100;
      } else if (currentNav <= grid.trigger_price) {
        status = 'triggered';
        distancePct = ((currentNav - grid.trigger_price) / grid.trigger_price) * 100;
      } else {
        status = 'above';
        distancePct = ((currentNav - grid.trigger_price) / grid.trigger_price) * 100;
      }

      return {
        ...grid,
        status,
        execution: buyExec,
        sellExecution: sellExec,
        distance_pct: Math.round(distancePct * 100) / 100,
      };
    });
  }

  return result;
}

// ============================================
// 留利润计算：根据买入份额和利润留存比例，计算应卖出份额
// ============================================

export function calculateSellShares(
  buyShares: number,
  profitRetentionPct: number
): { sellShares: number; retainShares: number } {
  const retainShares = Math.round(buyShares * profitRetentionPct * 10000) / 10000;
  const sellShares = Math.round((buyShares - retainShares) * 10000) / 10000;
  return { sellShares, retainShares };
}

// ============================================
// 清仓检测：判断是否超出整个网格范围
// ============================================

export function shouldLiquidate(strategy: GridStrategy, currentNav: number): boolean {
  return currentNav >= getMaxSellPrice(strategy);
}

export function getMaxSellPrice(strategy: GridStrategy): number {
  let maxSellPrice = 0;
  for (const gridType of GRID_TYPES) {
    const config = strategy.grid_config[gridType];
    if (!config) continue;
    for (const grid of config.grids) {
      maxSellPrice = Math.max(maxSellPrice, grid.sell_price);
    }
  }
  return maxSellPrice;
}

export function computeFundOverview(
  strategy: GridStrategy,
  executions: GridExecution[],
  currentNav: number
): GridFundOverview {
  const levelsByType = deriveGridStatuses(strategy, executions, currentNav);

  // 统计所有网格层级
  let totalGridCount = 0;
  let executedCount = 0;
  let triggeredPendingCount = 0;
  let capitalDeployed = 0;

  // 找最近的触发价
  let nearestPrice = Infinity;
  let nearestDistance = Infinity;
  let nearestGridType: GridType = 'small';
  let nearestLevel = 1;

  for (const gridType of GRID_TYPES) {
    const levels = levelsByType[gridType];
    for (const level of levels) {
      totalGridCount++;

      // 已买入（持有中或可卖出）
      if (level.execution && !level.sellExecution) {
        executedCount++;
        capitalDeployed += level.investment;
      } else if (level.status === 'triggered') {
        triggeredPendingCount++;
      }

      // 找最近的未买入网格
      if (!level.execution) {
        const absDist = Math.abs(level.distance_pct);
        if (absDist < nearestDistance) {
          nearestDistance = absDist;
          nearestPrice = level.trigger_price;
          nearestGridType = gridType;
          nearestLevel = level.level;
        }
      }
    }
  }

  // 计算总预算
  const totalBudget =
    (strategy.grid_config.small?.grids.reduce((s, g) => s + g.investment, 0) || 0) +
    (strategy.grid_config.medium?.grids.reduce((s, g) => s + g.investment, 0) || 0) +
    (strategy.grid_config.large?.grids.reduce((s, g) => s + g.investment, 0) || 0);

  return {
    strategy,
    current_nav: currentNav,
    nearest_trigger: {
      price: nearestPrice,
      distance_pct: Math.round(((currentNav - nearestPrice) / nearestPrice) * 10000) / 100,
      grid_type: nearestGridType,
      level: nearestLevel,
    },
    total_budget: totalBudget,
    capital_deployed: capitalDeployed,
    executed_count: executedCount,
    total_grid_count: totalGridCount,
    triggered_pending_count: triggeredPendingCount,
  };
}

// ============================================
// 批量导入
// ============================================

export async function batchImportGridStrategies(
  jsonData: Array<{
    fund_code: string;
    fund_name: string;
    peak_price: number;
    bottom_price: number;
    grid_config: Record<GridType, GridTypeConfig>;
  }>
): Promise<{ success: number; errors: string[] }> {
  if (!isSupabaseConfigured()) {
    return { success: 0, errors: ['Supabase 未配置'] };
  }

  let success = 0;
  const errors: string[] = [];

  for (const item of jsonData) {
    try {
      // 检查是否已存在
      const { data: existing } = await supabase
        .from('grid_strategies')
        .select('id')
        .eq('fund_code', item.fund_code)
        .maybeSingle();

      if (existing) {
        // 更新现有策略
        const { error } = await (supabase
          .from('grid_strategies') as any)
          .update({
            fund_name: item.fund_name,
            peak_price: item.peak_price,
            bottom_price: item.bottom_price,
            grid_config: item.grid_config as any,
            is_active: true,
          })
          .eq('fund_code', item.fund_code);

        if (error) {
          errors.push(`${item.fund_code}: 更新失败 - ${error.message}`);
          continue;
        }
      } else {
        // 创建新策略
        const { error } = await (supabase
          .from('grid_strategies') as any)
          .insert({
            fund_code: item.fund_code,
            fund_name: item.fund_name,
            peak_price: item.peak_price,
            bottom_price: item.bottom_price,
            grid_config: item.grid_config as any,
            is_active: true,
          });

        if (error) {
          errors.push(`${item.fund_code}: 创建失败 - ${error.message}`);
          continue;
        }
      }

      success++;
    } catch (err) {
      errors.push(`${item.fund_code}: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  return { success, errors };
}

// ============================================
// 数据映射函数
// ============================================

function mapDbGridStrategy(row: any): GridStrategy {
  return {
    id: row.id,
    fund_code: row.fund_code,
    fund_name: row.fund_name,
    peak_price: Number(row.peak_price),
    bottom_price: Number(row.bottom_price),
    grid_config: row.grid_config as Record<GridType, GridTypeConfig>,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDbGridExecution(row: any): GridExecution {
  return {
    id: row.id,
    strategy_id: row.strategy_id,
    fund_code: row.fund_code,
    grid_type: row.grid_type,
    grid_level: row.grid_level,
    action: row.action,
    status: row.status,
    transaction_id: row.transaction_id,
    executed_nav: row.executed_nav ? Number(row.executed_nav) : undefined,
    executed_amount: row.executed_amount ? Number(row.executed_amount) : undefined,
    executed_shares: row.executed_shares ? Number(row.executed_shares) : undefined,
    remaining_shares: row.remaining_shares ? Number(row.remaining_shares) : undefined,
    executed_at: row.executed_at,
  };
}
