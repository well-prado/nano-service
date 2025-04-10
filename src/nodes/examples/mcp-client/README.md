# MCP Client for ChatGPT UI

This module integrates the Model Context Protocol (MCP) with the Nanoservice ChatGPT UI, allowing you to connect to MCP servers and use their tools with AI models like OpenAI's GPT-4 or Anthropic's Claude.

## Features

- Connect to any MCP-compatible server
- Use tools provided by MCP servers with AI models
- Support for both OpenAI (GPT) and Anthropic (Claude) models
- Proactive tool detection for weather queries
- Seamless integration with the existing ChatGPT UI

## How It Works

The MCP Client node acts as a bridge between AI models and MCP servers:

1. It fetches available tools from an MCP server
2. It sends these tools along with user queries to the AI model
3. When the AI wants to use a tool, it executes the tool on the MCP server
4. It returns the tool results back to the AI model for final processing
5. The complete conversation is displayed in the ChatGPT UI

## Using the MCP Client

### Accessing the UI

Navigate to `/chatgpt-mcp` in your browser to access the ChatGPT UI with MCP support.

### Connecting to an MCP Server

1. Open the Settings modal in the ChatGPT UI
2. Enter your OpenAI API key (for GPT models) or Anthropic API key (for Claude models)
3. Select the model you want to use
4. Enter the MCP server URL (e.g., `/auto-mcp-server` for the local server)
5. Save settings

### Available MCP Servers

The system comes pre-configured with:

- **Local MCP Server** at `/auto-mcp-server` which provides:
  - `weather_tool` - Get real-time weather information for any city using Open-Meteo API
  - `calculator` - Perform basic arithmetic calculations

You can connect to any other MCP-compatible server by entering its URL.

### Weather Tool

The enhanced weather tool now provides real-time data using the Open-Meteo API, including:

- Current temperature
- Weather conditions (Clear, Cloudy, Rainy, etc.)
- Humidity percentage
- Wind speed
- City name as recognized by the geocoding service

The tool handles city names in multiple formats and provides accurate, up-to-date weather information without requiring any API keys.

## API Endpoints

The MCP-enabled ChatGPT workflow exposes these endpoints:

- `GET /` - Main ChatGPT UI interface
- `GET /workflows` - List available workflows
- `GET /mcp-servers` - List available MCP servers
- `POST /mcp-chat-completion` - Process queries using MCP tools
- `POST /chat-completion` - Regular ChatGPT completions (without MCP)

## Example Usage

Here are some examples of how to use the MCP client with AI models:

### Weather Tool

```
What's the weather like in Toronto?
```

The AI will recognize this as a weather query, extract "Toronto" as the city, use the weather tool from the MCP server, and provide the real-time weather results.

### Calculator Tool

```
Calculate 128 * 45 - 37
```

The AI will recognize this as a calculation, use the calculator tool from the MCP server, and show the result.

## Customization

You can add more MCP servers by editing the `chatgpt-mcp.json` workflow file and adding entries to the `list-mcp-servers` node.

## Troubleshooting

- If you see "No tools found" errors, make sure your MCP server URL is correct and the server is running
- For authentication errors, check that your API keys are entered correctly
- If tool execution fails, check that the MCP server is accessible and functioning properly
- When using external APIs through tools, ensure proper network connectivity 