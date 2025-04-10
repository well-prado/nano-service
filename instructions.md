AI Instructions for Generating Nanoservice-ts Nodes and Workflows

  1. Understanding the Core Components

  Node Structure

  A Node in Nanoservice-ts:
  - Is a modular, reusable component that performs a specific function
  - Extends the NanoService class from @nanoservice-ts/runner
  - Has input/output schemas for validation
  - Implements a handle method that processes requests and returns responses

  Workflow Structure

  A Workflow in Nanoservice-ts:
  - Is a JSON file defining a sequence of steps
  - Contains trigger configuration, steps, and node inputs
  - Can be defined in JSON, YAML, TOML, or XML (with JSON being most common)
  - Uses context (ctx) to pass data between nodes

  2. Node Creation Instructions

  When generating a Node, follow these precise steps:

  1. Create a class that extends NanoService:
  import { type INanoServiceResponse, NanoService, NanoServiceResponse } from "@nanoservice-ts/runner";
  import { type Context, GlobalError } from "@nanoservice-ts/shared";

  type InputType = {
    // Define input parameters here with proper types
    paramName: string;
    // Add other parameters as needed
  };

  export default class YourNodeName extends NanoService<InputType> {
    constructor() {
      super();

      // Define input JSON Schema for validation
      this.inputSchema = {
        type: "object",
        properties: {
          paramName: { type: "string" }
          // Define other parameters
        },
        required: ["paramName"] // List required fields
      };

      // Define output JSON Schema (if needed)
      this.outputSchema = {};

      // Set content type if needed (defaults to application/json)
      // this.contentType = "text/html";
    }

    async handle(ctx: Context, inputs: InputType): Promise<INanoServiceResponse> {
      const response = new NanoServiceResponse();

      try {
        // Implement your node's logic here
        // Process inputs from the 'inputs' parameter

        // Use ctx.request to access HTTP request data
        // Use ctx.vars to access workflow variables

        // Set success response
        response.setSuccess({ result: "your result data" });
      } catch (error: unknown) {
        // Error handling
        const nodeError = new GlobalError((error as Error).message);
        nodeError.setCode(500);
        nodeError.setStack((error as Error).stack);
        nodeError.setName(this.name);

        response.setError(nodeError);
      }

      return response;
    }
  }
  2. For UI Nodes, add these elements:
  import fs from "node:fs";
  import path from "node:path";
  import ejs from "ejs";

  const rootDir = path.resolve(__dirname, ".");

  // In constructor:
  this.contentType = "text/html";

  // Helper method for resolving paths
  root(relPath: string): string {
    return path.resolve(rootDir, relPath);
  }

  // In handle method:
  const content = fs.readFileSync(this.root("index.html"), "utf8");
  const render = ejs.compile(content, { client: false });
  const html = render({});
  response.setSuccess(html);
  3. JSON Schema Validation:
    - Always define input schema using JSON Schema format
    - Specify all properties with correct types
    - Mark required fields in the required array
    - Example for database input schema:
  this.inputSchema = {
    type: "object",
    properties: {
      host: { type: "string" },
      port: { type: "number" },
      database: { type: "string" },
      query: { type: "string" }
    },
    required: ["host", "database", "query"]
  };

  3. Workflow Creation Instructions

  When generating a Workflow, create a JSON file with this structure:

  {
    "name": "Your Workflow Name",
    "description": "Detailed description of what the workflow does",
    "version": "1.0.0",
    "trigger": {
      "http": {
        "method": "GET",  // Use "*" for any method
        "path": "/your-path/:paramName?",  // Use :name for required params, :name? for optional
        "accept": "application/json"
      }
    },
    "steps": [
      {
        "name": "step1",
        "node": "node-name",  // Use node name or npm package
        "type": "module"      // Use "module" for most cases
      },
      {
        "name": "step2",
        "node": "another-node",
        "type": "module"
      }
    ],
    "nodes": {
      "step1": {
        "inputs": {
          "param1": "static value",
          "param2": "${ctx.request.params.paramName}",
          "param3": "js/ctx.request.body.someValue"
        }
      },
      "step2": {
        "inputs": {
          "input1": "${ctx.response.data.someValue}",
          "input2": "${ctx.vars.step1.someProperty}"
        }
      }
    }
  }

  Critical Components:

  1. Trigger Configuration:
    - method: HTTP method (GET, POST, PUT, DELETE, or * for any)
    - path: URL path, can include parameters with :param or :param? (optional)
    - accept: Response content type
  2. Steps Definition:
    - name: Unique name for the step (referenced in nodes section)
    - node: Node name or package reference
    - type: Usually "module" (or "local" for local development)
  3. Node Inputs:
    - Define inputs for each node based on its requirements
    - Use different value formats:
        - Static values: "param": "value"
      - Path parameters: "param": "${ctx.request.params.id}"
      - Query parameters: "param": "${ctx.request.query.search}"
      - Request body: "param": "js/ctx.request.body" (JavaScript evaluation)
      - Previous node output: "param": "${ctx.response.data.property}"
  4. Conditional Steps with if-else:
  "filter-step": {
    "conditions": [
      {
        "type": "if",
        "condition": "ctx.request.method.toLowerCase() === 'get'",
        "steps": [
          {
            "name": "get-data",
            "node": "data-node",
            "type": "module"
          }
        ]
      },
      {
        "type": "else",
        "steps": [
          {
            "name": "method-not-allowed",
            "node": "error",
            "type": "module"
          }
        ]
      }
    ]
  }

  4. Context Usage (ctx)

  The ctx object is crucial for passing data between nodes. It has this structure:

  const ctx = {
    request: {
      body: {},     // Request payload
      method: "",   // HTTP method 
      headers: {},  // Request headers
      query: {},    // URL query parameters
      params: {}    // URL path parameters
    },
    response: {
      data: {}      // Response data from previous node
    },
    vars: {}        // Workflow variables
  };

  Context Access Patterns:

  1. Accessing URL parameters: ${ctx.request.params.id}
  2. Accessing query strings: ${ctx.request.query.search}
  3. Accessing request body: js/ctx.request.body
  4. Accessing previous node response: ${ctx.response.data.property}
  5. Accessing workflow variables: ${ctx.vars.stepName.property}

  5. MCP Framework Integration

  When integrating with Model Context Protocol (MCP) Framework, follow these guidelines:

  1. Installing Dependencies:
  ```bash
  npm install mcp-framework @modelcontextprotocol/sdk
  ```

  2. Importing MCP Framework in CommonJS Environment:
  Since MCP Framework is an ES Module but our nanoservice-ts project uses CommonJS, use:
  ```javascript
  // Directly require mcp-framework instead of ES Module imports
  const mcpFramework = require('mcp-framework');
  const { MCPServer, MCPTool } = mcpFramework;
  ```

  3. Creating a Weather Tool:
  ```typescript
  class WeatherTool extends MCPTool<WeatherInput> {
    name = "weather";
    description = "Get weather information for a city";

    schema = {
      city: {
        type: z.string(),
        description: "City name to get weather for",
      },
    };

    async execute({ city }: WeatherInput) {
      // Call real weather API using Open-Meteo
      // First get geocoding data to convert city name to coordinates
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
      const geocodingResponse = await fetch(geocodingUrl);
      const geocodingData = await geocodingResponse.json();
      
      if (!geocodingData.results || geocodingData.results.length === 0) {
        throw new Error(`Could not find coordinates for city: ${city}`);
      }
      
      const { latitude, longitude, name } = geocodingData.results[0];
      
      // Now get the actual weather data
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
      const weatherResponse = await fetch(weatherUrl);
      const weatherData = await weatherResponse.json();
      
      // Map weather code to condition
      const weatherConditions = {
        0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
        // More weather codes available in the Open-Meteo API documentation
      };
      
      return {
        city: name,
        temperature: Math.round(weatherData.current.temperature_2m),
        condition: weatherConditions[weatherData.current.weather_code] || 'Unknown',
        humidity: weatherData.current.relative_humidity_2m,
        wind: `${Math.round(weatherData.current.wind_speed_10m)} mph`,
        source: "Open-Meteo API"
      };
    }
  }
  ```

  4. Creating MCP Server Projects:
  When generating MCP servers as standalone projects:
  - Add `"type": "module"` to their package.json
  - Use ES Module syntax in their code
  - Configure with HTTP capabilities:
  ```javascript
  const server = new MCPServer({
    transport: {
      type: "http-stream",
      options: {
        port: 1337,
        cors: {
          allowOrigin: "*"
        }
      }
    }
  });
  ```

  5. Adding Tools to MCP Server:
  ```javascript
  // Add a tool to the server
  (server as any).tools = [weatherTool];
  
  // Start the server
  server.start().then(() => {
    console.log("MCP Server started on port 1337");
  });
  ```
  
  6. Additional Notes:
  - MCP Framework requires Node.js v18.19.0 or later
  - The server exposes an HTTP endpoint at the configured port
  - Tools can be invoked through the MCP protocol via this endpoint

  6. Practical Examples

  Example 1: API Call Node

  import { type INanoServiceResponse, NanoService, NanoServiceResponse } from "@nanoservice-ts/runner";
  import { type Context, GlobalError } from "@nanoservice-ts/shared";
  import axios from "axios";

  type WeatherInputs = {
    city: string;
    apiKey: string;
  };

  export default class WeatherApiNode extends NanoService<WeatherInputs> {
    constructor() {
      super();
      this.inputSchema = {
        type: "object",
        properties: {
          city: { type: "string" },
          apiKey: { type: "string" }
        },
        required: ["city", "apiKey"]
      };
    }

    async handle(ctx: Context, inputs: WeatherInputs): Promise<INanoServiceResponse> {
      const response = new NanoServiceResponse();

      try {
        const url =
  `https://api.openweathermap.org/data/2.5/weather?q=${inputs.city}&appid=${inputs.apiKey}&units=metric`;
        const weatherResponse = await axios.get(url);

        response.setSuccess({
          temperature: weatherResponse.data.main.temp,
          humidity: weatherResponse.data.main.humidity,
          description: weatherResponse.data.weather[0].description,
          city: weatherResponse.data.name
        });
      } catch (error: unknown) {
        const nodeError = new GlobalError((error as Error).message);
        nodeError.setCode(500);
        nodeError.setStack((error as Error).stack);
        nodeError.setName(this.name);

        response.setError(nodeError);
      }

      return response;
    }
  }

  Example 2: Weather Workflow

  {
    "name": "Weather Tool",
    "description": "Get weather information for a city",
    "version": "1.0.0",
    "trigger": {
      "http": {
        "method": "*",
        "path": "/",
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
                "name": "get-weather",
                "node": "weather-tool-node",
                "type": "module"
              }
            ],
            "condition": "ctx.request.method.toLowerCase() === \"get\" && ctx.request.params.city"
          },
          {
            "type": "if",
            "steps": [
              {
                "name": "post-weather",
                "node": "weather-tool-node",
                "type": "module"
              }
            ],
            "condition": "ctx.request.method.toLowerCase() === \"post\""
          }
        ]
      },
      "get-weather": {
        "inputs": {
          "city": "${ctx.request.params.city}"
        }
      },
      "post-weather": {
        "inputs": {
          "city": "${ctx.request.body.city || 'New York'}"
        }
      }
    }
  }

  Example 3: Database Node with UI

  // File: postgres-ui-node/index.ts
  import { type INanoServiceResponse, NanoService, NanoServiceResponse } from "@nanoservice-ts/runner";
  import { type Context, GlobalError } from "@nanoservice-ts/shared";
  import fs from "node:fs";
  import path from "node:path";
  import ejs from "ejs";

  const rootDir = path.resolve(__dirname, ".");

  type InputType = {
    title?: string;
  };

  export default class PostgresUI extends NanoService<InputType> {
    constructor() {
      super();
      this.inputSchema = {
        type: "object",
        properties: {
          title: { type: "string" }
        }
      };
      this.contentType = "text/html";
    }

    root(relPath: string): string {
      return path.resolve(rootDir, relPath);
    }

    async handle(ctx: Context, inputs: InputType): Promise<INanoServiceResponse> {
      const response = new NanoServiceResponse();

      try {
        const content = fs.readFileSync(this.root("index.html"), "utf8");
        const render = ejs.compile(content, { client: false });
        const html = render({
          title: inputs.title || "Database Explorer"
        });

        response.setSuccess(html);
      } catch (error: unknown) {
        const nodeError = new GlobalError((error as Error).message);
        nodeError.setCode(500);
        nodeError.setStack((error as Error).stack);
        nodeError.setName(this.name);

        response.setError(nodeError);
      }

      return response;
    }
  }

  7. Registration Steps

  After creating a Node, it must be registered in src/nodes/examples/index.ts:

  import YourNode from "./your-node-folder";

  const ExampleNodes = {
    // ...existing nodes
    "your-node-name": new YourNode()
  };

  export default ExampleNodes;

  For Workflows, save the JSON file in workflows/json/your-workflow.json.

  8. Best Practices

  1. Error Handling:
    - Always wrap node logic in try/catch
    - Set appropriate error codes and messages
    - Include stack traces in development
  2. Input Validation:
    - Use comprehensive JSON Schema validation
    - Define all properties with appropriate types
    - Mark required fields
  3. Context Usage:
    - Use consistent patterns for accessing context
    - Prefer template strings for simple context access: ${ctx.request.params.id}
    - Use JavaScript evaluation for complex access: js/ctx.request.body.complex.path
  4. UI Nodes:
    - Set content type to "text/html"
    - Use EJS for templating
    - Include proper file loading with error handling
  5. Workflow Design:
    - Use descriptive names for steps and nodes
    - Organize complex workflows with if-else conditions
    - Keep node configurations focused on a single responsibility

  9. Testing Generated Components

  1. For Nodes:
    - Register the node in src/nodes/examples/index.ts
    - Create a simple workflow that uses the node
    - Start the service with npm run dev
    - Test using appropriate HTTP requests
  2. For Workflows:
    - Save the workflow JSON in workflows/json/
    - Start the service with npm run dev
    - Test the workflow using the configured HTTP endpoint
  3. For MCP Servers:
    - Use the generated project from the MCP server generator
    - Navigate to the project directory
    - Install dependencies with npm install
    - Build with npm run build
    - Start with npm start
    - Test using tools like npx mcp-debug or custom HTTP clients

  Remember that the endpoint will match the filename (e.g., weather.json will be accessible at /weather).

  By following these instructions, you'll create Nodes and Workflows that maintain consistency with the existing
  codebase and function correctly within the Nanoservice-ts framework.