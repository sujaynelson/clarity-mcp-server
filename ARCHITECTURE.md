# Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP Client Layer                                  │
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐ │
│  │ Claude Desktop    │  │  Other MCP       │  │  Custom MCP             │ │
│  │                   │  │  Clients         │  │  Implementations        │ │
│  └─────────┬─────────┘  └────────┬─────────┘  └───────────┬─────────────┘ │
└────────────┼──────────────────────┼─────────────────────────┼───────────────┘
             │                      │                         │
             └──────────────────────┴─────────────────────────┘
                                    │
                          stdio (stdin/stdout)
                          JSON-RPC over MCP
                                    │
┌────────────────────────────────────┼─────────────────────────────────────────┐
│                                    │                                         │
│              clarity-mcp-server (Node.js Process)                           │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐ │
│  │                    MCP Protocol Layer                                  │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ @modelcontextprotocol/sdk                                        │ │ │
│  │  │  - McpServer: Protocol handler                                   │ │ │
│  │  │  - StdioServerTransport: stdio communication                     │ │ │
│  │  │  - Tool registration & invocation                                │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────┬──────────────────────────────────────┘ │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐ │
│  │                    Application Layer (index.ts)                        │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Configuration Manager                                           │  │ │
│  │  │   - getConfigValue(): Multi-source config resolution            │  │ │
│  │  │   - Priority: CLI args > env vars > defaults                    │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Tool: get-clarity-data                                          │  │ │
│  │  │   Input:                                                          │  │ │
│  │  │    - numOfDays: 1-3                                              │  │ │
│  │  │    - dimensions: array (max 3)                                   │  │ │
│  │  │    - metrics: array (optional filter)                            │  │ │
│  │  │    - token: string (optional)                                    │  │ │
│  │  │                                                                   │  │ │
│  │  │   Processing:                                                     │  │ │
│  │  │    1. Validate token availability                                │  │ │
│  │  │    2. Filter dimensions against allowed list                     │  │ │
│  │  │    3. Call fetchClarityData()                                    │  │ │
│  │  │    4. Filter metrics if requested                                │  │ │
│  │  │    5. Format and return JSON                                     │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Parameter Validation (Zod)                                      │  │ │
│  │  │   - Type checking at runtime                                     │  │ │
│  │  │   - Range validation                                             │  │ │
│  │  │   - Required vs optional parameters                              │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────┬──────────────────────────────────────┘ │
│                                    │                                         │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐ │
│  │                    API Client Layer                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  fetchClarityData()                                              │ │ │
│  │  │   - Construct query parameters                                   │ │ │
│  │  │   - Add Bearer token to headers                                  │ │ │
│  │  │   - Make HTTP GET request                                        │ │ │
│  │  │   - Parse JSON response                                          │ │ │
│  │  │   - Handle errors                                                │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────┬──────────────────────────────────────┘ │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                               HTTPS (TLS)
                           Authorization: Bearer
                                     │
┌────────────────────────────────────▼─────────────────────────────────────────┐
│                    Microsoft Clarity API                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Endpoint: /export-data/api/v1/project-live-insights                  │ │
│  │                                                                         │ │
│  │  Query Parameters:                                                     │ │
│  │   - numOfDays: 1-3                                                     │ │
│  │   - dimension1: optional                                               │ │
│  │   - dimension2: optional                                               │ │
│  │   - dimension3: optional                                               │ │
│  │                                                                         │ │
│  │  Response: JSON array of metric objects                               │ │
│  │  [                                                                     │ │
│  │    {                                                                   │ │
│  │      "metricName": "Traffic",                                          │ │
│  │      "dimension1": "Chrome",                                           │ │
│  │      "value": 1234                                                     │ │
│  │    }                                                                   │ │
│  │  ]                                                                     │ │
│  │                                                                         │ │
│  │  Constraints:                                                          │ │
│  │   - Max 10 requests per project per day                               │ │
│  │   - Data from 1-3 days ago only                                       │ │
│  │   - Max 1,000 rows per response                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### Scenario: User asks Claude to fetch Clarity data

```
┌─────────┐         ┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│  User   │         │   Claude    │         │ clarity-mcp-     │         │  Clarity     │
│         │         │  Desktop    │         │    server        │         │     API      │
└────┬────┘         └──────┬──────┘         └────────┬─────────┘         └──────┬───────┘
     │                     │                          │                          │
     │ "Get Clarity data   │                          │                          │
     │  for last 2 days"   │                          │                          │
     ├────────────────────>│                          │                          │
     │                     │                          │                          │
     │                     │ 1. Parse user intent     │                          │
     │                     │    and extract params    │                          │
     │                     │                          │                          │
     │                     │ 2. Tool invocation       │                          │
     │                     │    (MCP protocol)        │                          │
     │                     ├─────────────────────────>│                          │
     │                     │    {                     │                          │
     │                     │      tool: "get-clarity-data"                       │
     │                     │      params: {           │                          │
     │                     │        numOfDays: 2      │                          │
     │                     │      }                   │                          │
     │                     │    }                     │                          │
     │                     │                          │                          │
     │                     │                          │ 3. Validate parameters   │
     │                     │                          │    (Zod schemas)         │
     │                     │                          │                          │
     │                     │                          │ 4. Get API token         │
     │                     │                          │    (config/env/param)    │
     │                     │                          │                          │
     │                     │                          │ 5. Build API request     │
     │                     │                          │                          │
     │                     │                          │ 6. HTTPS GET             │
     │                     │                          ├─────────────────────────>│
     │                     │                          │  GET /project-live-insights?numOfDays=2
     │                     │                          │  Authorization: Bearer...│
     │                     │                          │                          │
     │                     │                          │                          │ 7. Query analytics
     │                     │                          │                          │    database
     │                     │                          │                          │
     │                     │                          │ 8. JSON response         │
     │                     │                          │<─────────────────────────┤
     │                     │                          │  [                       │
     │                     │                          │    {metricName: "Traffic", value: 1234},
     │                     │                          │    ...                   │
     │                     │                          │  ]                       │
     │                     │                          │                          │
     │                     │                          │ 9. Filter metrics        │
     │                     │                          │    (if requested)        │
     │                     │                          │                          │
     │                     │                          │ 10. Format response      │
     │                     │                          │                          │
     │                     │ 11. Tool response        │                          │
     │                     │     (MCP protocol)       │                          │
     │                     │<─────────────────────────┤                          │
     │                     │    {                     │                          │
     │                     │      content: [{         │                          │
     │                     │        type: "text",     │                          │
     │                     │        text: "[{...}]"   │                          │
     │                     │      }]                  │                          │
     │                     │    }                     │                          │
     │                     │                          │                          │
     │                     │ 12. Parse & format       │                          │
     │                     │     for display          │                          │
     │                     │                          │                          │
     │ 13. Natural language│                          │                          │
     │     response with   │                          │                          │
     │     analytics data  │                          │                          │
     │<────────────────────┤                          │                          │
     │                     │                          │                          │
```

## Component Interaction Details

### 1. Configuration Resolution

```
┌────────────────────────────────────┐
│   getConfigValue("clarity_api_token") │
└────────────┬───────────────────────┘
             │
             ├──> Check process.argv
             │    for --clarity_api_token=xxx
             │    ├─ Found? Return value
             │    └─ Not found? Continue
             │
             ├──> Check process.env.clarity_api_token
             │    ├─ Found? Return value
             │    └─ Not found? Continue
             │
             ├──> Check process.env.CLARITY_API_TOKEN
             │    ├─ Found? Return value
             │    └─ Not found? Continue
             │
             └──> Return fallback (undefined)
```

### 2. Tool Execution Flow

```
┌──────────────────────────────────────────┐
│  server.tool() registers handler         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Client invokes tool via MCP             │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Zod validates parameters                │
│   - Type checks                          │
│   - Range checks (numOfDays: 1-3)        │
│   - Required vs optional                 │
└──────────────┬───────────────────────────┘
               │ Valid
               ▼
┌──────────────────────────────────────────┐
│  Get token (param > CLI > env)           │
└──────────────┬───────────────────────────┘
               │ Token available
               ▼
┌──────────────────────────────────────────┐
│  Filter dimensions against allowed list  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  fetchClarityData()                      │
│   - Build query params                   │
│   - Make HTTP request                    │
│   - Parse response                       │
└──────────────┬───────────────────────────┘
               │ Success
               ▼
┌──────────────────────────────────────────┐
│  Filter metrics (if requested)           │
│   - Case-insensitive match               │
│   - Remove whitespace for matching       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Format as JSON and return               │
└──────────────────────────────────────────┘
```

### 3. Error Handling Flow

```
Error Type                  Handler                      Response
─────────────────────────────────────────────────────────────────
No token                    Check finalToken             Error message
                            in tool handler              via MCP

Invalid parameters          Zod validation               Validation error
                            (automatic)                  via MCP

API HTTP error             try/catch in                 Error message
                           fetchClarityData()            via MCP

Network error              try/catch in                 Error message
                           fetchClarityData()            via MCP

Invalid dimension          Filter before API             Warning to stderr
                           call                         Continue with valid ones

JSON parse error           await response.json()        Error via MCP
                           catch
```

## Technology Stack

```
┌─────────────────────────────────────────────┐
│           Application Layer                 │
│                                             │
│  Language: TypeScript                       │
│  Runtime: Node.js v16+                      │
│  Module System: ES Modules                  │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           Framework Layer                   │
│                                             │
│  MCP SDK: @modelcontextprotocol/sdk         │
│   - Protocol implementation                 │
│   - Server framework                        │
│   - Transport layer                         │
│                                             │
│  Validation: Zod                            │
│   - Runtime type checking                   │
│   - Schema validation                       │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│           Platform Layer                    │
│                                             │
│  Node.js APIs:                              │
│   - process.argv (CLI args)                 │
│   - process.env (environment)               │
│   - fetch (HTTP client)                     │
│   - stdio (stdin/stdout/stderr)             │
└─────────────────────────────────────────────┘
```

## Deployment Models

### Model 1: Claude for Desktop
```
┌─────────────────────────┐
│  Claude Desktop App     │
│  ┌──────────────────┐   │
│  │  Main Process    │   │
│  └────────┬─────────┘   │
│           │ spawns      │
│  ┌────────▼─────────┐   │
│  │  clarity-mcp-    │   │
│  │  server          │   │
│  │  (subprocess)    │   │
│  └──────────────────┘   │
└─────────────────────────┘
```

### Model 2: Standalone Server
```
┌──────────────────┐
│  Terminal        │
│  $ clarity-mcp-  │
│    server        │
│                  │
│  (reads from     │
│   stdin,         │
│   writes to      │
│   stdout)        │
└──────────────────┘
```

### Model 3: Custom Integration
```
┌────────────────────────┐
│  Custom Application    │
│  ┌──────────────────┐  │
│  │  child_process   │  │
│  │  .spawn()        │  │
│  └────────┬─────────┘  │
│           │            │
│  ┌────────▼─────────┐  │
│  │  clarity-mcp-    │  │
│  │  server          │  │
│  └──────────────────┘  │
└────────────────────────┘
```

## Performance Considerations

### Bottlenecks

1. **API Rate Limit**: 10 requests/day per project
   - Mitigation: Consider caching responses
   - User education: Plan queries efficiently

2. **Response Size**: Max 1,000 rows
   - Limitation: Cannot paginate
   - Mitigation: Use dimensions to narrow results

3. **Network Latency**: External API calls
   - Typical latency: 200-500ms
   - No mitigation in current implementation

### Scalability

- **Single-threaded**: Node.js event loop
- **No connection pooling**: Each request = new HTTP connection
- **Stateless**: No session management
- **Low resource usage**: Minimal memory footprint

## Security Architecture

### Defense Layers

```
1. Input Validation
   └─> Zod schemas validate all tool parameters

2. Authentication
   └─> Bearer token required for API access

3. Least Privilege
   └─> Read-only access to Clarity data
   └─> No write operations supported

4. Secure Communication
   └─> HTTPS to Clarity API
   └─> stdio to MCP client (local)

5. No Credential Storage
   └─> Tokens from config/env/params only
   └─> Never persisted to disk
```

### Threat Model

**Assets:**
- Microsoft Clarity API token
- Analytics data

**Threats:**
- Token leakage via logs → Mitigated (token not logged)
- Token in source control → Mitigated (docs warn against)
- MITM attacks → Mitigated (HTTPS)
- Injection attacks → Mitigated (Zod validation)

## Future Enhancement Opportunities

1. **Caching Layer**
   - Cache API responses
   - Reduce API calls
   - Faster response times

2. **Multi-Project Support**
   - Query multiple Clarity projects
   - Aggregate data across projects

3. **Data Transformation**
   - Statistical analysis
   - Trend detection
   - Anomaly detection

4. **Additional Tools**
   - Project listing
   - Token validation
   - Rate limit checking

5. **Response Formatting**
   - CSV output
   - Chart generation
   - Summary statistics
