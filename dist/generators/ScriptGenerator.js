export class ScriptGenerator {
    async generateScript(request) {
        if (request.outputFormat === 'playwright') {
            return this.generatePlaywrightScript(request);
        }
        else {
            return this.generatePuppeteerScript(request);
        }
    }
    generatePlaywrightScript(request) {
        const { url, selectors } = request;
        const selectorExtractions = Object.entries(selectors)
            .map(([target, selector]) => {
            return `
    // Extract ${target}
    const ${target}Element = await page.locator('${selector}').first();
    const ${target} = await ${target}Element.isVisible() ? {
      text: await ${target}Element.textContent(),
      href: await ${target}Element.getAttribute('href'),
      src: await ${target}Element.getAttribute('src'),
      value: await ${target}Element.getAttribute('value')
    } : null;`;
        })
            .join('\n');
        const dataObject = Object.keys(selectors)
            .map(target => `    ${target}`)
            .join(',\n');
        return `import { chromium } from 'playwright';

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the page
    await page.goto('${url}', { waitUntil: 'networkidle' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
${selectorExtractions}
    
    // Collect results
    const results = {
${dataObject}
    };
    
    console.log('Scraped data:', JSON.stringify(results, null, 2));
    return results;
    
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrape().catch(console.error);`;
    }
    generatePuppeteerScript(request) {
        const { url, selectors } = request;
        const selectorExtractions = Object.entries(selectors)
            .map(([target, selector]) => {
            return `
    // Extract ${target}
    const ${target} = await page.evaluate((sel) => {
      const element = document.querySelector(sel);
      if (!element) return null;
      return {
        text: element.textContent?.trim(),
        href: element.getAttribute('href'),
        src: element.getAttribute('src'),
        value: element.getAttribute('value')
      };
    }, '${selector}');`;
        })
            .join('\n');
        const dataObject = Object.keys(selectors)
            .map(target => `    ${target}`)
            .join(',\n');
        return `const puppeteer = require('puppeteer');

async function scrape() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the page
    await page.goto('${url}', { waitUntil: 'networkidle0' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
${selectorExtractions}
    
    // Collect results
    const results = {
${dataObject}
    };
    
    console.log('Scraped data:', JSON.stringify(results, null, 2));
    return results;
    
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the scraper
scrape().catch(console.error);`;
    }
}
//# sourceMappingURL=ScriptGenerator.js.map