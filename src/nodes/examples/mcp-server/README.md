# MCP Server Node for nanoservice-ts

This node integrates the Model Context Protocol (MCP) Framework with nanoservice-ts, allowing you to create MCP-compatible HTTP servers as nanoservices.

## What is MCP?

The Model Context Protocol (MCP) is a standard that allows AI assistants to communicate with external tools and services in a structured way. It enables AIs to access real-time data, perform actions, and interact with the world.

## Features

- Create HTTP MCP servers that expose tools to AI assistants
- Define tools using JSON configuration in workflows
- Connect to external APIs for real-time data (weather, stocks, etc.)
- Includes a built-in UI for testing tools
- Supports streaming and batch responses
- Configurable CORS and session management

## How to Use

### 1. Create a Workflow

Create a workflow JSON file in `workflows/json/` (see example below).

### 2. Define Tools

In your workflow, define tools using the following structure:

```json
{
  "name": "weather",
  "description": "Get weather information for a city",
  "schema": {
    "city": {
      "type": {
        "type": "string"
      },
      "description": "City name to get weather for"
    }
  },
  "implementation": "// Make HTTP call to the weather API\ntry {\n  const response = await axios.post(`${baseUrl}/weather-tool`, { city: inputs.city });\n  return response.data;\n} catch (error) {\n  return { error: error.message };\n}"
}
```

The `implementation` field contains JavaScript code that will be executed when the tool is called.

### 3. Integrating with Real APIs

You can create powerful tools by connecting to external APIs:

1. **Define a dedicated node** (like our `weather-tool-node`) that handles API calls
2. **Create a workflow** (like `weather-tool.json`) that exposes the node via HTTP
3. **Configure your MCP server** to call this workflow when the tool is invoked

Example of a real weather API implementation:

```typescript
// In your node implementation:
const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
const geocodingResponse = await axios.get(geocodingUrl);
      
// Get coordinates and call weather API
const { latitude, longitude } = geocodingResponse.data.results[0];
const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`;
const weatherResponse = await axios.get(weatherUrl);
```

### 4. Configure Server Options

Configure server options in your workflow:

```json
"inputs": {
  "port": 3100,
  "cors": {
    "allowOrigin": "*"
  },
  "responseMode": "batch", // or "stream"
  "session": {
    "enabled": true,
    "headerName": "Mcp-Session-Id",
    "allowClientTermination": true
  },
  "tools": [
    // your tool definitions
  ]
}
```

## Testing

### Using the UI

1. Run your nanoservice with `npm run dev`
2. Access the MCP Server UI at the root path (e.g., `http://localhost:4000/`)
3. Use the built-in debug console to test tools

### Using mcp-debug

You can use the MCP Framework's debug tool to test your server:

```bash
npx mcp-debug
```

When prompted, enter your server URL: `http://localhost:3100/mcp`

### Using Curl

```bash
curl -X POST http://localhost:4000/execute -H "Content-Type: application/json" -d '{
  "name": "weather",
  "parameters": {
    "city": "London"
  }
}'
```

## Example Workflow

Here's a complete example workflow:

```json
{
  "name": "MCP Server",
  "description": "An MCP-compatible server that provides tools for AI assistants to use",
  "version": "1.0.0",
  "trigger": {
    "http": {
      "method": "*",
      "path": "/:function?",
      "accept": "application/json"
    }
  },
  "steps": [
    {
      "name": "filter-request",
      "node": "@nanoservice-ts/if-else",
      "type": "module"
    }
  ],
  "nodes": {
    "filter-request": {
      "conditions": [
        {
          "type": "if",
          "steps": [
            {
              "name": "mcp-server-ui",
              "node": "mcp-server-ui",
              "type": "module"
            }
          ],
          "condition": "ctx.request.method.toLowerCase() === \"get\" && ctx.request.params.function === undefined"
        },
        {
          "type": "if",
          "steps": [
            {
              "name": "mcp-server",
              "node": "mcp-server",
              "type": "module"
            }
          ],
          "condition": "ctx.request.method.toLowerCase() === \"post\" && (ctx.request.params.function === \"execute\" || ctx.request.params.function === undefined)"
        }
      ]
    },
    "mcp-server": {
      "inputs": {
        "port": 3100,
        "cors": {
          "allowOrigin": "*"
        },
        "tools": [
          {
            "name": "weather",
            "description": "Get weather information for a city",
            "schema": {
              "city": {
                "type": {
                  "type": "string"
                },
                "description": "City name to get weather for"
              }
            },
            "implementation": "// Make a call to our weather-tool workflow\nconst baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';\nconst response = await axios.post(`${baseUrl}/weather-tool`, { city: inputs.city });\nreturn response.data;"
          }
        ]
      }
    },
    "mcp-server-ui": {
      "inputs": {
        "title": "MCP Server Dashboard",
        "port": 3100
      }
    }
  }
}
```

## Requirements

- nanoservice-ts
- Node.js v18.19.0 or later
- mcp-framework (installed automatically as a dependency)

## Troubleshooting

- If the server doesn't start, check for port conflicts
- Make sure the implementation code is valid JavaScript
- Check that schema definitions match the MCP Framework requirements
- For external API calls, ensure proper URL formatting and error handling
- When working with path parameters, avoid leading slashes in workflow paths 