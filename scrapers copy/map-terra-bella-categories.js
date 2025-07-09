const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  try {
    const siteUrl = 'https://www.terrabellaflowers.com';
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 1. Look for a button or link with text like 'All Products', 'All Flowers', 'Shop All', etc.
    const allProductsLink = await page.evaluate(() => {
      const keywords = ['all products', 'all flowers', 'shop all', 'all occasions', 'all', 'shop flowers'];
      // Search for <a> and <button> elements
      const elements = [
        ...Array.from(document.querySelectorAll('a, button'))
      ];
      for (const el of elements) {
        const text = el.textContent?.trim().toLowerCase();
        if (text) {
          for (const keyword of keywords) {
            if (text === keyword || text.includes(keyword)) {
              return {
                href: el.href || el.getAttribute('href') || null,
                text: el.textContent.trim()
              };
            }
          }
        }
      }
      return null;
    });

    const fs = require('fs');

    if (allProductsLink && allProductsLink.href) {
      console.log('\n🌸 Found ALL PRODUCTS button/link:');
      console.log(`${allProductsLink.text} — ${allProductsLink.href}`);
      fs.writeFileSync('terra-bella-all-products-link.json', JSON.stringify(allProductsLink, null, 2));
      console.log('\n✅ Saved to terra-bella-all-products-link.json');

      // Go to the All Products page and extract product cards
      await page.goto(allProductsLink.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);

      const products = await page.evaluate(() => {
        // Try common product card selectors
        const selectors = [
          '.ProductItem',
          '.product-item',
          '.product-card',
          '.product',
          '[data-product-id]'
        ];
        let productCards = [];
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            productCards = Array.from(found);
            break;
          }
        }
        // Extract info from each card
        return productCards.map(card => {
          // Name/title
          let name = '';
          const nameSelectors = ['.ProductItem__Title', '.product-title', '.product-name', 'h1', 'h2', 'h3'];
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim()) {
              name = el.textContent.trim();
              break;
            }
          }
          // Price
          let price = '';
          const priceSelectors = ['.ProductItem__Price', '.price', '.product-price', '[class*="price"]'];
          for (const sel of priceSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim()) {
              price = el.textContent.trim();
              break;
            }
          }
          // Image
          let image = '';
          const imgEl = card.querySelector('img');
          if (imgEl) {
            image = imgEl.src || imgEl.getAttribute('data-src') || '';
          }
          // Product URL
          let url = '';
          const linkEl = card.querySelector('a');
          if (linkEl) {
            url = linkEl.href;
          }
          return { name, price, image, url };
        }).filter(p => p.name && p.url);
      });

      console.log(`\n🛒 Found ${products.length} products on All Products page.`);
      fs.writeFileSync('terra-bella-products.json', JSON.stringify(products, null, 2));
      console.log('\n✅ Saved to terra-bella-products.json');
    } else {
      // Fallback: extract all navigation/category links as before
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

      console.log('\n🌸 No ALL PRODUCTS button found. Floral-related categories:');
      floralLinks.forEach((link, i) => {
        console.log(`${i + 1}. ${link.text} — ${link.href}`);
      });

      fs.writeFileSync('terra-bella-floral-categories.json', JSON.stringify(floralLinks, null, 2));
      console.log('\n✅ Saved to terra-bella-floral-categories.json');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    // await browser.close();
  }
})(); 