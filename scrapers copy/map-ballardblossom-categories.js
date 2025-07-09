const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  try {
    const siteUrl = 'https://ballardblossom.com';
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
        '.footer a',
        '.quick-shop a',
        '.product-categories a'
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

    // Filter for product-related categories
    const productKeywords = [
      'product', 'flower', 'floral', 'bouquet', 'rose', 'tulip', 'lily', 
      'plant', 'arrangement', 'orchid', 'succulent', 'occasion', 'birthday',
      'anniversary', 'wedding', 'sympathy', 'gift', 'centerpiece', 'corsage'
    ];
    const productLinks = navLinks.filter(link =>
      productKeywords.some(keyword => 
        link.text.toLowerCase().includes(keyword) || 
        link.href.toLowerCase().includes(keyword)
      )
    );

    console.log('\n🌸 Ballard Blossom product categories:');
    productLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text} — ${link.href}`);
    });

    fs.writeFileSync('ballardblossom-categories.json', JSON.stringify(productLinks, null, 2));
    console.log('\n✅ Saved to ballardblossom-categories.json');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    // await browser.close();
  }
})(); 