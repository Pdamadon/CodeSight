# Ballard Blossom Scraping Pipeline

This directory contains scripts to scrape product data from Ballard Blossom (https://ballardblossom.com/).

## Quick Start

Run the complete pipeline:
```bash
npm run ballardblossom-pipeline
```

Or run individual steps:
```bash
# Step 1: Map categories
npm run ballardblossom-map

# Step 2: Extract product lists
npm run ballardblossom-products

# Step 3: Extract detailed product information
npm run ballardblossom-details
```

## Scripts Overview

### 1. `map-ballardblossom-categories.js`
- Visits the Ballard Blossom homepage
- Extracts all navigation links
- Filters for product-related categories
- Saves to `ballardblossom-categories.json`

### 2. `fetch-ballardblossom-all-categories.js`
- Reads the category mapping
- Visits each category page
- Extracts product listings (name, price, image, URL)
- Saves to `category_products/ballardblossom-{category}-products.json`

### 3. `fetch-ballardblossom-all-categories-details.js`
- Reads all product list files
- Visits each product detail page
- Extracts comprehensive product information
- Saves to `category_products/ballardblossom-{category}-products-detailed.json`

### 4. `run-ballardblossom-pipeline.js`
- Runs all three scripts in sequence
- Provides progress updates
- Handles errors gracefully

## Output Structure 