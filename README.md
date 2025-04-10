# Nanoservice-ts with Model Context Protocol (MCP)

A revolutionary implementation of the Model Context Protocol for LLM integration, using a modular, stateless architecture.

## Overview

This project implements a state-of-the-art Model Context Protocol (MCP) framework integrated into nanoservice-ts. It provides a stateless, scalable approach to connecting AI models with external tools and workflows.

Key architectural innovations:

- **Stateless MCP Server**: Unlike traditional MCP implementations that maintain server state, our implementation operates in a completely stateless manner, making it ideal for serverless and microservice architectures.
- **Workflow Integration**: Direct integration with the nanoservice workflow system, allowing any workflow to be exposed as an MCP tool.
- **Dual-Model Support**: Works with both OpenAI (GPT) and Anthropic (Claude) models.
- **Dynamic Tool Discovery**: Automatically discovers tools from both nodes and workflows.

## Components

### MCP Server (`StatelessMCPNode`)

The MCP Server is implemented as a nanoservice node that:

- Discovers tools from registered nodes and workflows
- Implements the standard MCP endpoints (`/tools`, `/execute`, `/`)
- Handles execution of tools via direct invocation or HTTP calls
- Provides special handling for critical tools like weather and calculator
- Operates without maintaining server state between requests

```typescript
// Example of initializing the MCP server
const mcpServer = new StatelessMCPNode();
```

### MCP Client (`MCPClient`)

The client node connects to any MCP server and processes queries using AI models:

- Formats messages and tools for OpenAI/Anthropic consumption
- Handles authentication with both OpenAI and Anthropic APIs
- Manages tool execution via the MCP protocol
- Handles multi-tool execution and parallel tool usage
- Provides proper sanitization and conversion between different API formats

```typescript
// Example workflow usage
{
  "name": "chat-with-mcp",
  "steps": [
    {
      "name": "complete-chat",
      "node": "mcp-client",
      "type": "module"
    }
  ],
  "nodes": {
    "complete-chat": {
      "inputs": {
        "serverUrl": "http://localhost:4000/auto-mcp-server",
        "openaiApiKey": "${ctx.request.headers['x-api-key']}",
        "model": "gpt-4o",
        "messages": "js/ctx.request.body.messages"
      }
    }
  }
}
```

### Built-in Tools

The system comes with several built-in tools:

1. **Weather Tool**: Provides real-time weather data for any city
   - Integrates with Open-Meteo API for accurate global weather
   - Handles parameters and error cases gracefully
   - Provides fallback mechanisms for reliability

2. **Calculator Tool**: Evaluates mathematical expressions securely

3. **List Available Tools**: Special tool for discovery
   - Returns formatted list of all available tools
   - Supports category filtering
   - Provides user-friendly output with parameter details

## Stateless vs. Stateful Architecture

Traditional MCP implementations typically maintain state on the server, which:
- Increases memory usage
- Creates scalability challenges
- Introduces complexity in distributed environments

Our stateless implementation:
- Processes each request independently
- Has zero reliance on shared server state
- Scales horizontally without coordination overhead
- Integrates perfectly with serverless and containerized deployments

## Implementation Details

### Tool Integration

Tools are sourced from multiple locations:

1. **Node Registry**: Converts NanoService nodes to MCP tools
2. **Workflow Discovery**: Converts workflows to callable tools
3. **Manual Definition**: Allows explicit tool definitions

Each tool includes:
- Name and description
- JSON Schema for parameters
- Implementation code (executed in a sandboxed environment)

### Weather Tool Implementation

The weather tool demonstrates real API integration:

```typescript
// Weather tool implementation
const weatherTool = {
  name: "weather",
  description: "Get current weather information for any city worldwide",
  schema: {
    city: {
      type: { type: "string" },
      description: "The name of the city to get weather for"
    }
  },
  implementation: `
    // Makes real HTTP call to weather API
    const response = await axios.post("/weather-tool", { city: inputs.city });
    return response.data;
  `
};
```

### Model Integration

The system intelligently formats tools and messages for the specific AI model:

- **OpenAI**: Converts to function calling format with proper schema
- **Anthropic**: Uses the Claude tools format with appropriate messaging structure

## Getting Started

1. Start the nanoservice:
   ```
   npm run dev
   ```

2. Access the MCP server at:
   ```
   http://localhost:4000/auto-mcp-server
   ```

3. Use the ChatGPT interface workflow:
   ```
   http://localhost:4000/chatgpt-interface
   ```

## Advanced Usage

### Creating Custom Tools

Custom tools can be created through:

1. **Node Implementation**: Create a new nanoservice node and register it
2. **Workflow Definition**: Create a workflow in workflows/json/
3. **Direct Registration**: Add tools directly to the MCP server

### Debugging

The MCP server includes a debug mode that provides detailed logging:

```typescript
// Enable debug mode in workflow
{
  "nodes": {
    "mcp-server": {
      "inputs": {
        "debug_mode": true
      }
    }
  }
}
```

## Conclusion

This implementation provides a revolutionary approach to MCP integration, offering:

- Seamless integration with LLMs
- Stateless, scalable architecture
- Workflow-based tool definition
- Multi-model support

By leveraging the nanoservice-ts architecture, we've created an MCP implementation that's both powerful and flexible, enabling a wide range of AI-powered applications.
