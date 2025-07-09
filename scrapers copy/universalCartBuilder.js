// Load environment variables
require('dotenv').config();

const { chromium } = require('playwright');
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

class UniversalCartBuilder {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async initialize() {
    console.log('\x1b[36m[UniversalCartBuilder] Initializing browser...\x1b[0m');
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  async close() {
    if (this.browser) {
      console.log('\x1b[36m[UniversalCartBuilder] Closing browser...\x1b[0m');
      await this.browser.close();
    }
  }

  /**
   * Analyze the page structure to determine the site type and selectors
   */
  async analyzePageStructure() {
    const analysis = await this.page.evaluate(() => {
      const structure = {
        siteType: 'unknown',
        selectors: {},
        features: {}
      };

      // Detect Shopify
      if (window.Shopify || document.querySelector('[data-shopify]')) {
        structure.siteType = 'shopify';
        structure.selectors = {
          addToCart: 'button[name="add"], .btn-add-to-cart, [data-add-to-cart]',
          cartButton: 'a[href*="/cart"], .cart-link, [data-cart]',
          checkoutButton: 'button[name="checkout"], .btn-checkout, [data-checkout]',
          quantityInput: 'input[name="quantity"], .quantity-input',
          variantSelect: 'select[name="id"], .variant-select, [data-variant]',
          priceElement: '.price, .product-price, [data-price]',
          productTitle: 'h1, .product-title, [data-product-title]'
        };
      }
      // Detect WooCommerce
      else if (document.querySelector('.woocommerce') || window.wc_add_to_cart_params) {
        structure.siteType = 'woocommerce';
        structure.selectors = {
          addToCart: '.single_add_to_cart_button, .add-to-cart',
          cartButton: '.cart-contents, .wc-cart',
          checkoutButton: '.checkout-button, .proceed-to-checkout',
          quantityInput: 'input[name="quantity"]',
          variantSelect: '.variations select, .product-variations',
          priceElement: '.price, .woocommerce-Price-amount',
          productTitle: '.product_title, .entry-title'
        };
      }
      // Generic detection
      else {
        structure.selectors = {
          addToCart: 'button:contains("Add to Cart"), button:contains("Buy"), .add-to-cart, [data-add]',
          cartButton: 'a[href*="cart"], .cart, [data-cart]',
          checkoutButton: 'button:contains("Checkout"), .checkout, [data-checkout]',
          quantityInput: 'input[type="number"], .quantity, [data-quantity]',
          variantSelect: 'select, .variant, [data-variant]',
          priceElement: '.price, [data-price], .cost',
          productTitle: 'h1, .title, [data-title]'
        };
      }

      // Detect features
      structure.features = {
        hasVariants: !!document.querySelector('select option, .variant-option'),
        hasQuantity: !!document.querySelector('input[type="number"], .quantity'),
        hasDeliveryOptions: !!document.querySelector('[data-delivery], .delivery, .shipping'),
        hasCardMessage: !!document.querySelector('textarea, [data-message], .message'),
        hasDatePicker: !!document.querySelector('[data-date], .date-picker, input[type="date"]')
      };

      return structure;
    });

    console.log('🔍 Page structure analysis:', analysis);
    return analysis;
  }

  /**
   * Use AI to find the best selectors for a given action
   */
  async findSelectors(action, context = '') {
    try {
      const pageContent = await this.page.content();
      const visibleElements = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a, input, select, textarea'))
          .map(el => ({
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.trim() || '',
            id: el.id || '',
            className: el.className || '',
            name: el.name || '',
            href: el.href || '',
            type: el.type || '',
            visible: el.offsetParent !== null
          }))
          .filter(el => el.visible && (el.text || el.id || el.className));
      });

      const prompt = `
        Given this action: "${action}"
        Context: "${context}"
        
        Available elements on the page:
        ${JSON.stringify(visibleElements, null, 2)}
        
        Find the best selector(s) for this action. Return a JSON object with:
        - selector: CSS selector or text to find the element
        - method: "click", "fill", "select", or "wait"
        - confidence: 0-100 score for how confident you are this is correct
        - fallback: alternative selector if the first one fails
        
        Focus on elements that are most likely to perform the requested action.
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });

      const response = completion.choices[0].message.content;
      return JSON.parse(response);
    } catch (error) {
      console.error('Error finding selectors:', error);
      return null;
    }
  }

  /**
   * Add product to cart with dynamic variant selection
   */
  async addToCart(productUrl, variantName = null, quantity = 1) {
    try {
      console.log(`\x1b[34m[UniversalCartBuilder] Navigating to product page:\x1b[0m ${productUrl}`);
      await this.page.goto(productUrl, { waitUntil: 'networkidle', timeout: 20000 });
      const structure = await this.analyzePageStructure();
      if (variantName && structure.features.hasVariants) {
        console.log(`\x1b[34m[UniversalCartBuilder] Selecting variant:\x1b[0m ${variantName}`);
        await this.selectVariant(variantName, structure);
      }
      if (quantity > 1 && structure.features.hasQuantity) {
        console.log(`\x1b[34m[UniversalCartBuilder] Setting quantity:\x1b[0m ${quantity}`);
        await this.setQuantity(quantity, structure);
      }
      console.log(`\x1b[34m[UniversalCartBuilder] Adding to cart...\x1b[0m`);
      await this.clickAddToCart(structure);
      console.log('✅ Product added to cart successfully');
      return true;
    } catch (error) {
      console.error('❌ Error adding to cart:', error.message);
      return false;
    }
  }

  /**
   * Select product variant
   */
  async selectVariant(variantName, structure) {
    try {
      // Try to find variant selector
      const variantSelector = await this.findSelectors(`select variant "${variantName}"`);
      
      if (variantSelector) {
        // Try AI-suggested selector first
        try {
          await this.page.selectOption(variantSelector.selector, { label: variantName });
          console.log(`✅ Selected variant: ${variantName}`);
          return;
        } catch (error) {
          console.log('AI selector failed, trying fallback...');
        }
      }

      // Fallback to common patterns
      const selectors = [
        `select option:has-text("${variantName}")`,
        `option:has-text("${variantName}")`,
        `[data-variant*="${variantName}"]`,
        `.variant-option:has-text("${variantName}")`
      ];

      for (const selector of selectors) {
        try {
          await this.page.selectOption(selector, { label: variantName });
          console.log(`✅ Selected variant: ${variantName}`);
          return;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Last resort: click on variant options
      await this.page.evaluate((name) => {
        const options = Array.from(document.querySelectorAll('option, .variant-option, [data-variant]'));
        const option = options.find(o => o.textContent.includes(name));
        if (option) {
          option.click();
          return true;
        }
        return false;
      }, variantName);

    } catch (error) {
      console.warn(`⚠️ Could not select variant: ${variantName}`);
    }
  }

  /**
   * Set product quantity
   */
  async setQuantity(quantity, structure) {
    try {
      const quantitySelectors = [
        'input[name="quantity"]',
        '.quantity-input',
        '[data-quantity]',
        'input[type="number"]'
      ];

      for (const selector of quantitySelectors) {
        try {
          await this.page.fill(selector, quantity.toString());
          console.log(`✅ Set quantity: ${quantity}`);
          return;
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not set quantity: ${quantity}`);
    }
  }

  /**
   * Click add to cart button
   */
  async clickAddToCart(structure) {
    const addToCartSelectors = [
      'button[name="add"]',
      '.btn-add-to-cart',
      '[data-add-to-cart]',
      'button:has-text("Add to Cart")',
      'button:has-text("Buy")',
      '.add-to-cart'
    ];

    for (const selector of addToCartSelectors) {
      try {
        await this.page.click(selector);
        console.log('✅ Clicked add to cart');
        
        // Wait for cart update
        await this.page.waitForTimeout(2000);
        return;
      } catch (error) {
        // Continue to next selector
      }
    }

    throw new Error('Could not find add to cart button');
  }

  /**
   * Navigate to cart page
   */
  async goToCart() {
    const cartSelectors = [
      'a[href*="/cart"]',
      '.cart-link',
      '[data-cart]',
      'a:has-text("Cart")',
      '.cart'
    ];

    for (const selector of cartSelectors) {
      try {
        await this.page.click(selector);
        await this.page.waitForLoadState('networkidle');
        console.log('✅ Navigated to cart');
        return;
      } catch (error) {
        // Continue to next selector
      }
    }

    // Try direct navigation
    const currentUrl = this.page.url();
    const baseUrl = currentUrl.split('/').slice(0, 3).join('/');
    await this.page.goto(`${baseUrl}/cart`);
  }

  /**
   * Configure delivery options
   */
  async configureDelivery(zipCode, deliveryDate) {
    try {
      console.log(`\x1b[34m[UniversalCartBuilder] Configuring delivery: zip=${zipCode}, date=${deliveryDate}\x1b[0m`);
      // Look for delivery method selection
      const deliverySelectors = [
        '.delivery',
        '[data-delivery]',
        '.checkoutMethodContainer.delivery',
        'input[value="delivery"]'
      ];

      for (const selector of deliverySelectors) {
        try {
          await this.page.click(selector);
          console.log('✅ Selected delivery method');
          break;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Fill zip code
      const zipSelectors = [
        '#deliveryGeoSearchField',
        'input[placeholder*="zip"]',
        'input[placeholder*="postal"]',
        'input[name*="zip"]'
      ];

      for (const selector of zipSelectors) {
        try {
          await this.page.fill(selector, zipCode);
          console.log(`✅ Filled zip code: ${zipCode}`);
          break;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Submit zip code
      const submitSelectors = [
        '[aria-label="Submit Button"]',
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Find")'
      ];

      for (const selector of submitSelectors) {
        try {
          await this.page.click(selector);
          await this.page.waitForTimeout(1500);
          console.log('✅ Submitted zip code');
          break;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Select delivery date if provided
      if (deliveryDate) {
        await this.selectDeliveryDate(deliveryDate);
      }

    } catch (error) {
      console.warn('⚠️ Could not configure delivery options:', error.message);
    }
  }

  /**
   * Select delivery date
   */
  async selectDeliveryDate(deliveryDate) {
    try {
      // Open date picker
      const datePickerSelectors = [
        '#Zapiet-InputCalendar__delivery',
        'input[type="date"]',
        '.date-picker',
        '[data-date]'
      ];

      for (const selector of datePickerSelectors) {
        try {
          await this.page.click(selector);
          console.log('✅ Opened date picker');
          break;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Select the date
      const dateSelector = `button[aria-label="${deliveryDate}"][aria-disabled="false"]`;
      await this.page.waitForSelector(dateSelector, { timeout: 5000 });
      await this.page.click(dateSelector);
      console.log(`✅ Selected delivery date: ${deliveryDate}`);

    } catch (error) {
      console.warn('⚠️ Could not select delivery date:', error.message);
    }
  }

  /**
   * Add card message
   */
  async addCardMessage(message) {
    try {
      console.log(`\x1b[34m[UniversalCartBuilder] Adding card message:\x1b[0m ${message}`);
      const messageSelectors = [
        'textarea[name*="message"]',
        'textarea[name*="card"]',
        'input[name*="message"]',
        '.message-input',
        '[data-message]'
      ];

      for (const selector of messageSelectors) {
        try {
          await this.page.fill(selector, message);
          console.log(`✅ Added card message: ${message}`);
          return;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Try API approach for Shopify
      await this.page.evaluate((msg) => {
        return fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            'attributes[What would you like your card message to read?]': msg,
          }),
        });
      }, message);

    } catch (error) {
      console.warn('⚠️ Could not add card message:', error.message);
    }
  }

  /**
   * Proceed to checkout
   */
  async proceedToCheckout() {
    try {
      console.log(`\x1b[34m[UniversalCartBuilder] Proceeding to checkout...\x1b[0m`);
      const checkoutSelectors = [
        'button:has-text("Checkout")',
        '.btn-checkout',
        '[data-checkout]',
        'button[name="checkout"]',
        'a[href*="checkout"]'
      ];

      for (const selector of checkoutSelectors) {
        try {
          await this.page.click(selector);
          console.log('✅ Clicked checkout button');
          break;
        } catch (error) {
          // Continue to next selector
        }
      }

      // Handle upsell modals
      await this.handleUpsellModal();

      // Wait for navigation to checkout
      await this.page.waitForURL('**/checkout', { timeout: 20000 });
      const checkoutUrl = this.page.url();
      console.log(`🧾 Arrived at checkout: ${checkoutUrl}`);

      return checkoutUrl;

    } catch (error) {
      console.error('❌ Error proceeding to checkout:', error.message);
      throw error;
    }
  }

  /**
   * Handle upsell modals
   */
  async handleUpsellModal() {
    try {
      await this.page.waitForTimeout(3000);
      
      const modalSelectors = [
        'button:has-text("Continue to checkout")',
        '.modal button:has-text("Continue")',
        '.popup button:has-text("Continue")',
        '.tdf_cta_btn'
      ];

      for (const selector of modalSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          await this.page.click(selector);
          console.log('✅ Dismissed upsell modal');
          break;
        } catch (error) {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.log('ℹ️ No upsell modal found');
    }
  }

  /**
   * Fill checkout form
   */
  async fillCheckoutForm(customerInfo) {
    try {
      console.log(`\x1b[34m[UniversalCartBuilder] Filling checkout form...\x1b[0m`);
      const formFields = {
        email: ['input[name="email"]', 'input[name="checkout[email]"]'],
        firstName: ['input[name="firstName"]', 'input[name="checkout[shipping_address][first_name]"]'],
        lastName: ['input[name="lastName"]', 'input[name="checkout[shipping_address][last_name]"]'],
        address1: ['input[name="address1"]', 'input[name="checkout[shipping_address][address1]"]'],
        address2: ['input[name="address2"]', 'input[name="checkout[shipping_address][address2]"]'],
        city: ['input[name="city"]', 'input[name="checkout[shipping_address][city]"]'],
        phone: ['input[name="phone"]', 'input[name="checkout[shipping_address][phone]"]']
      };

      for (const [field, selectors] of Object.entries(formFields)) {
        if (customerInfo[field]) {
          for (const selector of selectors) {
            try {
              await this.page.fill(selector, customerInfo[field]);
              console.log(`✅ Filled ${field}`);
              break;
            } catch (error) {
              // Continue to next selector
            }
          }
        }
      }

    } catch (error) {
      console.warn('⚠️ Could not fill checkout form:', error.message);
    }
  }

  /**
   * Main method to build cart from product URL
   */
  async buildCart({
    productUrl,
    variantName,
    quantity = 1,
    zipCode,
    cardMessage,
    deliveryDate,
    customerInfo = {}
  }) {
    await this.initialize();
    
    try {
      console.log(`\x1b[35m[UniversalCartBuilder] Starting cart build for:\x1b[0m ${productUrl}`);
      const added = await this.addToCart(productUrl, variantName, quantity);
      if (!added) {
        throw new Error('Failed to add product to cart');
      }
      console.log(`\x1b[34m[UniversalCartBuilder] Going to cart page...\x1b[0m`);
      await this.goToCart();
      if (zipCode) {
        await this.configureDelivery(zipCode, deliveryDate);
      }
      if (cardMessage) {
        await this.addCardMessage(cardMessage);
      }
      const checkoutUrl = await this.proceedToCheckout();
      if (Object.keys(customerInfo).length > 0) {
        await this.fillCheckoutForm(customerInfo);
      }
      console.log(`\x1b[32m[UniversalCartBuilder] Cart build complete. Checkout URL: ${checkoutUrl}\x1b[0m`);
      return { checkoutUrl };
    } catch (error) {
      console.error('❌ Cart building failed:', error.message);
      return { error: error.message };
    } finally {
      // Keep browser open for inspection
      // await this.close();
    }
  }
}

module.exports = UniversalCartBuilder; 