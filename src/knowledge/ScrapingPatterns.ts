// ScrapingPatterns.ts - Knowledge base extracted from working scrapers

export interface SelectorPattern {
  selectors: string[];
  priority: number;
  description: string;
  validator?: (element: Element) => boolean;
}

export interface ExtractionPattern {
  name: string;
  selectors: string[];
  extractor: (element: Element) => string;
  validator: (text: string) => boolean;
  cleaner?: (text: string) => string;
}

export interface SitePattern {
  domain: string;
  type: 'ecommerce' | 'news' | 'social' | 'generic';
  productPatterns?: SelectorPattern[];
  contentPatterns?: ExtractionPattern[];
}

export class ScrapingPatterns {
  
  // Multi-selector strategies based on proven patterns
  static getProductSelectors(): SelectorPattern[] {
    return [
      {
        selectors: ['.product-tile', '.grid-tile', '[data-test="product-tile"]'],
        priority: 1,
        description: 'Primary product tile selectors (high confidence)',
        validator: (el) => el.querySelector('a[href*="/products/"]') !== null
      },
      {
        selectors: ['.product-item', '.product-card', '.fr-product-tile'],
        priority: 2,
        description: 'Secondary product container selectors',
        validator: (el) => el.textContent.length > 10
      },
      {
        selectors: ['[class*="ProductTile"]', '[class*="product"]', '[class*="Product"]'],
        priority: 3,
        description: 'Pattern-based product selectors',
        validator: (el) => el.querySelector('img') !== null
      },
      {
        selectors: ['article', 'li[class*="product"]', 'div[class*="tile"]'],
        priority: 4,
        description: 'Semantic fallback selectors',
        validator: (el) => el.querySelectorAll('a').length > 0
      },
      {
        selectors: ['a[href*="/products/"]'],
        priority: 5,
        description: 'URL-based product link fallback',
        validator: (el) => el.textContent.trim().length > 0
      }
    ];
  }

  // Content extraction patterns based on successful scrapers
  static getExtractionPatterns(): Record<string, ExtractionPattern> {
    return {
      productName: {
        name: 'Product Name',
        selectors: [
          '.product-title',
          '.product-name', 
          '.tile-title',
          'h1', 'h2', 'h3', 'h4',
          '[data-test="product-name"]',
          '.fr-product-tile-name',
          'a[href*="/products/"]'
        ],
        extractor: (el) => el.textContent?.trim() || '',
        validator: (text) => text.length > 2 && text.length < 200,
        cleaner: (text) => {
          // Remove size info, ratings, price suffixes (from improved-fashion-scraper.js)
          return text
            .replace(/^(WOMEN|MEN|KIDS),?\s*[^A-Z]*/, '') // Remove size prefixes
            .replace(/\d+\.\d+\(\d+\).*$/, '') // Remove ratings like "4.7(119)"
            .replace(/\$[\d,]+(\.\d{2})?.*$/, '') // Remove price suffixes
            .trim();
        }
      },
      
      price: {
        name: 'Price',
        selectors: [
          '.price',
          '.product-price',
          '.tile-price',
          '[data-test="price"]',
          '.fr-product-tile-price',
          '[class*="price"]',
          '[class*="Price"]'
        ],
        extractor: (el) => el.textContent?.trim() || '',
        validator: (text) => text.includes('$') || /\$?\d+(\.\d{2})?/.test(text),
        cleaner: (text) => {
          // Extract price from text
          const priceMatch = text.match(/\$[\d,]+(\.\d{2})?/);
          return priceMatch ? priceMatch[0] : text;
        }
      },

      articleTitle: {
        name: 'Article Title',
        selectors: [
          'h1',
          '.headline',
          '.title',
          '.article-title',
          '.entry-title',
          '[class*="headline"]',
          '[class*="title"]'
        ],
        extractor: (el) => el.textContent?.trim() || '',
        validator: (text) => text.length > 5 && text.length < 300,
        cleaner: (text) => text.replace(/\s+/g, ' ').trim()
      },

      articleContent: {
        name: 'Article Content',
        selectors: [
          '.article-content',
          '.entry-content',
          '.post-content',
          'article p',
          '.content p',
          '[class*="content"] p'
        ],
        extractor: (el) => el.textContent?.trim() || '',
        validator: (text) => text.length > 20 && text.length < 2000,
        cleaner: (text) => text.replace(/\s+/g, ' ').trim()
      }
    };
  }

  // Site-specific patterns based on working scrapers
  static getSitePatterns(): SitePattern[] {
    return [
      {
        domain: 'uniqlo.com',
        type: 'ecommerce',
        productPatterns: [
          {
            selectors: ['.fr-product-tile', '.product-tile'],
            priority: 1,
            description: 'Uniqlo-specific product tiles'
          }
        ]
      },
      {
        domain: 'terrabellaflowers.com',
        type: 'ecommerce',
        productPatterns: [
          {
            selectors: ['select option', '.product-variant'],
            priority: 1,
            description: 'Terra Bella variant selectors'
          }
        ]
      },
      {
        domain: 'news.ycombinator.com',
        type: 'news',
        contentPatterns: [
          {
            name: 'Story Title',
            selectors: ['.titleline > a', '.storylink'],
            extractor: (el) => el.textContent?.trim() || '',
            validator: (text) => text.length > 5 && !text.includes('comments')
          }
        ]
      }
    ];
  }

  // Smart selector generation based on content type and site analysis
  static generateSmartSelectors(contentType: string, domain: string, htmlAnalysis: any): string[] {
    const selectors: string[] = [];
    
    // Site-specific patterns first
    const sitePattern = this.getSitePatterns().find(p => domain.includes(p.domain));
    if (sitePattern) {
      if (contentType.includes('product') && sitePattern.productPatterns) {
        sitePattern.productPatterns.forEach(pattern => {
          selectors.push(...pattern.selectors);
        });
      }
      if (sitePattern.contentPatterns) {
        sitePattern.contentPatterns.forEach(pattern => {
          selectors.push(...pattern.selectors);
        });
      }
    }
    
    // Content-type specific patterns
    if (contentType.includes('product') || contentType.includes('price')) {
      this.getProductSelectors().forEach(pattern => {
        selectors.push(...pattern.selectors);
      });
    }
    
    if (contentType.includes('title') || contentType.includes('headline')) {
      const titlePattern = this.getExtractionPatterns().articleTitle;
      selectors.push(...titlePattern.selectors);
    }
    
    if (contentType.includes('content') || contentType.includes('article')) {
      const contentPattern = this.getExtractionPatterns().articleContent;
      selectors.push(...contentPattern.selectors);
    }
    
    // Remove duplicates and return
    return [...new Set(selectors)];
  }

  // Validate and clean extracted content
  static validateAndClean(content: string, contentType: string): { isValid: boolean; cleaned: string; confidence: number } {
    const patterns = this.getExtractionPatterns();
    let pattern: ExtractionPattern | undefined;
    
    // Find matching pattern
    if (contentType.includes('product') || contentType.includes('name')) {
      pattern = patterns.productName;
    } else if (contentType.includes('price')) {
      pattern = patterns.price;
    } else if (contentType.includes('title') || contentType.includes('headline')) {
      pattern = patterns.articleTitle;
    } else if (contentType.includes('content') || contentType.includes('article')) {
      pattern = patterns.articleContent;
    }
    
    if (!pattern) {
      return { isValid: true, cleaned: content, confidence: 0.5 };
    }
    
    // Validate
    const isValid = pattern.validator(content);
    if (!isValid) {
      return { isValid: false, cleaned: content, confidence: 0.1 };
    }
    
    // Clean
    const cleaned = pattern.cleaner ? pattern.cleaner(content) : content;
    
    // Calculate confidence based on content quality
    let confidence = 0.7;
    
    // Boost confidence for good content
    if (cleaned.length > 10 && cleaned.length < 100) confidence += 0.2;
    if (!/^[0-9\s\-_]+$/.test(cleaned)) confidence += 0.1; // Not just numbers/symbols
    
    return { isValid: true, cleaned, confidence };
  }

  // Generate few-shot examples for AI prompts
  static getFewShotExamples(contentType: string): string {
    const examples = {
      product: `
Example successful product extraction:
- HTML: <div class="product-tile"><a href="/products/shirt">Blue Cotton Shirt</a><span class="price">$29.99</span></div>
- Target: "product name"
- Selector: ".product-tile a"
- Extracted: "Blue Cotton Shirt"
- Confidence: 0.9

Example failed extraction:
- HTML: <div class="nav-item"><a href="/about">About Us</a></div>
- Target: "product name"  
- Selector: ".nav-item a"
- Extracted: "About Us"
- Confidence: 0.1 (Not a product name)
`,
      
      news: `
Example successful news extraction:
- HTML: <h1 class="headline">Breaking: New Technology Breakthrough</h1>
- Target: "article title"
- Selector: "h1.headline"
- Extracted: "Breaking: New Technology Breakthrough"
- Confidence: 0.95

Example failed extraction:
- HTML: <h1 class="site-title">Website Name</h1>
- Target: "article title"
- Selector: "h1.site-title"
- Extracted: "Website Name"
- Confidence: 0.2 (Site title, not article title)
`
    };
    
    return examples[contentType] || examples.product;
  }
}