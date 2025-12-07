/**
 * Microsoft Clarity MCP Server
 *
 * This MCP (Model Context Protocol) server enables AI assistants to fetch
 * analytics data from Microsoft Clarity's Data Export API.
 *
 * Key Features:
 * - Fetch analytics data for 1-3 days
 * - Filter by up to 3 dimensions (Browser, Device, Country, etc.)
 * - Retrieve specific metrics (Traffic, Engagement, etc.)
 * - Flexible configuration (CLI args, env vars, or parameters)
 *
 * @see https://modelcontextprotocol.io/ - MCP Protocol Documentation
 * @see https://learn.microsoft.com/en-us/clarity/ - Microsoft Clarity Documentation
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
/**
 * Retrieves configuration values from multiple sources with priority:
 * 1. Command-line arguments (--name=value)
 * 2. Environment variables (name or NAME)
 * 3. Fallback value
 *
 * @param name - The configuration key to look up
 * @param fallback - Optional default value if not found
 * @returns The configuration value or undefined
 *
 * @example
 * // From CLI: node index.js --clarity_api_token=abc123
 * getConfigValue('clarity_api_token') // Returns: 'abc123'
 *
 * @example
 * // From env: CLARITY_API_TOKEN=xyz789
 * getConfigValue('clarity_api_token') // Returns: 'xyz789'
 */
const getConfigValue = (name, fallback) => {
    // Priority 1: Check command line args first (format: --name=value)
    const commandArg = process.argv.find(arg => arg.startsWith(`--${name}=`));
    if (commandArg) {
        return commandArg.split('=')[1];
    }
    // Priority 2: Check environment variables (supports both lowercase and uppercase)
    if (process.env[name] || process.env[name.toUpperCase()]) {
        return process.env[name] || process.env[name.toUpperCase()];
    }
    // Priority 3: Return fallback value (if provided)
    return fallback;
};
/**
 * Load the Clarity API token from configuration sources
 * This allows flexibility in how users provide their credentials
 */
const CLARITY_API_TOKEN = getConfigValue('clarity_api_token');
/**
 * Create the MCP server instance
 * This server handles tool registration and communication with MCP clients
 */
const server = new McpServer({
    name: "@microsoft/clarity-mcp-server",
    version: "1.0.0",
});
/**
 * Base URL for the Microsoft Clarity Data Export API
 * All analytics data requests are sent to this endpoint
 */
const API_BASE_URL = "https://www.clarity.ms/export-data/api/v1/project-live-insights";
/**
 * Available metrics that can be returned by the Clarity API
 * These represent different types of analytics data that can be retrieved
 *
 * Categories:
 * - Engagement: ScrollDepth, EngagementTime
 * - Traffic: Traffic, PopularPages
 * - Technical: Browser, Device, OS, Country/Region
 * - Content: PageTitle, ReferrerURL
 * - User Behavior Issues: DeadClick, ExcessiveScroll, RageClick, etc.
 */
const AVAILABLE_METRICS = [
    "ScrollDepth",
    "EngagementTime",
    "Traffic",
    "PopularPages",
    "Browser",
    "Device",
    "OS",
    "Country/Region",
    "PageTitle",
    "ReferrerURL",
    "DeadClickCount",
    "ExcessiveScroll",
    "RageClickCount",
    "QuickbackClick",
    "ScriptErrorCount",
    "ErrorClickCount"
];
/**
 * Available dimensions for filtering and grouping analytics data
 *
 * Maximum of 3 dimensions can be used per API request
 * Dimensions allow you to segment data by various criteria:
 *
 * - Technical: Browser, Device, OS
 * - Geographic: Country/Region
 * - Marketing: Source, Medium, Campaign, Channel
 * - Content: URL
 *
 * @example
 * // Get traffic data segmented by Browser and Device
 * dimensions: ["Browser", "Device"]
 */
const AVAILABLE_DIMENSIONS = [
    "Browser",
    "Device",
    "Country/Region",
    "OS",
    "Source",
    "Medium",
    "Campaign",
    "Channel",
    "URL"
];
/**
 * Fetches analytics data from the Microsoft Clarity Data Export API
 *
 * This function handles the HTTP communication with Clarity's API:
 * 1. Constructs the query parameters
 * 2. Makes an authenticated GET request
 * 3. Parses and returns the JSON response
 *
 * @param token - Bearer token for API authentication
 * @param numOfDays - Number of days to retrieve (1-3)
 * @param dimensions - Optional array of dimensions to filter by (max 3)
 * @returns Promise resolving to analytics data or error object
 *
 * @example
 * const data = await fetchClarityData(
 *   'your-token',
 *   2,
 *   ['Browser', 'Device']
 * );
 *
 * @see https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
 */
async function fetchClarityData(token, numOfDays, dimensions = []) {
    try {
        // Build URL query parameters for the API request
        const params = new URLSearchParams();
        params.append("numOfDays", numOfDays.toString());
        // Add dimensions to the request (maximum 3 allowed by the API)
        // The API expects them as dimension1, dimension2, dimension3
        dimensions.slice(0, 3).forEach((dim, index) => {
            params.append(`dimension${index + 1}`, dim);
        });
        // Construct the full URL with query parameters
        const url = `${API_BASE_URL}?${params.toString()}`;
        // Log the request URL to stderr for debugging (doesn't interfere with MCP protocol on stdout)
        console.error(`Making request to: ${url}`);
        // Make the authenticated HTTP GET request
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Bearer token authentication
            }
        });
        // Check if the request was successful
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        // Parse and return the JSON response
        return await response.json();
    }
    catch (error) {
        // Log errors to stderr (doesn't interfere with MCP protocol)
        console.error("Error fetching Clarity data:", error);
        // Return error object instead of throwing to allow graceful handling
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}
/**
 * Register the 'get-clarity-data' tool with the MCP server
 *
 * This is the main (and only) tool exposed by this server.
 * It allows MCP clients to fetch Microsoft Clarity analytics data.
 *
 * Tool Parameters (all validated by Zod):
 * - numOfDays: Required, 1-3 days of data
 * - dimensions: Optional, up to 3 filter dimensions
 * - metrics: Optional, filter for specific metrics
 * - token: Optional, API token (if not provided via config)
 *
 * Processing Flow:
 * 1. Validate and get API token
 * 2. Validate dimensions against allowed list
 * 3. Fetch data from Clarity API
 * 4. Filter metrics if requested
 * 5. Return formatted JSON response
 */
server.tool("get-clarity-data", "Fetch Microsoft Clarity analytics data", {
    // Parameter validation schemas using Zod
    numOfDays: z.number().min(1).max(3).describe("Number of days to retrieve data for (1-3)"),
    dimensions: z.array(z.string()).optional().describe("Up to 3 dimensions to filter by (Browser, Device, Country/Region, OS, Source, Medium, Campaign, Channel, URL)"),
    metrics: z.array(z.string()).optional().describe("Metrics to retrieve (Scroll Depth, Engagement Time, Traffic, Popular Pages, Browser, Device, OS, Country/Region, etc.)"),
    token: z.string().optional().describe("Your Clarity API token (optional if provided via environment or command line)"),
}, async ({ numOfDays, dimensions = [], metrics = [], token }) => {
    // Step 1: Determine which token to use (parameter > CLI arg > env var)
    const finalToken = token || CLARITY_API_TOKEN;
    // Step 2: Validate that we have a token from any source
    if (!finalToken) {
        return {
            content: [
                {
                    type: "text",
                    text: "No Clarity API token provided. Please provide a token via the 'token' parameter, CLARITY_API_TOKEN environment variable, or --clarity_api_token command-line argument.",
                },
            ],
        };
    }
    // Step 3: Validate dimensions against the list of supported dimensions
    // This prevents invalid dimensions from being sent to the API
    const filteredDimensions = dimensions.filter(d => AVAILABLE_DIMENSIONS.includes(d));
    if (filteredDimensions.length < dimensions.length) {
        console.warn("Some dimensions were invalid and have been filtered out");
    }
    // Step 4: Fetch data from the Clarity API
    const data = await fetchClarityData(finalToken, numOfDays, filteredDimensions);
    // Step 5: Check for API errors
    if (data.error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error fetching data: ${data.error}`,
                },
            ],
        };
    }
    // Step 6: Filter metrics if the user requested specific ones
    // This is done client-side since the API returns all metrics
    let formattedResult = data;
    if (metrics && metrics.length > 0) {
        // Case-insensitive matching with whitespace normalization
        // Supports both "Scroll Depth" and "ScrollDepth" formats
        formattedResult = data.filter((item) => metrics.some(m => item.metricName.toLowerCase() === m.toLowerCase() ||
            item.metricName.replace(/\s+/g, '').toLowerCase() === m.replace(/\s+/g, '').toLowerCase()));
    }
    // Step 7: Format the result as JSON and return to the MCP client
    const resultText = JSON.stringify(formattedResult, null, 2);
    return {
        content: [
            {
                type: "text",
                text: resultText,
            },
        ],
    };
});
/**
 * Main function - Initializes and starts the MCP server
 *
 * Steps:
 * 1. Log configuration status to stderr
 * 2. Create stdio transport for MCP protocol
 * 3. Connect server to transport
 * 4. Log startup message
 *
 * The server runs indefinitely, listening for tool invocations
 * via stdin and responding via stdout.
 */
async function main() {
    // Log configuration status to help with debugging
    // (stderr is used so it doesn't interfere with MCP protocol on stdout)
    if (CLARITY_API_TOKEN) {
        console.error("Clarity API token configured via environment/command-line");
    }
    else {
        console.error("No Clarity API token configured, it must be provided with each request");
    }
    // Log available options to help users understand what's supported
    console.error(`Supported metrics: ${AVAILABLE_METRICS.join(", ")}`);
    console.error(`Supported dimensions: ${AVAILABLE_DIMENSIONS.join(", ")}`);
    // Create stdio transport - enables communication via stdin/stdout
    // This is the standard way MCP servers communicate with clients
    const transport = new StdioServerTransport();
    // Connect the server to the transport and start listening
    await server.connect(transport);
    // Log that the server is ready
    console.error("Microsoft Clarity Data Export MCP Server running on stdio");
}
/**
 * Start the server and handle any fatal errors
 *
 * If an error occurs during startup or execution,
 * log it and exit with a non-zero code.
 */
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
