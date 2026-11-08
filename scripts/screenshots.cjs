// Скриншоты создаются из файлов того же коммита, который запустил workflow.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '..');
const outputDir = process.env.SKORO_SCREENSHOTS_DIR || path.join(projectRoot, 'screenshots');
const siteUrl = pathToFileURL(path.join(projectRoot, 'index.html')).href;
const screens = [
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

async function createScreenshots() {
  fs.mkdirSync(outputDir, { recursive: true });
  const executablePath = process.env.SKORO_CHROMIUM_PATH;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  try {
    for (const screen of screens) {
      // Отдельная сессия исключает влияние сохранённой темы и корзины.
      const context = await browser.newContext({
        viewport: { width: screen.width, height: screen.height },
        colorScheme: 'light',
        deviceScaleFactor: 1,
      });

      try {
        const page = await context.newPage();
        await page.goto(siteUrl, { waitUntil: 'load' });
        await page.locator('.restaurant-card').first().waitFor({ state: 'visible' });

        // Загрузить шрифты и отложенные изображения до съёмки всей страницы.
        await page.evaluate(async () => {
          document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
          await document.fonts.ready;
          await Promise.all([...document.images].map(image => image.decode()));
        });

        const file = path.join(outputDir, `${screen.name}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });
        console.log(`Создан ${screen.name}.png (${screen.width}×${screen.height})`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

createScreenshots().catch(error => {
  console.error('Не удалось создать скриншоты:', error);
  process.exitCode = 1;
});
