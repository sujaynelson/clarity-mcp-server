# Developer Quick Reference

## Quick Start

```bash
# Clone and setup
git clone <repository>
cd clarity-mcp-server
npm install

# Build
npm run build

# Run locally
npm start

# Or build and run in one step
npm run dev
```

## File Structure

```
src/
├── index.ts    # Main server implementation (200+ lines)
│               # - Configuration management
│               # - MCP server setup
│               # - Tool registration
│               # - API client
│               # - Data processing
│
└── cli.ts      # CLI entry point (5 lines)
                # - Executable wrapper
                # - Imports index.js
```

## Key Functions

### `getConfigValue(name, fallback?)`
**Purpose**: Load configuration from multiple sources  
**Priority**: CLI args → Env vars → Fallback  
**Example**:
```typescript
getConfigValue('clarity_api_token') 
// Checks: --clarity_api_token=xxx, then $CLARITY_API_TOKEN
```

### `fetchClarityData(token, numOfDays, dimensions?)`
**Purpose**: Make HTTP request to Clarity API  
**Returns**: JSON array of metrics or error object  
**Example**:
```typescript
await fetchClarityData('token', 2, ['Browser', 'Device'])
// Returns: [{metricName: "Traffic", dimension1: "Chrome", ...}]
```

### `server.tool(name, description, schema, handler)`
**Purpose**: Register MCP tool  
**Tool Name**: `"get-clarity-data"`  
**Handler**: Async function with parameter validation  

## Configuration Sources

| Source | Format | Example |
|--------|--------|---------|
| CLI Arg | `--name=value` | `--clarity_api_token=abc123` |
| Env Var | `NAME=value` | `CLARITY_API_TOKEN=abc123` |
| Parameter | Tool param | `{ token: "abc123" }` |

## API Details

### Endpoint
```
GET https://www.clarity.ms/export-data/api/v1/project-live-insights
```

### Query Parameters
- `numOfDays`: 1-3
- `dimension1`: Optional (e.g., "Browser")
- `dimension2`: Optional (e.g., "Device")
- `dimension3`: Optional (e.g., "Country/Region")

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Response Format
```json
[
  {
    "metricName": "Traffic",
    "dimension1": "Chrome",
    "dimension2": "Desktop",
    "value": 1234
  }
]
```

## Dimensions (Max 3)

| Dimension | Description |
|-----------|-------------|
| `Browser` | Web browser (Chrome, Firefox, etc.) |
| `Device` | Device type (Desktop, Mobile, Tablet) |
| `Country/Region` | Geographic location |
| `OS` | Operating system |
| `Source` | Traffic source |
| `Medium` | Marketing medium |
| `Campaign` | Marketing campaign |
| `Channel` | Traffic channel |
| `URL` | Page URL |

## Metrics

| Category | Metrics |
|----------|---------|
| **Engagement** | `ScrollDepth`, `EngagementTime` |
| **Traffic** | `Traffic`, `PopularPages` |
| **Technical** | `Browser`, `Device`, `OS`, `Country/Region` |
| **Content** | `PageTitle`, `ReferrerURL` |
| **Issues** | `DeadClickCount`, `ExcessiveScroll`, `RageClickCount`, `QuickbackClick`, `ScriptErrorCount`, `ErrorClickCount` |

## MCP Protocol Flow

```
Client Request (stdin)
    ↓
MCP Server (validates params)
    ↓
fetchClarityData (HTTP GET)
    ↓
Clarity API
    ↓
JSON Response
    ↓
Filter metrics (if requested)
    ↓
Format JSON
    ↓
Client Response (stdout)
```

## Tool Invocation Example

```json
{
  "tool": "get-clarity-data",
  "parameters": {
    "numOfDays": 2,
    "dimensions": ["Browser", "Device"],
    "metrics": ["Traffic", "EngagementTime"],
    "token": "your-token-here"
  }
}
```

## Common Tasks

### Add a New Dimension
1. Add to `AVAILABLE_DIMENSIONS` array in `index.ts`
2. Update documentation in CODEBASE.md
3. Rebuild: `npm run build`

### Add a New Metric
1. Add to `AVAILABLE_METRICS` array in `index.ts`
2. Update documentation in CODEBASE.md
3. Rebuild: `npm run build`

### Change API Endpoint
1. Update `API_BASE_URL` constant in `index.ts`
2. Update documentation
3. Test thoroughly

### Add a New Tool
```typescript
server.tool(
  "tool-name",
  "Tool description",
  {
    param1: z.string().describe("Description"),
    param2: z.number().min(1).max(10).describe("Description"),
  },
  async ({ param1, param2 }) => {
    // Implementation
    return {
      content: [{
        type: "text",
        text: "Result"
      }]
    };
  }
);
```

## Debugging

### Enable Verbose Logging
All logs go to stderr (doesn't interfere with MCP protocol):
```bash
node dist/index.js 2> debug.log
```

### Test with MCP Client
1. Install Claude for Desktop
2. Edit config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%AppData%\Claude\claude_desktop_config.json`
3. Add configuration:
```json
{
  "mcpServers": {
    "@microsoft/clarity-mcp-server": {
      "command": "node",
      "args": ["/path/to/clarity-mcp-server/dist/index.js", "--clarity_api_token=your-token"]
    }
  }
}
```

### Test API Directly
```bash
curl -X GET \
  'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1&dimension1=Browser' \
  -H 'Authorization: Bearer your-token-here' \
  -H 'Content-Type: application/json'
```

## Dependencies

### Production
```json
{
  "@modelcontextprotocol/sdk": "^1.10.2",  // MCP protocol
  "zod": "^3.22.4"                          // Validation
}
```

### Development
```json
{
  "typescript": "^5.3.3",      // Compiler
  "@types/node": "^20.11.0"    // Node types
}
```

## TypeScript Configuration Highlights

```json
{
  "target": "ES2022",           // Modern JavaScript
  "module": "Node16",           // ES modules
  "moduleResolution": "Node16", // Node.js resolution
  "outDir": "./dist",           // Output directory
  "rootDir": "./src",           // Source directory
  "strict": true                // Strict type checking
}
```

## Publishing Checklist

- [ ] Update version in `package.json`
- [ ] Run `npm run build` successfully
- [ ] Test with MCP client
- [ ] Update CHANGELOG (if exists)
- [ ] Commit all changes
- [ ] Create git tag: `git tag v1.x.x`
- [ ] Run `npm publish`
- [ ] Push tag: `git push --tags`

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "No Clarity API token provided" | Missing token | Provide via param, env, or CLI |
| "API request failed with status 401" | Invalid token | Check token validity |
| "API request failed with status 429" | Rate limit | Wait (10 req/day limit) |
| Build error | TypeScript issue | Check types, run `tsc --noEmit` |

## Performance Notes

- **API Rate Limit**: 10 requests/day per project
- **Response Time**: ~200-500ms (network dependent)
- **Max Response Size**: 1,000 rows
- **Memory Usage**: ~30-50MB (Node.js + dependencies)
- **CPU Usage**: Minimal (I/O bound)

## Security Checklist

- [ ] Never commit API tokens
- [ ] Use environment variables in production
- [ ] Rotate tokens regularly
- [ ] Validate all inputs (Zod handles this)
- [ ] Use HTTPS for API calls (always)
- [ ] No token logging (already implemented)

## Testing Strategy

Currently no automated tests. To add:

1. **Unit Tests**: Mock `fetch()` for API tests
2. **Integration Tests**: Test with real API (careful with rate limits)
3. **MCP Protocol Tests**: Test tool registration and responses

Example test structure:
```typescript
// tests/index.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('fetchClarityData', () => {
  it('should make correct API request', async () => {
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ metricName: 'Traffic', value: 100 }]
    });
    
    // Test
    const result = await fetchClarityData('token', 1, []);
    expect(result).toHaveLength(1);
  });
});
```

## Related Files

- **CODEBASE.md**: Comprehensive technical documentation
- **ARCHITECTURE.md**: Architecture diagrams and flow
- **README.md**: User-facing setup and usage guide
- **package.json**: Project metadata and scripts

## Useful Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run server
npm start

# Build and run
npm run dev

# Watch mode (install nodemon first)
npm install -D nodemon
npx nodemon --exec "npm run dev" --watch src

# Check types without building
npx tsc --noEmit

# Format code (install prettier first)
npm install -D prettier
npx prettier --write src/

# Lint code (install eslint first)
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npx eslint src/
```

## Environment Setup

### Development
```bash
export CLARITY_API_TOKEN=your-dev-token
npm run dev
```

### Production
```bash
# Via environment
export CLARITY_API_TOKEN=your-prod-token
npm start

# Or via CLI
npm start -- --clarity_api_token=your-prod-token
```

## Contributing Guidelines

1. **Code Style**: Follow existing patterns
2. **Comments**: Add JSDoc for functions
3. **Types**: Use strict TypeScript
4. **Error Handling**: Always handle errors gracefully
5. **Logging**: Use `console.error()` for logs (stderr)
6. **Testing**: Test with real Clarity API before submitting

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Clarity API Docs](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Docs](https://nodejs.org/docs/latest/api/)

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Security**: See SECURITY.md
- **Code of Conduct**: See CODE_OF_CONDUCT.md
