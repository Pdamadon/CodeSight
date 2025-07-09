const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  try {
    const siteUrl = 'https://www.terrabellaflowers.com';
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract all navigation/category links
    const navLinks = await page.evaluate(() => {
      const selectors = [
        'nav a',
        '.header a',
        '.site-nav a',
        '.main-menu a',
        '.menu a',
        '.NavigationMenu a',
        '.site-header__nav a',
        '.footer a'
      ];
      const links = [];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(a => {
          if (a.href && a.textContent.trim()) {
            links.push({
              href: a.href,
              text: a.textContent.trim()
            });
          }
        });
      });
      // Remove duplicates by href
      const seen = new Set();
      return links.filter(link => {
        if (seen.has(link.href)) return false;
        seen.add(link.href);
        return true;
      });
    });

    // Filter for floral-related categories
    const floralKeywords = ['flower', 'floral', 'bouquet', 'rose', 'tulip', 'lily', 'plant', 'arrangement', 'orchid', 'succulent'];
    const floralLinks = navLinks.filter(link =>
      floralKeywords.some(keyword => link.text.toLowerCase().includes(keyword) || link.href.toLowerCase().includes(keyword))
    );

    console.log('\n🌸 Floral-related categories:');
    floralLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text} — ${link.href}`);
    });

    fs.writeFileSync('terra-bella-floral-categories.json', JSON.stringify(floralLinks, null, 2));
    console.log('\n✅ Saved to terra-bella-floral-categories.json');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    // await browser.close();
  }
})(); 