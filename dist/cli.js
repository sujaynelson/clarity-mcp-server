#!/usr/bin/env node
/**
 * CLI Entry Point for clarity-mcp-server
 *
 * This file serves as the executable entry point when the package is:
 * - Installed globally: `npm install -g @microsoft/clarity-mcp-server`
 * - Run via npx: `npx @microsoft/clarity-mcp-server`
 * - Run as a command: `clarity-mcp-server`
 *
 * The shebang (#!/usr/bin/env node) allows this file to be executed directly
 * as a command. The package.json "bin" field maps the command name to this file.
 *
 * This file simply imports and runs the main server implementation from index.js.
 * All the actual server logic is in index.ts.
 */
// Import the main server module, which will start the MCP server
import './index.js';
