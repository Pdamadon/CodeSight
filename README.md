# CodeSight MCP Server

An autonomous AI agent for web scraping that integrates with any MCP-compatible client (like Claude Code).

## Features

- **Autonomous scraping**: AI-powered analysis of web pages
- **LLM planning**: Uses GPT-4 to generate optimal scraping strategies
- **Multi-format output**: Generates Playwright or Puppeteer scripts
- **MCP integration**: Works with any MCP-compatible client
- **Fallback system**: Works without OpenAI API key using DOM analysis

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Add your OpenAI API key (optional):
```
OPENAI_API_KEY=your_key_here
```

## Usage with Claude Code

1. Build the project:
```bash
npm run build
```

2. Add to your Claude Code MCP configuration:
```json
{
  "mcpServers": {
    "codesight": {
      "command": "node",
      "args": ["/path/to/codesight-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "your_key_here"
      }
    }
  }
}
```

3. Use the tools in Claude Code:

```
# Scrape a website
scrape_website(url="https://example.com", targets=["title", "price"])

# Analyze DOM structure
analyze_dom(html="<html>...</html>", targets=["title", "price"])

# Generate scraping script
generate_script(url="https://example.com", selectors={"title": "h1", "price": ".price"})
```

## Available Tools

### scrape_website
Autonomously scrape data from a website.

**Parameters:**
- `url`: Website URL to scrape
- `targets`: Array of data to extract (e.g., ["title", "price", "description"])
- `waitForSelector`: CSS selector to wait for (optional)
- `timeout`: Timeout in milliseconds (default: 30000)
- `headless`: Run browser in headless mode (default: true)

### analyze_dom
Analyze HTML structure and suggest selectors.

**Parameters:**
- `html`: HTML content to analyze
- `targets`: Array of data to find selectors for

### generate_script
Generate Playwright or Puppeteer scraping script.

**Parameters:**
- `url`: Website URL
- `selectors`: Object mapping target names to CSS selectors
- `outputFormat`: "playwright" or "puppeteer" (default: "playwright")

## Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## Architecture

The system follows the autonomous agent pattern from the planagent.md:

1. **Perception**: DOM analysis and HTML parsing
2. **Planning**: LLM-driven selector generation and strategy planning
3. **Execution**: Playwright-based scraping with error handling
4. **Validation**: Result validation and error reporting
5. **Learning**: (Future) Feedback integration for continuous improvement

## License

MIT