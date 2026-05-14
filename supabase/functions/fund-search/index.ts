/**
 * @fileoverview 基金搜索 Edge Function
 * @description 代理东方财富 API 搜索基金
 * @module functions/fund-search
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface FundSearchResult {
  code: string;
  name: string;
  type: string;
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '*';
  
  // 允许的域名列表
  const allowedOrigins = [
    'https://twmissingu.github.io',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  
  // 检查请求的 origin 是否在允许列表中
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
 * 处理基金搜索请求
 */
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: '仅支持 POST 请求' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
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

    const keyword = body.keyword;
    if (!keyword) {
      return new Response(
        JSON.stringify({ error: '搜索关键词不能为空' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const searchUrl = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=9&key=${encodeURIComponent(String(keyword))}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)',
        'Accept': 'application/json',
        'Referer': 'https://fund.eastmoney.com/',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`搜索 API 返回错误: ${response.status}`);
    }

    const result = await response.json();

    if (!result.Datas || result.Datas.length === 0) {
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    const funds: FundSearchResult[] = result.Datas
      .filter((item: any) => item.CODE && item.NAME)
      .map((item: any) => {
        const code = item.BACKCODE || item.FundBaseInfo?.FCODE || item.CODE;
        return {
          code,
          name: item.NAME,
          type: item.FundBaseInfo?.FTYPE || item.CATEGORYDESC || '基金',
        };
      });

    return new Response(JSON.stringify(funds), { headers: corsHeaders });
  } catch (error) {
    console.error('基金搜索失败:', { keyword: body?.keyword, error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: '基金搜索失败', message: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
