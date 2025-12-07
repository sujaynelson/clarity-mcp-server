# Codebase Documentation

## Overview

This is a **Model Context Protocol (MCP) server** for the **Microsoft Clarity Data Export API**. It enables AI assistants like Claude to fetch and analyze Microsoft Clarity analytics data through a standardized protocol.

### What is Microsoft Clarity?

Microsoft Clarity is a free behavior analytics tool that provides insights into user interactions on websites through heatmaps, session recordings, and analytics data.

### What is MCP (Model Context Protocol)?

MCP is a protocol that allows AI assistants to interact with external tools and data sources in a standardized way. This server implements the MCP protocol to expose Microsoft Clarity data to AI assistants.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│  MCP Client     │  (e.g., Claude for Desktop)
│  (AI Assistant) │
└────────┬────────┘
         │ MCP Protocol (stdio)
         │
┌────────▼────────────────────────────────────────┐
│  clarity-mcp-server (This Application)         │
│  ┌──────────────────────────────────────────┐  │
│  │  MCP Server (index.ts)                   │  │
│  │  - Tool Registration                     │  │
│  │  - Parameter Validation (Zod)            │  │
│  │  - Configuration Management              │  │
│  └──────────────┬───────────────────────────┘  │
│                 │                               │
│  ┌──────────────▼───────────────────────────┐  │
│  │  API Client (fetchClarityData)           │  │
│  │  - HTTP Request Construction             │  │
│  │  - Token Authentication                  │  │
│  │  - Response Handling                     │  │
│  └──────────────┬───────────────────────────┘  │
└─────────────────┼───────────────────────────────┘
                  │ HTTPS
                  │
┌─────────────────▼────────────────────────────┐
│  Microsoft Clarity Data Export API          │
│  https://www.clarity.ms/export-data/api/v1  │
└──────────────────────────────────────────────┘
```

### Communication Flow

1. **MCP Client → MCP Server**: Client sends tool invocation requests via stdio (standard input/output)
2. **MCP Server → Clarity API**: Server makes authenticated HTTP requests to Clarity API
3. **Clarity API → MCP Server**: API returns JSON data with analytics metrics
4. **MCP Server → MCP Client**: Server formats and returns data to client

## Project Structure

```
clarity-mcp-server/
├── src/
│   ├── index.ts          # Main server implementation
│   └── cli.ts            # CLI entry point for npx
├── dist/                 # Compiled JavaScript (generated)
│   ├── index.js
│   └── cli.js
├── package.json          # Project metadata and dependencies
├── tsconfig.json         # TypeScript configuration
├── README.md             # User-facing documentation
└── CODEBASE.md          # This file - developer documentation
```

## Core Components

### 1. Configuration Management (`index.ts`)

The server supports flexible configuration through multiple sources:

```typescript
const getConfigValue = (name: string, fallback?: string): string | undefined => {
  // 1. Check command line args (--name=value)
  const commandArg = process.argv.find(arg => arg.startsWith(`--${name}=`));
  if (commandArg) {
    return commandArg.split('=')[1];
  }
  
  // 2. Check environment variables
  if (process.env[name] || process.env[name.toUpperCase()]) {
    return process.env[name] || process.env[name.toUpperCase()];
  }
  
  return fallback;
};
```

**Configuration Priority** (highest to lowest):
1. Tool parameter (provided in each request)
2. Command-line argument (`--clarity_api_token=...`)
3. Environment variable (`CLARITY_API_TOKEN`)

### 2. MCP Server Instance

```typescript
const server = new McpServer({
  name: "@microsoft/clarity-mcp-server",
  version: "1.0.0",
});
```

This creates an MCP server instance that:
- Registers tools (functions) that clients can invoke
- Handles communication via stdio transport
- Validates parameters using Zod schemas

### 3. Tool Registration: `get-clarity-data`

The server exposes a single tool for fetching Clarity data:

```typescript
server.tool(
  "get-clarity-data",                    // Tool name
  "Fetch Microsoft Clarity analytics data",  // Description
  {
    // Parameter schema (validated by Zod)
    numOfDays: z.number().min(1).max(3),
    dimensions: z.array(z.string()).optional(),
    metrics: z.array(z.string()).optional(),
    token: z.string().optional(),
  },
  async ({ numOfDays, dimensions, metrics, token }) => {
    // Tool implementation
  }
);
```

**Parameters:**
- `numOfDays` (required): Number of days to retrieve (1-3)
- `dimensions` (optional): Filter dimensions (max 3)
- `metrics` (optional): Specific metrics to return
- `token` (optional): API token (if not provided via config)

### 4. API Client (`fetchClarityData`)

Handles communication with the Microsoft Clarity API:

```typescript
async function fetchClarityData(
  token: string, 
  numOfDays: number, 
  dimensions: string[] = []
): Promise<any> {
  // Build query parameters
  const params = new URLSearchParams();
  params.append("numOfDays", numOfDays.toString());
  
  // Add up to 3 dimensions
  dimensions.slice(0, 3).forEach((dim, index) => {
    params.append(`dimension${index + 1}`, dim);
  });
  
  // Make authenticated request
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
}
```

**Key Features:**
- Enforces Clarity API constraints (max 3 dimensions)
- Bearer token authentication
- Error handling and logging

### 5. Data Processing

After fetching from the API, the server:

1. **Validates dimensions** against allowed list
2. **Filters metrics** if requested (case-insensitive matching)
3. **Formats response** as JSON
4. **Returns via MCP** to the client

```typescript
// Filter metrics if specified
if (metrics && metrics.length > 0) {
  formattedResult = data.filter((item: any) => 
    metrics.some(m => 
      item.metricName.toLowerCase() === m.toLowerCase() ||
      item.metricName.replace(/\s+/g, '').toLowerCase() === m.replace(/\s+/g, '').toLowerCase()
    )
  );
}
```

### 6. Transport Layer

Uses stdio (standard input/output) for MCP communication:

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

This allows the server to:
- Run as a subprocess of MCP clients
- Communicate via stdin/stdout
- Log diagnostics to stderr

## Available Dimensions and Metrics

### Dimensions (max 3 per request)
Used to filter and group data:
- `Browser` - Web browser used
- `Device` - Device type (desktop, mobile, tablet)
- `Country/Region` - Geographic location
- `OS` - Operating system
- `Source` - Traffic source
- `Medium` - Marketing medium
- `Campaign` - Marketing campaign
- `Channel` - Traffic channel
- `URL` - Page URL

### Metrics
Analytics data points returned by the API:
- `ScrollDepth` - How far users scroll
- `EngagementTime` - Time spent on site
- `Traffic` - Visitor counts
- `PopularPages` - Most visited pages
- `Browser` - Browser usage stats
- `Device` - Device usage stats
- `OS` - Operating system stats
- `Country/Region` - Geographic distribution
- `PageTitle` - Page titles
- `ReferrerURL` - Referral sources
- `DeadClickCount` - Clicks on non-interactive elements
- `ExcessiveScroll` - Excessive scrolling events
- `RageClickCount` - Rapid repeated clicks
- `QuickbackClick` - Quick back navigation
- `ScriptErrorCount` - JavaScript errors
- `ErrorClickCount` - Clicks after errors

## Dependencies

### Production Dependencies

1. **@modelcontextprotocol/sdk** (^1.10.2)
   - Core MCP protocol implementation
   - Provides `McpServer` and `StdioServerTransport`
   - Handles tool registration and communication

2. **zod** (^3.22.4)
   - Runtime type validation
   - Schema definition for tool parameters
   - Ensures type safety and validation

### Development Dependencies

1. **typescript** (^5.3.3)
   - TypeScript compiler
   - Provides static typing and modern JavaScript features

2. **@types/node** (^20.11.0)
   - TypeScript type definitions for Node.js
   - Enables type checking for Node.js APIs

## Build Process

### TypeScript Compilation

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc && node dist/index.js"
  }
}
```

**Build steps:**
1. `tsc` compiles TypeScript files from `src/` to JavaScript in `dist/`
2. Uses ES2022 target with Node16 modules
3. Generates standard JavaScript that runs in Node.js

### Module System

The project uses **ES Modules** (not CommonJS):
- `"type": "module"` in package.json
- Import statements use `.js` extensions
- Compatible with modern Node.js (v16+)

## CLI Entry Point

The `cli.ts` file is minimal:

```typescript
#!/usr/bin/env node
import './index.js';
```

**Purpose:**
- Shebang allows execution as a command (`clarity-mcp-server`)
- Imports and runs the main server
- Registered as `bin` in package.json for npm installation

## API Integration

### Endpoint
```
https://www.clarity.ms/export-data/api/v1/project-live-insights
```

### Request Format
```
GET /project-live-insights?numOfDays=1&dimension1=Browser&dimension2=Device
Authorization: Bearer <token>
```

### Response Format
The API returns an array of metric objects:
```json
[
  {
    "metricName": "Traffic",
    "dimension1": "Chrome",
    "dimension2": "Desktop",
    "value": 1234
  },
  ...
]
```

### API Constraints

1. **Rate Limiting**: Max 10 requests per project per day
2. **Time Range**: Only 1-3 days in the past
3. **Dimensions**: Maximum 3 dimensions per request
4. **Response Size**: Limited to 1,000 rows (no pagination)

## Error Handling

The server implements comprehensive error handling:

1. **Missing Token**
   ```typescript
   if (!finalToken) {
     return { content: [{ type: "text", text: "No Clarity API token provided..." }] };
   }
   ```

2. **API Errors**
   ```typescript
   if (!response.ok) {
     throw new Error(`API request failed with status ${response.status}`);
   }
   ```

3. **Invalid Dimensions**
   ```typescript
   const filteredDimensions = dimensions.filter(d => AVAILABLE_DIMENSIONS.includes(d));
   if (filteredDimensions.length < dimensions.length) {
     console.warn("Some dimensions were invalid and have been filtered out");
   }
   ```

## Logging

Uses `console.error()` for logging (sent to stderr, not stdout):
- Configuration status on startup
- API request URLs (for debugging)
- Warnings for invalid dimensions
- Server ready message

**Why stderr?** MCP communication happens via stdout/stdin, so logs must use stderr to avoid protocol interference.

## Usage Example

### Client Request
```javascript
{
  "tool": "get-clarity-data",
  "parameters": {
    "numOfDays": 2,
    "dimensions": ["Browser", "Device"],
    "metrics": ["Traffic", "EngagementTime"]
  }
}
```

### Server Response
```json
{
  "content": [{
    "type": "text",
    "text": "[{\"metricName\":\"Traffic\",\"dimension1\":\"Chrome\",\"dimension2\":\"Desktop\",\"value\":1500}]"
  }]
}
```

## Security Considerations

1. **Token Storage**: API tokens should be:
   - Stored in environment variables or secure config
   - Never committed to source control
   - Rotated regularly

2. **Authentication**: Uses Bearer token authentication
   - Token sent in Authorization header
   - Required for all API requests

3. **Input Validation**: All parameters validated with Zod schemas
   - Type checking
   - Range validation (e.g., numOfDays 1-3)
   - Array validation

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server
npm start

# Or build and run in one step
npm run dev
```

### Testing with an MCP Client
1. Configure Claude for Desktop or another MCP client
2. Add server configuration with your API token
3. Restart the client
4. Ask the AI to fetch Clarity data

### Publishing
```bash
# Build before publishing (automatic via prepublishOnly)
npm publish
```

The `prepublishOnly` script ensures the project is always built before publishing to npm.

## Extension Points

To extend this server:

1. **Add New Tools**: Register additional tools with `server.tool()`
2. **Add New Dimensions/Metrics**: Update the constants and validation
3. **Add Caching**: Implement response caching to reduce API calls
4. **Add Data Transformation**: Process data before returning to client
5. **Add Multiple Projects**: Support querying multiple Clarity projects

## Troubleshooting

### Common Issues

1. **"No Clarity API token provided"**
   - Solution: Provide token via parameter, environment variable, or CLI arg

2. **"API request failed with status 401"**
   - Solution: Check that your API token is valid and not expired

3. **"API request failed with status 429"**
   - Solution: You've exceeded the 10 requests/day limit

4. **Empty Results**
   - Check that your project has data for the requested time period
   - Verify dimensions are spelled correctly

### Debug Mode

Enable debug logging by examining stderr output:
```bash
node dist/index.js 2> debug.log
```

## Related Documentation

- [README.md](./README.md) - User installation and setup guide
- [Microsoft Clarity API Documentation](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)

## Contributing

When contributing to this codebase:

1. Follow the existing code style (TypeScript with strict mode)
2. Add error handling for new features
3. Update this documentation for architectural changes
4. Test with actual Clarity API before submitting
5. Ensure `npm run build` succeeds without errors

## Version History

- **1.0.1**: Current published version
- **1.0.0**: Initial release

## License

MIT License - See [LICENSE](./LICENSE) file for details.
