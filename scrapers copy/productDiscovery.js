// Load environment variables
require('dotenv').config();

const { chromium } = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');

// Check if OpenAI API key is available
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  console.error('Please add your OpenAI API key to the .env file');
  console.error('Get your API key at: https://platform.openai.com/api-keys');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced site configurations with specific selectors and patterns
const SITE_CONFIGS = {
  '1800flowers.com': {
    name: '1800 Flowers',
    searchPatterns: [
      '/roses',
      '/flowers',
      '/tulips',
      '/lilies',
      '/mixed-flowers',
      '/search?q=',
      '/collections/all?q='
    ],
    productSelectors: [
      'div[data-component="desktopSimpleProduct"]',
      '.product-tile',
      '.product-item',
      '[data-product-id]',
      '.product-card'
    ],
    titleSelectors: [
      'img[data-component="productImage"]',
      '.product-title',
      '.product-name',
      'h1, h2, h3'
    ],
    priceSelectors: [
      '[data-component="price"]',
      '.price',
      '.product-price',
      '[class*="price"]'
    ],
    imageSelectors: [
      'img[data-component="productImage"]',
      '.product-image img',
      'img[alt*="product"]'
    ],
    linkSelectors: [
      'a[data-testid]',
      '.product-link',
      'a[href*="/product"]'
    ]
  },
  'terrabellaflowers.com': {
    name: 'Terra Bella Flowers',
    searchPatterns: [
      '/collections/roses',
      '/collections/flowers',
      '/collections/tulips',
      '/search?q=',
      '/collections/all?q='
    ],
    productSelectors: [
      '.ProductItem',
      '.product-item',
      '.product-card',
      '.product',
      '[data-product-id]'
    ],
    titleSelectors: [
      '.ProductItem__Title',
      '.product-title',
      '.product-name',
      'h1, h2, h3'
    ],
    priceSelectors: [
      '.ProductItem__Price',
      '.price',
      '.product-price',
      '[class*="price"]'
    ],
    imageSelectors: [
      '.ProductItem__Image img',
      '.product-image img',
      'img[alt*="product"]',
      '.product img'
    ],
    linkSelectors: [
      '.ProductItem__Link',
      '.product-link',
      'a[href*="/product"]',
      'a[href*="/products"]'
    ]
  },
  'ftd.com': {
    name: 'FTD',
    searchPatterns: [
      '/roses',
      '/flowers',
      '/tulips',
      '/lilies',
      '/search?q='
    ],
    productSelectors: [
      '.product-item',
      '.product-card',
      '.product',
      '[data-product-id]'
    ],
    titleSelectors: [
      '.product-title',
      '.product-name',
      'h1, h2, h3'
    ],
    priceSelectors: [
      '.price',
      '.product-price',
      '[class*="price"]'
    ],
    imageSelectors: [
      '.product-image img',
      'img[alt*="product"]',
      '.product img'
    ],
    linkSelectors: [
      '.product-link',
      'a[href*="/product"]'
    ]
  },
  'proflowers.com': {
    name: 'ProFlowers',
    searchPatterns: [
      '/roses',
      '/flowers',
      '/tulips',
      '/lilies',
      '/search?q='
    ],
    productSelectors: [
      '.product-item',
      '.product-card',
      '.product',
      '[data-product-id]'
    ],
    titleSelectors: [
      '.product-title',
      '.product-name',
      'h1, h2, h3'
    ],
    priceSelectors: [
      '.price',
      '.product-price',
      '[class*="price"]'
    ],
    imageSelectors: [
      '.product-image img',
      'img[alt*="product"]',
      '.product img'
    ],
    linkSelectors: [
      '.product-link',
      'a[href*="/product"]'
    ]
  },
  'teleflora.com': {
    name: 'Teleflora',
    searchPatterns: [
      '/roses',
      '/flowers',
      '/tulips',
      '/lilies',
      '/search?q='
    ],
    productSelectors: [
      '.product-item',
      '.product-card',
      '.product',
      '[data-product-id]'
    ],
    titleSelectors: [
      '.product-title',
      '.product-name',
      'h1, h2, h3'
    ],
    priceSelectors: [
      '.price',
      '.product-price',
      '[class*="price"]'
    ],
    imageSelectors: [
      '.product-image img',
      'img[alt*="product"]',
      '.product img'
    ],
    linkSelectors: [
      '.product-link',
      'a[href*="/product"]'
    ]
  }
};

class ProductDiscovery {
  constructor() {
    this.browser = null;
    this.context = null;
    this.retryAttempts = 3;
    this.timeout = 30000;
  }

  async initialize() {
    console.log('\x1b[36m[ProductDiscovery] Initializing browser...\x1b[0m');
    this.browser = await chromium.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
  }

  async close() {
    if (this.browser) {
      console.log('\x1b[36m[ProductDiscovery] Closing browser...\x1b[0m');
      await this.browser.close();
    }
  }

  /**
   * Parse natural language request into structured product requirements
   */
  async parseProductRequest(userRequest) {
    console.log(`\x1b[34m[ProductDiscovery] Parsing user request:\x1b[0m ${userRequest}`);
    try {
      const prompt = `
        Parse this product request and extract structured information:
        "${userRequest}"
        
        Return a JSON object with:
        - productType: main product category (e.g., "roses", "tulips", "mixed flowers")
        - quantity: number of items (extract from text or default to 1)
        - color: color preference if mentioned
        - size: size preference if mentioned (small, medium, large)
        - occasion: special occasion if mentioned (birthday, anniversary, etc.)
        - budget: price range if mentioned
        - urgency: delivery urgency if mentioned
        
        Only include fields that are explicitly mentioned or can be reasonably inferred.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content;
      const parsed = JSON.parse(response);
      console.log(`\x1b[32m[ProductDiscovery] Parsed requirements:\x1b[0m`, parsed);
      return parsed;
    } catch (error) {
      console.error('\x1b[31m[ProductDiscovery] Error parsing product request:\x1b[0m', error);
      // Fallback to basic parsing
      return this.fallbackParse(userRequest);
    }
  }

  /**
   * Fallback parsing using regex and basic NLP
   */
  fallbackParse(userRequest) {
    const request = userRequest.toLowerCase();
    const result = {
      productType: 'flowers',
      quantity: 1,
    };

    // Extract quantity
    const quantityMatch = request.match(/(\d+)\s*(roses?|flowers?|tulips?|lilies?)/i);
    if (quantityMatch) {
      result.quantity = parseInt(quantityMatch[1]);
      result.productType = quantityMatch[2];
    }

    // Extract color
    const colors = ['red', 'pink', 'white', 'yellow', 'purple', 'orange', 'blue'];
    for (const color of colors) {
      if (request.includes(color)) {
        result.color = color;
        break;
      }
    }

    // Extract occasion
    const occasions = ['birthday', 'anniversary', 'wedding', 'funeral', 'valentine', 'mother', 'father'];
    for (const occasion of occasions) {
      if (request.includes(occasion)) {
        result.occasion = occasion;
        break;
      }
    }

    return result;
  }

  /**
   * Search for products across multiple flower delivery sites
   */
  async searchProducts(productRequirements) {
    console.log(`\x1b[34m[ProductDiscovery] Searching products for requirements:\x1b[0m`, productRequirements);
    const searchResults = [];
    
    // List of flower delivery sites to search
    const flowerSites = [
      'https://www.terrabellaflowers.com',
      'https://www.1800flowers.com',
      'https://www.ftd.com',
      'https://www.proflowers.com',
      'https://www.teleflora.com'
    ];

    for (const site of flowerSites) {
      try {
        console.log(`\x1b[36m[ProductDiscovery] Searching site:\x1b[0m ${site}`);
        const results = await this.searchSite(site, productRequirements);
        console.log(`\x1b[32m[ProductDiscovery] Found ${results.length} products on ${site}\x1b[0m`);
        searchResults.push(...results);
      } catch (error) {
        console.error(`\x1b[31m[ProductDiscovery] Error searching ${site}:\x1b[0m`, error.message);
      }
    }

    console.log(`\x1b[34m[ProductDiscovery] Total products found across all sites:\x1b[0m ${searchResults.length}`);
    return searchResults;
  }

  /**
   * Search a specific site for products with enhanced error handling and retry logic
   */
  async searchSite(siteUrl, requirements) {
    console.log(`\x1b[36m[ProductDiscovery] Scraping site:\x1b[0m ${siteUrl}`);
    const page = await this.context.newPage();
    const results = [];

    try {
      // Get site configuration
      const siteConfig = this.getSiteConfig(siteUrl);
      console.log(`\x1b[36m[ProductDiscovery] Using config for:\x1b[0m ${siteConfig.name}`);
      
      // Generate search URLs
      const searchUrls = this.generateSearchUrls(siteUrl, requirements, siteConfig);
      
      for (const searchUrl of searchUrls) {
        try {
          console.log(`\x1b[36m[ProductDiscovery] Trying search URL:\x1b[0m ${searchUrl}`);
          
          // Navigate to the page with retry logic
          const response = await this.navigateWithRetry(page, searchUrl);
          if (!response) continue;
          
          console.log(`\x1b[36m[ProductDiscovery] Response status:\x1b[0m ${response.status()}`);
          
          // Wait for content to load
          await this.waitForContent(page);
          
          // Take screenshot for debugging
          await this.takeScreenshot(page, siteUrl);
          
          // Save HTML for analysis
          await this.saveHtml(page, siteUrl);
          
          // Extract products using site-specific selectors
          const products = await this.extractProducts(page, siteConfig);
          
          console.log(`\x1b[36m[ProductDiscovery] Found ${products.length} products on page\x1b[0m`);
          
          // Calculate relevance scores and add site info
          for (const product of products) {
            product.relevance = this.calculateRelevance(product, requirements);
            product.site = siteUrl;
            product.siteName = siteConfig.name;
          }

          results.push(...products);
          
          if (products.length > 0) {
            console.log(`\x1b[32m[ProductDiscovery] Successfully found products with URL ${searchUrl}\x1b[0m`);
            break; // If successful, don't try other URLs
          }
          
        } catch (error) {
          console.log(`\x1b[33m[ProductDiscovery] Search URL ${searchUrl} failed for ${siteUrl}: ${error.message}\x1b[0m`);
        }
      }

    } catch (error) {
      console.error(`\x1b[31m[ProductDiscovery] Error scraping ${siteUrl}:\x1b[0m`, error.message);
    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * Get site-specific configuration
   */
  getSiteConfig(siteUrl) {
    const hostname = new URL(siteUrl).hostname.replace('www.', '');
    console.log(`\x1b[36m[ProductDiscovery] Extracted hostname: ${hostname}\x1b[0m`);
    const config = SITE_CONFIGS[hostname];
    if (config) {
      console.log(`\x1b[32m[ProductDiscovery] Found specific config for ${hostname}\x1b[0m`);
      return config;
    }
    
    console.log(`\x1b[33m[ProductDiscovery] Using generic config for ${hostname}\x1b[0m`);
    return {
      name: 'Generic Site',
      searchPatterns: ['/search?q=', '/collections/all?q='],
      productSelectors: ['.product', '.product-item', '.product-card'],
      titleSelectors: ['.product-title', '.product-name', 'h1, h2, h3'],
      priceSelectors: ['.price', '.product-price'],
      imageSelectors: ['.product-image img', 'img[alt*="product"]'],
      linkSelectors: ['.product-link', 'a[href*="/product"]']
    };
  }

  /**
   * Generate search URLs for a site
   */
  generateSearchUrls(siteUrl, requirements, siteConfig) {
    const urls = [];
    const productType = requirements.productType || 'flowers';
    
    // Add site-specific patterns
    for (const pattern of siteConfig.searchPatterns) {
      if (pattern.includes('?')) {
        // Search pattern
        urls.push(`${siteUrl}${pattern}${encodeURIComponent(productType)}`);
      } else {
        // Category pattern
        urls.push(`${siteUrl}${pattern}`);
      }
    }
    
    // Add color-specific URLs if color is specified
    if (requirements.color) {
      urls.push(`${siteUrl}/${requirements.color}-${productType}`);
      urls.push(`${siteUrl}/${productType}/${requirements.color}`);
    }
    
    return urls;
  }

  /**
   * Navigate to page with retry logic
   */
  async navigateWithRetry(page, url) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`\x1b[36m[ProductDiscovery] Navigation attempt ${attempt}/${this.retryAttempts} to ${url}\x1b[0m`);
        
        const response = await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: this.timeout 
        });
        
        // Check if we got a successful response
        if (response && response.status() < 400) {
          console.log(`\x1b[32m[ProductDiscovery] Navigation successful on attempt ${attempt}\x1b[0m`);
          return response;
        } else {
          console.log(`\x1b[33m[ProductDiscovery] Got status ${response?.status()} on attempt ${attempt}\x1b[0m`);
        }
      } catch (error) {
        console.log(`\x1b[33m[ProductDiscovery] Navigation failed on attempt ${attempt}: ${error.message}\x1b[0m`);
        if (attempt === this.retryAttempts) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
    return null;
  }

  /**
   * Wait for content to load
   */
  async waitForContent(page) {
    try {
      // Wait for any of the common product selectors to appear
      await page.waitForSelector('.product, .product-item, .product-card, [data-product-id], div[data-component="desktopSimpleProduct"]', {
        timeout: 10000,
        state: 'visible'
      });
    } catch (error) {
      console.log(`\x1b[33m[ProductDiscovery] No product selectors found, continuing anyway...\x1b[0m`);
    }
    
    // Additional wait for dynamic content
    await page.waitForTimeout(3000);
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(page, siteUrl) {
    try {
      const hostname = new URL(siteUrl).hostname;
      const screenshotPath = `debug-${hostname}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`\x1b[36m[ProductDiscovery] Screenshot saved:\x1b[0m ${screenshotPath}`);
    } catch (error) {
      console.log(`\x1b[33m[ProductDiscovery] Screenshot failed:\x1b[0m ${error.message}`);
    }
  }

  /**
   * Save HTML for analysis
   */
  async saveHtml(page, siteUrl) {
    try {
      const hostname = new URL(siteUrl).hostname;
      const htmlPath = `debug-${hostname}-${Date.now()}.html`;
      const html = await page.content();
      const fs = require('fs');
      fs.writeFileSync(htmlPath, html);
      console.log(`\x1b[36m[ProductDiscovery] HTML saved:\x1b[0m ${htmlPath}`);
    } catch (error) {
      console.log(`\x1b[33m[ProductDiscovery] HTML save failed:\x1b[0m ${error.message}`);
    }
  }

  /**
   * Extract products using site-specific selectors
   */
  async extractProducts(page, siteConfig) {
    return await page.evaluate((config) => {
      console.log('🔍 Extracting products with site-specific selectors...');
      
      let productCards = [];
      
      // Try site-specific selectors first
      for (const selector of config.productSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          productCards = elements;
          break;
        }
      }
      
      // Fallback to generic selectors if none found
      if (productCards.length === 0) {
        const fallbackSelectors = [
          '.product',
          '.product-item', 
          '.product-card',
          '[data-product-id]',
          '.item',
          '.product-grid .product',
          '.products .product',
          '.search-results .product',
          '.product-list .product',
          '.grid .product',
          '.collection .product',
          '.product-tile',
          '.product-box',
          '.product-container'
        ];
        
        for (const selector of fallbackSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with fallback selector: ${selector}`);
            productCards = elements;
            break;
          }
        }
      }
      
      const extractedProducts = [];
      
      productCards.forEach((card, index) => {
        if (index >= 20) return; // Limit to first 20 products
        
        try {
          // Extract product name
          let productName = '';
          for (const selector of config.titleSelectors) {
            const element = card.querySelector(selector);
            if (element) {
              if (element.tagName === 'IMG') {
                productName = element.alt || element.title || '';
              } else {
                productName = element.textContent?.trim() || '';
              }
              if (productName) break;
            }
          }
          
          // Extract product URL
          let productUrl = '';
          for (const selector of config.linkSelectors) {
            const link = card.querySelector(selector);
            if (link && link.href) {
              productUrl = link.href;
              break;
            }
          }
          
          // Extract image URL
          let imageUrl = '';
          for (const selector of config.imageSelectors) {
            const img = card.querySelector(selector);
            if (img) {
              imageUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
              if (imageUrl) break;
            }
          }
          
          // Extract price
          let price = '';
          for (const selector of config.priceSelectors) {
            const priceElement = card.querySelector(selector);
            if (priceElement) {
              price = priceElement.textContent?.trim() || '';
              if (price) break;
            }
          }
          
          // Convert relative URLs to absolute
          if (productUrl && !productUrl.startsWith('http')) {
            productUrl = new URL(productUrl, window.location.href).href;
          }
          
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = new URL(imageUrl, window.location.href).href;
          }
          
          if (productName) {
            extractedProducts.push({
              name: productName,
              title: productName, // Add title field for compatibility
              url: productUrl,
              image: imageUrl,
              price: price,
              site: window.location.hostname
            });
            
            console.log(`[${index + 1}] Found: ${productName}`);
          }
        } catch (error) {
          console.log(`Error extracting product ${index}:`, error.message);
        }
      });
      
      console.log(`✅ Successfully extracted ${extractedProducts.length} products`);
      return extractedProducts;
    }, siteConfig);
  }

  /**
   * Calculate relevance score for a product
   */
  calculateRelevance(product, requirements) {
    let score = 0;
    const title = (product.name || product.title || '').toLowerCase();
    const price = this.extractPrice(product.price);

    // Product type matching
    if (requirements.productType && title.includes(requirements.productType.toLowerCase())) {
      score += 30;
    }

    // Color matching
    if (requirements.color && title.includes(requirements.color.toLowerCase())) {
      score += 25;
    }

    // Quantity matching
    if (requirements.quantity) {
      const titleQuantity = this.extractQuantity(title);
      if (titleQuantity === requirements.quantity) {
        score += 20;
      } else if (titleQuantity > requirements.quantity) {
        score += 10; // Partial credit for larger quantities
      }
    }

    // Occasion matching
    if (requirements.occasion && title.includes(requirements.occasion.toLowerCase())) {
      score += 15;
    }

    // Price range matching (if specified)
    if (requirements.budget && price) {
      if (price <= requirements.budget) {
        score += 10;
      }
    }

    return score;
  }

  /**
   * Extract price from price string
   */
  extractPrice(priceString) {
    if (!priceString) return null;
    const match = priceString.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
  }

  /**
   * Extract quantity from title
   */
  extractQuantity(title) {
    if (!title) return 1;
    const match = title.match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(productUrl) {
    const page = await this.context.newPage();
    
    try {
      await page.goto(productUrl, { waitUntil: 'networkidle', timeout: 15000 });
      
      const details = await page.evaluate(() => {
        const title = document.querySelector('h1, .product-title')?.textContent?.trim();
        const price = document.querySelector('.price, .product-price')?.textContent?.trim();
        const description = document.querySelector('.product-description, .description')?.textContent?.trim();
        const images = Array.from(document.querySelectorAll('.product-image img, .gallery img')).map(img => img.src);
        
        // Find variant options
        const variants = [];
        const variantSelectors = document.querySelectorAll('select option, .variant-option');
        variantSelectors.forEach(option => {
          if (option.value && option.textContent.trim()) {
            variants.push({
              id: option.value,
              name: option.textContent.trim()
            });
          }
        });

        return {
          title,
          price,
          description,
          images,
          variants,
          url: window.location.href
        };
      });

      return details;
    } catch (error) {
      console.error('Error getting product details:', error.message);
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * Main method to discover products from natural language request
   */
  async discoverProducts(userRequest) {
    console.log(`\x1b[35m[ProductDiscovery] Starting product discovery for:\x1b[0m ${userRequest}`);
    await this.initialize();
    
    try {
      // Parse the user request
      const requirements = await this.parseProductRequest(userRequest);
      console.log('📋 Parsed requirements:', requirements);

      // Search for products
      const searchResults = await this.searchProducts(requirements);
      console.log(`🔍 Found ${searchResults.length} products`);

      // Sort by relevance and get top results
      const topResults = searchResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 5);

      // Get detailed information for top results
      const detailedResults = [];
      for (const result of topResults) {
        console.log(`\x1b[36m[ProductDiscovery] Getting details for product:\x1b[0m ${result.name || result.title}`);
        const details = await this.getProductDetails(result.url);
        if (details) {
          detailedResults.push({
            ...result,
            ...details
          });
        }
      }

      console.log(`\x1b[32m[ProductDiscovery] Discovery complete. Returning ${detailedResults.length} products.\x1b[0m`);
      return {
        requirements,
        products: detailedResults,
        totalFound: searchResults.length
      };

    } finally {
      await this.close();
    }
  }
}

module.exports = ProductDiscovery; 