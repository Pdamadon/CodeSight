# 📊 Data Import Guide for CodeSight

Learn how to import data from other scrapers to train your CodeSight model.

## 🎯 **What You Can Import**

CodeSight can learn from data scraped by:
- **Scrapy** projects
- **Playwright** scripts
- **Puppeteer** scripts
- **Selenium** scripts
- **Beautiful Soup** scripts
- **Generic JSON/CSV** files
- **JavaScript/TypeScript** scraping code (NEW!)

## 🚀 **Quick Start**

### **1. Build the Project**
```bash
npm run build
```

### **2. Import from Your Scrapers Copy Directory**
```bash
# Import all JSON files from scrapers copy directory
npm run import scrapers-copy

# Preview what would be imported (dry run)
npm run import scrapers-copy -- --dry-run

# Limit records per file
npm run import scrapers-copy -- --limit 50
```

### **3. Import from Specific File**
```bash
# Import from a JSON file
npm run import file path/to/your/scraped-data.json

# Import from CSV file
npm run import file path/to/your/data.csv --type csv

# Import from JSONL file
npm run import file path/to/your/data.jsonl --type jsonl
```

### **4. Import from Directory**
```bash
# Import all compatible files from a directory
npm run import directory path/to/your/scraped-data/

# Parallel processing
npm run import directory path/to/your/scraped-data/ --parallel

# Recursive search
npm run import directory path/to/your/scraped-data/ --recursive
```

### **5. Import JavaScript/TypeScript Code**
```bash
# Import JavaScript scraping code
npm run import file path/to/your/scraper.js --type javascript

# Import TypeScript scraping code
npm run import file path/to/your/scraper.ts --type typescript

# Import all JS/TS files from a directory
npm run import directory "scrapers copy" --pattern "*.{js,ts}"
```

## 📋 **Supported Data Formats**

### **Standard JSON Format**
```json
{
  "url": "https://example.com",
  "domain": "example.com",
  "timestamp": 1672531200000,
  "data": {
    "title": "Page Title",
    "content": "Page content...",
    "links": ["url1", "url2"]
  }
}
```

### **Scrapy Format**
```json
{
  "url": "https://example.com",
  "items": {
    "title": "Page Title",
    "price": "$19.99"
  },
  "spider": "example_spider",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

### **Playwright/Puppeteer Format**
```json
{
  "url": "https://example.com",
  "extracted": {
    "title": "Page Title",
    "description": "Page description"
  },
  "timestamp": 1672531200000,
  "success": true
}
```

### **CSV Format**
```csv
url,domain,timestamp,title,content
https://example.com,example.com,2023-01-01,Page Title,Page content...
```

### **JavaScript/TypeScript Code**
```javascript
// Extract patterns from actual scraping code
const page = await browser.newPage();
await page.goto('https://example.com');
await page.waitForSelector('.products');
const products = await page.$$eval('.product-card', elements => 
  elements.map(el => ({
    title: el.querySelector('.title').textContent,
    price: el.querySelector('.price').textContent
  }))
);
```

## 🔧 **Advanced Usage**

### **Custom Data Format**
```bash
# Specify custom field mappings
npm run import file data.json --format '{
  "url": "page_url",
  "domain": "site_domain", 
  "timestamp": "scraped_at",
  "data": "extracted_data"
}'
```

### **Discover Data Sources**
```bash
# Analyze a directory to discover compatible data files
npm run import discover path/to/your/data/

# Save discovered sources to file
npm run import discover path/to/your/data/ --output sources.json
```

### **Import with Filtering**
```bash
# Import only recent data
npm run import file data.json --limit 1000

# Skip first 100 records
npm run import file data.json --skip 100
```

## 🧠 **Learning Pipeline**

After importing data, create a learning pipeline:

```bash
# Analyze imported data and create learning patterns
npm run import learn

# Check current data statistics
npm run import status
```

## 📊 **What Gets Learned**

CodeSight learns from your imported data:

### **From JSON/CSV Data:**
1. **Selector Patterns** - Common CSS selectors used across domains
2. **Data Structures** - How different sites organize data
3. **Success Strategies** - Which approaches work best for different site types
4. **Error Patterns** - Common failure modes and how to avoid them

### **From JavaScript/TypeScript Code:**
1. **Framework Patterns** - Playwright, Puppeteer, Selenium techniques
2. **Selector Strategies** - How to find elements effectively
3. **Navigation Patterns** - Page loading and routing strategies
4. **Data Extraction Techniques** - DOM manipulation and data collection
5. **Error Handling** - Try/catch patterns and retry strategies
6. **Wait Strategies** - Timing and synchronization techniques

## 🎯 **Best Practices**

### **Data Quality**
- Import clean, validated data
- Include both successes and failures
- Add metadata about scraping techniques used

### **Volume**
- Start with 100-1000 records per domain
- Gradually increase as patterns emerge
- Balance across different site types

### **Diversity**
- Include data from various domains
- Mix different content types (e-commerce, news, social media)
- Include different scraping techniques

## 📝 **Example: Import from Scrapers Copy**

Your `scrapers copy` directory contains existing scraping data. Here's how to import it:

```bash
# 1. First, discover what's available
npm run import discover "scrapers copy"

# 2. Preview the import
npm run import scrapers-copy -- --dry-run

# 3. Import with limit for testing
npm run import scrapers-copy -- --limit 10

# 4. Full import
npm run import scrapers-copy

# 5. Create learning pipeline
npm run import learn

# 6. Check results
npm run import status
```

## 🔍 **Example Data Files**

### **E-commerce Data (JSON)**
```json
{
  "url": "https://shop.example.com/product/123",
  "domain": "shop.example.com",
  "timestamp": 1672531200000,
  "goal": "extract product details",
  "success": true,
  "data": {
    "title": "Product Name",
    "price": "$29.99",
    "description": "Product description...",
    "images": ["img1.jpg", "img2.jpg"],
    "availability": "In Stock"
  },
  "metadata": {
    "scraper": "scrapy",
    "technique": "css_selectors",
    "confidence": 0.95
  }
}
```

### **News Data (JSONL)**
```jsonl
{"url": "https://news.example.com/article/1", "data": {"title": "News Title 1", "content": "Article content..."}}
{"url": "https://news.example.com/article/2", "data": {"title": "News Title 2", "content": "Article content..."}}
```

### **Social Media Data (CSV)**
```csv
url,domain,timestamp,username,content,likes,shares
https://social.example.com/post/1,social.example.com,2023-01-01,user1,Post content...,10,5
https://social.example.com/post/2,social.example.com,2023-01-01,user2,Another post...,20,3
```

## 🚨 **Important Notes**

1. **Privacy**: Only import data you have permission to use
2. **Quality**: Clean data produces better learning outcomes
3. **Security**: Sensitive data is automatically excluded by .gitignore
4. **Performance**: Large imports may take time - use limits for testing

## 🔧 **Troubleshooting**

### **Common Issues**

**"Data source file not found"**
- Check file path is correct
- Ensure file exists and is readable

**"Invalid data format"**
- Verify JSON is valid
- Check CSV headers match expected format
- Use --format flag for custom mappings

**"Import failed"**
- Check database connection
- Verify API keys are set
- Check file permissions

### **Getting Help**
```bash
# Show available commands
npm run import --help

# Show command-specific help
npm run import file --help
npm run import directory --help
```

## 🎉 **Next Steps**

After importing data:

1. **Test the improved model** with new scraping tasks
2. **Monitor performance** improvements
3. **Add more diverse data** sources
4. **Fine-tune** based on results

Your CodeSight model will continuously learn and improve from the imported data!

---

**Happy scraping! 🚀**