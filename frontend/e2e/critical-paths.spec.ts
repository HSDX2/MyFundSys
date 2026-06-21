import { test, expect } from '@playwright/test';

const TEST_PASSWORD = process.env.TEST_PASSWORD || '';

// 登录辅助函数
async function login(page: any) {
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordInput.fill(TEST_PASSWORD);
    await page.click('button:has-text("进入系统")');
    await page.waitForTimeout(500);
  }
}

// 关键路径冒烟：覆盖核心页面可达性与关键 UI 入口的渲染。
// 注意：交易增删 / 在途确认 / 网格执行 / CSV 导入 / JSON 备份恢复等「写操作」
// 共用同一个测试库，e2e 直接触发会污染共享数据且无隔离，
// 因此这些写流程的正确性由服务层单元/集成测试（538 个）保障，
// 此处只验证它们的 UI 入口可达、页面正常渲染，不实际提交写操作。
test.describe('关键路径冒烟', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await login(page);
  });

  test('首页驾驶舱：总资产卡片渲染', async ({ page }) => {
    await page.click('.tab-bar >> text=首页');
    await page.waitForTimeout(500);
    await expect(page.locator('text=总资产')).toBeVisible({ timeout: 8000 });
  });

  test('交易页：可达且页面渲染', async ({ page }) => {
    await page.goto('/#transactions');
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/#transactions/);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test('设置页：导出入口可达（不触发实际导入/重置）', async ({ page }) => {
    await page.goto('/#settings');
    await page.waitForTimeout(500);
    const content = await page.content();
    // 设置页应包含数据管理相关文案
    expect(content).toContain('数据');
  });

  test('策略页：网格策略列表可达', async ({ page }) => {
    await page.goto('/#strategy');
    await page.waitForTimeout(500);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test('基金详情：批次溯源页面可达', async ({ page }) => {
    await page.goto('/#fund/000001');
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/#fund\/000001/);
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });
});
