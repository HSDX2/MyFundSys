/**
 * @fileoverview 基金历史净值查询 Edge Function
 * @description 代理东方财富 API 获取基金历史净值数据，解决前端 CORS 限制
 * @module functions/fund-history
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface FundHistoryRecord {
  date: string;         // 净值日期
  nav: number;          // 单位净值
  accNav: number;       // 累计净值
  dailyChangeRate: number; // 日涨跌幅(%)
  buyStatus: string;    // 申购状态
  sellStatus: string;   // 赎回状态
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '*';

  const allowedOrigins = [
    'https://twmissingu.github.io',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

/**
 * 处理基金历史净值查询请求
 */
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: '仅支持 POST 请求' }),
      { status: 405, headers: corsHeaders }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: '请求体必须是有效的 JSON' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const code = String(body.code || '').trim();
    const pageIndex = body.pageIndex ?? 1;
    const pageSize = body.pageSize ?? 20;
    const startDate = body.startDate ? String(body.startDate) : '';
    const endDate = body.endDate ? String(body.endDate) : '';

    if (!code) {
      return new Response(
        JSON.stringify({ error: '基金代码不能为空' }),
        { status: 400, headers: corsHeaders }
      );
    }

    let historyUrl = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(code)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
    if (startDate) historyUrl += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) historyUrl += `&endDate=${encodeURIComponent(endDate)}`;
    historyUrl += `&_=${Date.now()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(historyUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)',
        'Accept': 'application/json',
        'Referer': 'https://fund.eastmoney.com/',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`东方财富 API 返回错误: ${response.status}`);
    }

    const result = await response.json();

    if (!result.Data || !result.Data.LSJZList) {
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    const records: FundHistoryRecord[] = result.Data.LSJZList
      .filter((item: any) => item.FSRQ && item.DWJZ)
      .map((item: any) => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ) || 0,
        accNav: parseFloat(item.LJJZ || '0') || 0,
        dailyChangeRate: parseFloat(item.JZZZL || '0') || 0,
        buyStatus: item.SGZT || '-',
        sellStatus: item.SHZT || '-',
      }));

    return new Response(JSON.stringify(records), { headers: corsHeaders });
  } catch (error) {
    console.error('获取历史净值失败:', { code: body.code, error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: '获取历史净值失败', message: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
