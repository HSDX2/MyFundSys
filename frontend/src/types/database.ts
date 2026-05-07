/**
 * @fileoverview Supabase 数据库类型定义
 * @description 定义数据库表结构和类型
 * @module types/database
 */

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          type: 'buy' | 'sell';
          shares: number;
          nav: number;
          amount: number;
          fee: number;
          date: string;
          confirm_date: string | null;
          status: 'pending' | 'completed';
          source: string;
          grid_execution_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fund_code: string;
          fund_name: string;
          type: 'buy' | 'sell';
          shares: number;
          nav: number;
          amount: number;
          fee?: number;
          date: string;
          confirm_date?: string | null;
          status?: 'pending' | 'completed';
          source?: string;
          grid_execution_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      holdings: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          shares: number;
          avg_nav: number;
          total_cost: number;
          current_nav: number | null;
          market_value: number | null;
          profit: number | null;
          profit_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fund_code: string;
          fund_name: string;
          shares: number;
          avg_nav?: number;
          total_cost?: number;
          current_nav?: number | null;
          market_value?: number | null;
          profit?: number | null;
          profit_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['holdings']['Insert']>;
      };
      favorite_funds: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fund_code: string;
          fund_name: string;
          category?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['favorite_funds']['Insert']>;
      };
      grid_strategies: {
        Row: {
          id: string;
          fund_code: string;
          fund_name: string;
          peak_price: number;
          bottom_price: number;
          grid_config: Record<string, unknown>;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fund_code: string;
          fund_name: string;
          peak_price: number;
          bottom_price: number;
          grid_config: Record<string, unknown>;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['grid_strategies']['Insert']>;
      };
      grid_executions: {
        Row: {
          id: string;
          strategy_id: string;
          fund_code: string;
          grid_type: 'small' | 'medium' | 'large';
          grid_level: number;
          action: 'buy' | 'sell';
          status: 'pending' | 'executed' | 'cancelled';
          transaction_id: string | null;
          executed_nav: number | null;
          executed_amount: number | null;
          executed_shares: number | null;
          remaining_shares: number | null;
          executed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          strategy_id: string;
          fund_code: string;
          grid_type: 'small' | 'medium' | 'large';
          grid_level: number;
          action: 'buy' | 'sell';
          status?: 'pending' | 'executed' | 'cancelled';
          transaction_id?: string | null;
          executed_nav?: number | null;
          executed_amount?: number | null;
          executed_shares?: number | null;
          remaining_shares?: number | null;
          executed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['grid_executions']['Insert']>;
      };
    };
  };
}
