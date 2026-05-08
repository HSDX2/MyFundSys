import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Article } from '../../types';

// 动态导入被测模块，确保每次测试获得干净的模块状态
async function loadModule() {
  vi.resetModules();
  return import('../../services/articleService');
}

// Mock 文章数据（用于测试搜索/筛选，不依赖 loadLocalArticles 返回值）
const mockArticles: Article[] = [
  {
    id: 't001',
    title: '钻石坑与估值',
    date: '2023-01-01',
    url: 'https://example.com/1',
    source: 'chinaetfs',
    category: '估值体系',
    content: '全市场PE小于25时是钻石坑，应该贪婪。止损很重要，仓位管理是关键。',
    tags: ['估值', 'PE', '贪婪'],
  },
  {
    id: 't002',
    title: '网格交易策略',
    date: '2023-02-01',
    url: 'https://example.com/2',
    source: 'xueqiu',
    category: '交易策略',
    content: '网格交易适合震荡市，需要设置合理的网格大小。',
    tags: ['网格', '策略', '震荡市'],
  },
  {
    id: 't003',
    title: '投资心理与恐惧',
    date: '2023-03-01',
    url: 'https://example.com/3',
    source: 'weibo',
    category: '投资心理',
    content: '恐惧和贪婪是投资者最大的敌人，心态决定成败。',
    tags: ['心理', '恐惧', '心态'],
  },
  {
    id: 't004',
    title: '资产配置指南',
    date: '2023-04-01',
    url: 'https://example.com/4',
    source: 'qieman',
    category: '资产配置',
    content: '分散投资，不要把鸡蛋放在一个篮子里。ETF是不错的选择。',
    tags: ['资产配置', 'ETF', '分散'],
  },
];

describe('articleService', () => {
  let articleService: Awaited<ReturnType<typeof loadModule>>;

  beforeEach(async () => {
    articleService = await loadModule();
  });

  // ==========================================
  // loadLocalArticles
  // ==========================================
  describe('loadLocalArticles', () => {
    test('返回包含8篇文章的非空数组', async () => {
      const articles = await articleService.loadLocalArticles();
      expect(articles).toBeInstanceOf(Array);
      expect(articles.length).toBe(8);
    });

    test('每篇文章包含必需的字段', async () => {
      const articles = await articleService.loadLocalArticles();
      for (const article of articles) {
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('date');
        expect(article).toHaveProperty('url');
        expect(article).toHaveProperty('source');
        expect(article).toHaveProperty('category');
        expect(article).toHaveProperty('content');
        expect(article).toHaveProperty('tags');
      }
    });
  });

  // ==========================================
  // searchArticles
  // ==========================================
  describe('searchArticles', () => {
    test('按标题搜索返回匹配文章', () => {
      const result = articleService.searchArticles(mockArticles, '钻石坑');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t001');
    });

    test('按内容搜索返回匹配文章', () => {
      const result = articleService.searchArticles(mockArticles, '震荡市');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t002');
    });

    test('按标签搜索返回匹配文章', () => {
      const result = articleService.searchArticles(mockArticles, '恐惧');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t003');
    });

    test('空查询字符串返回所有文章', () => {
      const result = articleService.searchArticles(mockArticles, '');
      expect(result).toHaveLength(mockArticles.length);
    });

    test('无匹配查询返回空数组', () => {
      const result = articleService.searchArticles(mockArticles, '不存在的词');
      expect(result).toEqual([]);
    });

    test('搜索大小写不敏感', () => {
      const lower = articleService.searchArticles(mockArticles, '钻石坑');
      const upper = articleService.searchArticles(mockArticles, '钻石坑'.toUpperCase());
      expect(lower.length).toBe(upper.length);
    });

    test('在空数组上搜索返回空数组', () => {
      const result = articleService.searchArticles([], '任何词');
      expect(result).toEqual([]);
    });

    test('多字段同时匹配时只返回一次', () => {
      // "估值" 同时出现在标题、内容、标签中，应只返回一次
      const result = articleService.searchArticles(mockArticles, '估值');
      expect(result.length).toBe(1);
    });
  });

  // ==========================================
  // filterArticlesBySource
  // ==========================================
  describe('filterArticlesBySource', () => {
    test("source='all' 返回所有文章", () => {
      const result = articleService.filterArticlesBySource(mockArticles, 'all');
      expect(result).toHaveLength(mockArticles.length);
    });

    test('筛选存在的 source 返回对应文章', () => {
      const result = articleService.filterArticlesBySource(mockArticles, 'chinaetfs');
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('chinaetfs');
    });

    test('筛选不存在的 source 返回空数组', () => {
      const result = articleService.filterArticlesBySource(mockArticles, 'nonexistent');
      expect(result).toEqual([]);
    });

    test('空数组输入返回空数组', () => {
      const result = articleService.filterArticlesBySource([], 'chinaetfs');
      expect(result).toEqual([]);
    });

    test('正确区分不同 source', () => {
      const xueqiu = articleService.filterArticlesBySource(mockArticles, 'xueqiu');
      const weibo = articleService.filterArticlesBySource(mockArticles, 'weibo');
      expect(xueqiu).toHaveLength(1);
      expect(weibo).toHaveLength(1);
      expect(xueqiu[0].id).not.toBe(weibo[0].id);
    });
  });

  // ==========================================
  // filterArticlesByCategory
  // ==========================================
  describe('filterArticlesByCategory', () => {
    test("category='all' 返回所有文章", () => {
      const result = articleService.filterArticlesByCategory(mockArticles, 'all');
      expect(result).toHaveLength(mockArticles.length);
    });

    test('筛选存在的 category 返回对应文章', () => {
      const result = articleService.filterArticlesByCategory(mockArticles, '交易策略');
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('交易策略');
    });

    test('筛选不存在的 category 返回空数组', () => {
      const result = articleService.filterArticlesByCategory(mockArticles, '不存在的分类');
      expect(result).toEqual([]);
    });

    test('空数组输入返回空数组', () => {
      const result = articleService.filterArticlesByCategory([], '估值体系');
      expect(result).toEqual([]);
    });
  });

  // ==========================================
  // parseArticleMarkdown
  // ==========================================
  describe('parseArticleMarkdown', () => {
    test('正确解析 frontmatter 和正文', () => {
      const markdown = `---\ntitle: 测试标题\ndate: 2024-01-01\nurl: https://example.com\nsource: chinaetfs\ncategory: 测试分类\n---\n这是正文内容。`;
      const result = articleService.parseArticleMarkdown(markdown, 'test.md');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('测试标题');
      expect(result!.date).toBe('2024-01-01');
      expect(result!.url).toBe('https://example.com');
      expect(result!.source).toBe('chinaetfs');
      expect(result!.category).toBe('测试分类');
      expect(result!.content).toBe('这是正文内容。');
      expect(result!.id).toContain('test');
    });

    test('缺少 frontmatter 返回 null', () => {
      const result = articleService.parseArticleMarkdown('没有 frontmatter 的内容', 'test.md');
      expect(result).toBeNull();
    });

    test('异常内容不抛出错误返回 null', () => {
      const result = articleService.parseArticleMarkdown('', 'test.md');
      expect(result).toBeNull();
    });

    test('内容长度限制在2000字符', () => {
      const longBody = 'a'.repeat(5000);
      const markdown = `---\ntitle: 长文\ndate: 2024-01-01\nurl: \nsource: \ncategory: \n---\n${longBody}`;
      const result = articleService.parseArticleMarkdown(markdown, 'long.md');
      expect(result).not.toBeNull();
      expect(result!.content.length).toBeLessThanOrEqual(2000);
    });

    test('缺少可选字段时使用默认值', () => {
      const markdown = `---\ntitle: \ndate: 2024-01-01\nurl: https://example.com\nsource: \ncategory: \n---\n正文`;
      const result = articleService.parseArticleMarkdown(markdown, 'empty.md');
      expect(result).not.toBeNull();
      // title 为空字符串时回退到 '无标题'
      expect(result!.title).toBe('无标题');
      expect(result!.source).toBe('unknown');
      expect(result!.category).toBe('其他');
    });
  });

  // ==========================================
  // extractTags
  // ==========================================
  describe('extractTags', () => {
    test('匹配关键词映射', () => {
      const tags = articleService.extractTags('今天PE估值很高，应该关注市盈率。');
      expect(tags).toContain('估值');
    });

    test('匹配多个关键词', () => {
      const tags = articleService.extractTags('网格交易策略很重要，心理心态决定成败。');
      expect(tags).toContain('策略');
      expect(tags).toContain('心理');
    });

    test('无匹配返回空数组', () => {
      const tags = articleService.extractTags('今天天气真好。');
      expect(tags).toEqual([]);
    });

    test('最多返回5个标签', () => {
      const tags = articleService.extractTags(
        '估值PE和策略网格，心理恐惧与风险管理，指数ETF沪深300，止损回撤仓位'
      );
      expect(tags.length).toBeLessThanOrEqual(5);
    });
  });
});
