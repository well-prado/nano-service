# Nano Services MCP Integration Example

This repository demonstrates how to turn your **Nano Services** project into a functional **MCP (Model Context Protocol)** server that works with clients like **Claude** or **ChatGPT**.

Follow the step-by-step instructions below to recreate the same project shown in the video. By the end of this guide, you'll have your Nano Services nodes and workflows available as MCP tools ready for AI assistants.

---

## 🚀 Getting Started

### 1. Create Your Project Using Nanoctl CLI

Before anything else, you’ll need to create a new Nano Services project. Make sure you have `Node.js` installed on your system.

In your terminal, run:

```bash
npx nanoctl@latest create project
```

Follow the prompts as shown below:

```
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+ +-+-+-+
 |N|A|N|O|S|E|R|V|I|C|E|-|T|S| |C|L|I|
 +-+-+-+-+-+-+-+-+-+-+-+-+-+-+ +-+-+-+

┌   Create a New Project 
│
◇  Please provide a name for the project
│  nano-service
│
◇  Select the trigger to install
│  HTTP
│
◇  Select the runtimes to install
│  NodeJS
│
◇  Install the examples?
│  YES
```

After this, enter the project directory:

```bash
cd nano-service
```

---

## 📦 Install MCP Dependencies

You’ll need to install the Model Context Protocol SDK and Axios:

```bash
npm install @modelcontextprotocol/sdk axios
```

---

## 📁 Full Implementation Guide with Files

Below is the **complete, self‑contained implementation guide**—including file names *and* full source code snippets—so you can follow along without leaving this README.

---

# MCP Implementation Guide for Nanoservice

This comprehensive guide provides detailed, step‑by‑step instructions for implementing the **Model Context Protocol (MCP)** in a Nanoservice project. Follow these instructions to create a robust MCP server that allows **Claude** and other AI assistants to access your Nanoservice tools.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Core Components](#core-components)
3. [Automatic Initialization](#automatic-initialization)
4. [Configuration and Integration](#configuration-and-integration)
5. [Testing and Troubleshooting](#testing-and-troubleshooting)

## Project Structure

First, ensure your project has the following structure to accommodate MCP:

```text
src/
├── adapters/
│   ├── MCPRegistry.ts        # Central registry for MCP tools
│   ├── NodeToMCPAdapter.ts   # Converts nodes to MCP tools
│   └── WorkflowChainer.ts    # Discovers and chains workflows
├── types/
│   └── mcp.ts                # MCP type definitions
├── nodes/
│   └── examples/
│       ├── mcp-server/
│       │   ├── index.ts      # MCP server implementation
│       │   └── README.md     # MCP server documentation
│       └── mcp-client/       # (Optional) Client implementation
├── init-registry.ts          # Registry initialization for auto-startup
├── mcp-entry.ts              # Entry point for MCP server
└── [your existing code]      # Your nanoservice implementation
workflows/
└── json/
    ├── auto-mcp-server.json  # MCP server configuration
    └── [your workflows]      # Your workflow definitions
```

---

## Core Components

### MCPRegistry

**File: `src/adapters/MCPRegistry.ts`**

```typescript
import { NanoService } from "@nanoservice-ts/runner";
import { NodeToMCPAdapter, MCPTool } from "./NodeToMCPAdapter";
import { WorkflowChainer } from "./WorkflowChainer";

declare global {
  var nodeRegistry: Record<string, any>;
}

/**
 * MCPRegistry - Manages global node registration and MCP tool generation
 */
export class MCPRegistry {
  // Initialize the global registry
  static {
    if (!global.nodeRegistry) {
      global.nodeRegistry = {};
    }
  }

  /**
   * Register a node in the global registry
   */
  static registerNode(name: string, node: NanoService<any>): void {
    global.nodeRegistry[name] = node;
  }

  /**
   * Register multiple nodes at once
   */
  static registerNodes(nodes: Record<string, NanoService<any>>): void {
    Object.entries(nodes).forEach(([name, node]) => {
      this.registerNode(name, node);
    });
  }

  /**
   * Get all registered nodes
   */
  static getRegisteredNodes(): Record<string, NanoService<any>> {
    return global.nodeRegistry;
  }

  /**
   * Convert registered nodes to MCP tools
   */
  static getNodeMCPTools(options: { excludeNodes?: string[] } = {}): MCPTool[] {
    return NodeToMCPAdapter.convertNodesToMCPTools(
      this.getRegisteredNodes(),
      options
    );
  }

  /**
   * Get workflow MCP tools - now marked as legacy method, use only for backward compatibility
   */
  static getWorkflowMCPTools(options: { 
    workflowsDir?: string;
    excludeWorkflows?: string[];
  } = {}): MCPTool[] {
    return NodeToMCPAdapter.discoverWorkflowsAsMCPTools(
      options.workflowsDir,
      { excludeWorkflows: options.excludeWorkflows }
    );
  }
  
  /**
   * Get enhanced workflow tools that can be chained with nodes
   */
  static async getChainableWorkflowTools(options: {
    workflowsDir?: string;
    excludeWorkflows?: string[];
  } = {}): Promise<MCPTool[]> {
    return WorkflowChainer.discoverNodeSequencesFromWorkflows(
      options.workflowsDir,
      { excludeWorkflows: options.excludeWorkflows }
    );
  }

  /**
   * Get all MCP tools (nodes + workflows)
   * The order is important - nodes take priority over workflows
   */
  static async getAllMCPTools(options: {
    excludeNodes?: string[];
    workflowsDir?: string;
    excludeWorkflows?: string[];
    prioritizeNodes?: boolean;
    includeChainTool?: boolean;
    discover_nodes?: boolean;
    discover_workflows?: boolean;
  } = {}): Promise<MCPTool[]> {
    // Default to prioritizing nodes
    const prioritizeNodes = options.prioritizeNodes !== false;
    const allTools: MCPTool[] = [];
    const toolNames = new Set<string>();
    
    // Get node tools first (highest priority) if discovery is enabled
    if (options.discover_nodes !== false) {
      const nodeTools = this.getNodeMCPTools({ 
        excludeNodes: options.excludeNodes 
      });
      
      // Add node tools first (they get priority)
      for (const tool of nodeTools) {
        toolNames.add(tool.name.toLowerCase());
        allTools.push(tool);
      }
    }
    
    // Get workflow tools if workflow discovery is enabled
    if (options.discover_workflows === true) {
      let workflowTools: MCPTool[] = [];
      
      try {
        if (prioritizeNodes) {
          // Use the new chainable workflow tools
          workflowTools = await this.getChainableWorkflowTools({
            workflowsDir: options.workflowsDir,
            excludeWorkflows: options.excludeWorkflows
          });
        } else {
          // Fall back to legacy workflow discovery for backward compatibility
          workflowTools = this.getWorkflowMCPTools({
            workflowsDir: options.workflowsDir,
            excludeWorkflows: options.excludeWorkflows
          });
        }
        
        // Add workflow tools only if no node with the same name exists
        for (const tool of workflowTools) {
          if (!toolNames.has(tool.name.toLowerCase())) {
            toolNames.add(tool.name.toLowerCase());
            allTools.push(tool);
          }
        }
      } catch (error) {
        console.error("Error during workflow discovery:", error);
        // Continue without workflow tools on error
      }
    }
    
    // Add the chain tool if requested
    if (options.includeChainTool) {
      try {
        const chainTool = WorkflowChainer.createChainExecutorTool();
        if (!toolNames.has(chainTool.name.toLowerCase())) {
          allTools.push(chainTool);
        }
      } catch (error) {
        console.error("Error creating chain tool:", error);
        // Continue without chain tool on error
      }
    }
    
    return allTools;
  }

  /**
   * Register all nodes from the src/nodes directory
   */
  static async discoverAndRegisterAllNodes(baseDir?: string): Promise<void> {
    const nodes = await NodeToMCPAdapter.discoverNodesFromDirectory(baseDir);
    this.registerNodes(nodes);
  }
  
  /**
   * Create a sequence of nodes as a chained tool
   */
  static createNodeSequenceTool(
    name: string,
    description: string,
    nodeSequence: string[],
    inputSchema: Record<string, any>
  ): MCPTool {
    return WorkflowChainer.createNodeSequenceTool(
      name,
      description,
      nodeSequence,
      inputSchema
    );
  }
  
  /**
   * Fetch available tools from multiple sources with improved error handling
   * Uses Promise.allSettled to handle individual failures gracefully
   */
  static async fetchAvailableTools(options: {
    discover_nodes?: boolean;
    discover_workflows?: boolean;
    workflowsDir?: string;
    excludeNodes?: string[];
    excludeWorkflows?: string[];
    includeChainTool?: boolean;
    prioritizeNodes?: boolean;
  } = {}): Promise<MCPTool[]> {
    const toolSources = [];
    
    // Add MCP tools from nodes if enabled
    if (options.discover_nodes !== false) {
      toolSources.push(
        () => Promise.resolve(this.getNodeMCPTools({ 
          excludeNodes: options.excludeNodes 
        }))
      );
    }
    
    // Add MCP tools from workflows if enabled
    if (options.discover_workflows === true) {
      // Determine which workflow discovery method to use
      if (options.prioritizeNodes !== false) {
        toolSources.push(
          () => this.getChainableWorkflowTools({
            workflowsDir: options.workflowsDir,
            excludeWorkflows: options.excludeWorkflows
          })
        );
      } else {
        toolSources.push(
          () => Promise.resolve(this.getWorkflowMCPTools({
            workflowsDir: options.workflowsDir,
            excludeWorkflows: options.excludeWorkflows
          }))
        );
      }
    }
    
    // Add chain tool if requested
    if (options.includeChainTool) {
      toolSources.push(
        () => Promise.resolve([WorkflowChainer.createChainExecutorTool()])
      );
    }
    
    // Execute all tool source functions in parallel
    const results = await Promise.allSettled(
      toolSources.map(fetchFn => fetchFn())
    );
    
    // Process results, handling errors gracefully
    const tools: MCPTool[] = [];
    const toolNames = new Set<string>();
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        // Add successful tools, avoiding duplicates
        for (const tool of result.value) {
          const toolLowerName = tool.name.toLowerCase();
          if (!toolNames.has(toolLowerName)) {
            toolNames.add(toolLowerName);
            tools.push(tool);
          }
        }
      } else {
        // Log errors but continue with other tools
        console.error(`Error fetching tools from source ${index}:`, result.reason);
      }
    });
    
    return tools;
  }
}
```

### NodeToMCPAdapter

**File: `src/adapters/NodeToMCPAdapter.ts`**

```typescript
import { NanoService } from "@nanoservice-ts/runner";
import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import YAML from "js-yaml";

/**
 * Interface for MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  schema: Record<string, any>;
  implementation: string;
  httpMethod?: string;
}

/**
 * Adapter that converts nanoservice nodes to MCP tools
 */
export class NodeToMCPAdapter {
  /**
   * Convert a node registry to MCP tools
   */
  static convertNodesToMCPTools(
    nodeRegistry: Record<string, NanoService<any>>,
    options: {
      excludeNodes?: string[];
    } = {}
  ): MCPTool[] {
    const { excludeNodes = [] } = options;
    
    return Object.entries(nodeRegistry)
      .filter(([name]) => !excludeNodes.includes(name))
      .map(([name, node]) => {
        return {
          name,
          description: this.generateNodeDescription(name, node),
          schema: this.convertInputSchemaToMCPSchema(node.inputSchema),
          implementation: this.generateNodeImplementation(name)
        };
      });
  }

  /**
   * Generate a description for a node
   */
  private static generateNodeDescription(name: string, node: NanoService<any>): string {
    // Try to extract description from JSDoc or node properties
    // For now, use a simple description
    return `Nanoservice node: ${name}`;
  }

  /**
   * Convert a node's JSON Schema to MCP schema format
   */
  private static convertInputSchemaToMCPSchema(schema: any): Record<string, any> {
    if (!schema || !schema.properties) {
      return {};
    }

    const result: Record<string, any> = {};
    
    // Convert each property in the schema
    Object.entries(schema.properties).forEach(([propName, propSchema]: [string, any]) => {
      result[propName] = {
        type: {
          type: propSchema.type || "string"
        },
        description: propSchema.description || `Parameter: ${propName}`
      };
    });
    
    return result;
  }

  /**
   * Generate implementation code for invoking a node
   */
  private static generateNodeImplementation(nodeName: string): string {
    return `
      const nodeRegistry = global.nodeRegistry || {};
      const node = nodeRegistry["${nodeName}"];
      
      if (!node) {
        throw new Error("Node not found: ${nodeName}");
      }
      
      // Create a context object similar to what the workflow runner would create
      const context = { 
        id: inputs.context?.client?.id || inputs.context?.operation || 'mcp-execution',
        request: { 
          body: inputs,
          method: inputs.context?.method || "POST",
          headers: inputs.context?.headers || {},
          query: inputs.context?.query || {},
          params: inputs.context?.params || {}
        },
        response: { data: {} },
        vars: {},
        error: {},
        logger: console,
        config: {},
        eventLogger: console
      };
      
      try {
        // Remove context from inputs to avoid circular references
        const nodeInputs = { ...inputs };
        if (nodeInputs.context) {
          delete nodeInputs.context;
        }
        
        // Call the node's handle method with the context and inputs
        const response = await node.handle(context, nodeInputs);
        
        // Return the response data
        return response.data || response.content || {};
      } catch (error) {
        throw new Error(\`Error executing node ${nodeName}: \${error.message}\`);
      }
    `;
  }

  /**
   * Discover all nodes from the src/nodes directory
   */
  static async discoverNodesFromDirectory(
    baseDir: string = path.resolve(process.cwd(), "src/nodes")
  ): Promise<Record<string, NanoService<any>>> {
    const nodeRegistry: Record<string, NanoService<any>> = {};
    
    // Helper function to recursively scan directories
    const scanDir = async (dir: string, registry: Record<string, NanoService<any>>) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await scanDir(fullPath, registry);
        } else if (entry.name === "index.ts" || entry.name === "index.js") {
          try {
            // Import the node module
            const module = await import(fullPath);
            
            // If the module exports a default that extends NanoService, add it to registry
            if (module.default && module.default.prototype instanceof NanoService) {
              const nodeName = path.basename(dir);
              registry[nodeName] = new module.default();
            }
            // If the module exports multiple nodes
            else if (typeof module.default === "object") {
              Object.entries(module.default).forEach(([name, NodeClass]: [string, any]) => {
                if (NodeClass.prototype instanceof NanoService) {
                  registry[name] = new NodeClass();
                }
              });
            }
          } catch (error) {
            console.error(`Error importing node from ${fullPath}:`, error);
          }
        }
      }
    };
    
    await scanDir(baseDir, nodeRegistry);
    return nodeRegistry;
  }

  /**
   * Discover workflows from multiple formats (JSON, TOML, YAML)
   */
  static discoverWorkflowsAsMCPTools(
    workflowsDir: string = path.resolve(process.cwd(), "workflows"),
    options: {
      excludeWorkflows?: string[];
    } = {}
  ): MCPTool[] {
    const { excludeWorkflows = [] } = options;
    const tools: MCPTool[] = [];
    
    // Process different format directories
    const formats = [
      { dir: "json", parse: JSON.parse, ext: ".json" },
      { dir: "toml", parse: TOML.parse, ext: ".toml" },
      { dir: "yaml", parse: YAML.load, ext: ".yaml" }
    ];
    
    for (const format of formats) {
      const formatDir = path.join(workflowsDir, format.dir);
      
      if (!fs.existsSync(formatDir)) {
        console.log(`Workflow directory not found: ${formatDir}`);
        continue;
      }
      
      // Read all files with the specific extension
      const workflowFiles = fs.readdirSync(formatDir)
        .filter(file => file.endsWith(format.ext))
        .filter(file => !excludeWorkflows.includes(file.replace(format.ext, "")));
      
      console.log(`Found ${workflowFiles.length} workflow files in ${formatDir}`);
      
      for (const file of workflowFiles) {
        try {
          const filePath = path.join(formatDir, file);
          const content = fs.readFileSync(filePath, "utf8");
          const workflow = format.parse(content);
          
          // Extract workflow information
          const name = workflow.name || file.replace(format.ext, "");
          const description = workflow.description || `Workflow: ${name}`;
          
          // Skip workflows with no HTTP trigger
          if (!workflow.trigger?.http) {
            console.log(`Skipping workflow ${file}: No HTTP trigger`);
            continue;
          }
          
          // Extract HTTP method information
          const httpMethod = workflow.trigger.http.method || 'POST';
          // Default to GET for wildcard (*) method
          const normalizedMethod = httpMethod === '*' ? 'GET' : httpMethod.toUpperCase();
          
          // Generate schema based on workflow trigger and steps
          const schema = this.extractSchemaFromWorkflow(workflow);
          
          // Generate implementation that calls the workflow with correct HTTP method
          const implementation = this.generateWorkflowImplementation(
            file.replace(format.ext, ""),
            normalizedMethod
          );
          
          tools.push({
            name: this.sanitizeToolName(file.replace(format.ext, "")),
            description,
            schema,
            httpMethod: normalizedMethod,
            implementation
          });
          
          console.log(`Added workflow as tool: ${file.replace(format.ext, "")} (HTTP Method: ${normalizedMethod})`);
        } catch (error) {
          console.error(`Error processing workflow ${file}:`, error);
        }
      }
    }
    
    return tools;
  }

  /**
   * Extract schema from a workflow
   */
  private static extractSchemaFromWorkflow(workflow: any): Record<string, any> {
    const schema: Record<string, any> = {};
    
    // If workflow has HTTP trigger with path parameters, extract them
    if (workflow.trigger?.http?.path) {
      const pathParams = this.extractPathParams(workflow.trigger.http.path);
      
      pathParams.forEach(param => {
        schema[param.name] = {
          type: { type: "string" },
          description: `Path parameter: ${param.name}`
        };
      });
    }
    
    // For now, add a generic 'data' parameter for request body
    schema.data = {
      type: { type: "object" },
      description: "Data to send to the workflow"
    };
    
    return schema;
  }

  /**
   * Extract path parameters from an HTTP path
   */
  private static extractPathParams(path: string): { name: string, required: boolean }[] {
    const params: { name: string, required: boolean }[] = [];
    const regex = /:([a-zA-Z0-9_]+)(\?)?/g;
    let match;
    
    while ((match = regex.exec(path)) !== null) {
      params.push({
        name: match[1],
        required: !match[2] // If there's a '?' after the param, it's optional
      });
    }
    
    return params;
  }

  /**
   * Generate implementation code for invoking a workflow
   */
  private static generateWorkflowImplementation(workflowName: string, httpMethod: string = 'POST'): string {
    const methodLower = httpMethod.toLowerCase();
    
    return `
      // This function will invoke the workflow via HTTP with method: ${httpMethod}
      const axios = require('axios');
      
      try {
        // Construct the URL for the workflow
        const baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';
        const url = \`\${baseUrl}/${workflowName}\`;
        
        ${methodLower === 'get' ? `
        // For GET requests, parameters become query parameters
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(inputs.data || inputs)) {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        }
        const queryString = queryParams.toString();
        const response = await axios.get(url + (queryString ? '?' + queryString : ''));
        ` : `
        // Send request to the workflow using ${methodLower} method
        const response = await axios.${methodLower}(url, inputs.data || inputs);
        `}
        
        // Return the response data
        return response.data;
      } catch (error) {
        throw new Error(\`Error executing workflow ${workflowName}: \${error.message}\`);
      }
    `;
  }

  /**
   * Sanitize a name to be used as a tool name
   */
  private static sanitizeToolName(name: string): string {
    // Remove special characters but preserve hyphens and underscores
    return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  }
}
```

### WorkflowChainer

**File: `src/adapters/WorkflowChainer.ts`**

```typescript
import { NanoServiceResponse } from "@nanoservice-ts/runner";
import path from "node:path";
import { MCPTool } from "./NodeToMCPAdapter";
import fs from "fs";

/**
 * Custom context interface compatible with the nanoservice context structure
 */
interface WorkflowContext {
  request: {
    body: any;
    method: string;
    headers: Record<string, any>;
    query: Record<string, any>;
    params: Record<string, any>;
  };
  response: {
    data: any;
    error: any;
  };
  vars: Record<string, any>;
}

/**
 * WorkflowChainer - Provides utilities for chaining nodes and workflows
 * This adapter helps with executing workflows in sequence when the MCP client
 * needs to chain multiple operations.
 */
export class WorkflowChainer {
  /**
   * Execute a sequence of nodes based on the inputs
   * @param nodeSequence Array of node names to execute in sequence
   * @param initialInputs The initial inputs to the first node
   */
  static async executeNodeSequence(
    nodeSequence: string[],
    initialInputs: Record<string, any>
  ): Promise<any> {
    if (!nodeSequence.length) {
      return { error: "No nodes specified for sequence execution" };
    }
    
    let currentInputs = { ...initialInputs };
    let finalResult: any = null;
    
    // Execute each node in sequence, passing outputs as inputs to the next
    for (const nodeName of nodeSequence) {
      try {
        const node = global.nodeRegistry[nodeName];
        
        if (!node) {
          throw new Error(`Node not found: ${nodeName}`);
        }
        
        // Create a basic context using our compatible interface
        const context: WorkflowContext = {
          request: {
            body: currentInputs,
            method: "POST",
            headers: {},
            query: {},
            params: {}
          },
          response: { 
            data: {},
            error: null
          },
          vars: {}
        };
        
        // Execute the node
        const result = await node.handle(context as any, currentInputs);
        
        // Extract result data
        if (result instanceof NanoServiceResponse) {
          finalResult = result.data;
          
          // Check for error
          if (result.error) {
            throw new Error(`Error in node ${nodeName}: ${result.error.message}`);
          }
        } else {
          finalResult = result;
        }
        
        // Use result as input for next node
        currentInputs = typeof finalResult === 'object' ? { ...finalResult } : { result: finalResult };
      } catch (error) {
        return { error: `Error in node sequence at ${nodeName}: ${(error as Error).message}` };
      }
    }
    
    return finalResult;
  }

  /**
   * Create an MCP tool that represents a node sequence
   * @param name Name for the chained tool
   * @param description Description of what the tool does
   * @param nodeSequence Array of node names to execute in sequence
   * @param inputSchema Schema for the inputs to the first node
   */
  static createNodeSequenceTool(
    name: string,
    description: string,
    nodeSequence: string[],
    inputSchema: Record<string, any>
  ): MCPTool {
    return {
      name,
      description,
      schema: inputSchema,
      implementation: `
        try {
          const WorkflowChainer = require('${path.resolve(__dirname, 'WorkflowChainer.js')}').WorkflowChainer;
          const result = await WorkflowChainer.executeNodeSequence(
            ${JSON.stringify(nodeSequence)},
            inputs
          );
          return result;
        } catch (error) {
          console.error("Error executing node sequence:", error);
          return { error: error.message };
        }
      `
    };
  }

  /**
   * Discover workflows and convert them to node sequence tools
   * This allows workflows to be used as building blocks for MCP tools
   */
  static async discoverNodeSequencesFromWorkflows(
    workflowsDir: string = path.resolve(process.cwd(), "workflows"),
    options: { excludeWorkflows?: string[] } = {}
  ): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];
    const { excludeWorkflows = [] } = options;
    
    try {
      // Get workflows directly from the filesystem instead of API
      const jsonDir = path.join(workflowsDir, 'json');
      
      // Check if the directory exists
      if (!fs.existsSync(jsonDir)) {
        console.warn(`Workflow directory not found: ${jsonDir}`);
        return tools;
      }
      
      // Read all JSON files in the directory
      const files = fs.readdirSync(jsonDir).filter(file => file.endsWith('.json'));
      console.log(`Found ${files.length} potential workflow files in ${jsonDir}`);
      
      for (const file of files) {
        try {
          // Skip excluded workflows
          if (excludeWorkflows.includes(file.replace(/\.json$/, ''))) {
            console.log(`Skipping excluded workflow: ${file}`);
            continue;
          }
          
          const filePath = path.join(jsonDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const workflow = JSON.parse(content);
          
          // Skip workflows with no HTTP trigger
          if (!workflow.trigger?.http) {
            console.log(`Skipping workflow ${file}: No HTTP trigger`);
            continue;
          }
          
          // Extract workflow information
          const workflowName = file.replace(/\.json$/, '');
          const workflowPath = `/${workflowName}`;
          const httpMethod = workflow.trigger.http.method || 'POST';
          
          // Create a tool that uses the workflow
          const tool: MCPTool = {
            name: this.sanitizeToolName(workflowName),
            description: workflow.description || `Workflow: ${workflowName}`,
            httpMethod: httpMethod === '*' ? 'GET' : httpMethod.toUpperCase(), // Default to GET for wildcard
            schema: {
              data: {
                type: { type: "object" },
                description: "Data to send to the workflow"
              }
            },
            implementation: `
              try {
                const axios = require('axios');
                const baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';
                const url = \`\${baseUrl}${workflowPath}\`;
                const method = '${httpMethod === '*' ? 'GET' : httpMethod.toLowerCase()}';
                
                let response;
                if (method === 'get') {
                  // For GET, convert inputs to query params
                  const queryParams = new URLSearchParams(inputs.data || inputs).toString();
                  response = await axios.get(url + (queryParams ? '?' + queryParams : ''));
                } else {
                  // For other methods, use the appropriate axios method
                  response = await axios[method](url, inputs.data || inputs);
                }
                
                return response.data;
              } catch (error) {
                throw new Error(\`Error executing workflow ${workflowName}: \${error.message}\`);
              }
            `
          };
          
          tools.push(tool);
          console.log(`Added workflow as tool: ${workflowName} (HTTP method: ${tool.httpMethod})`);
        } catch (error) {
          console.error(`Error processing workflow file ${file}:`, error);
        }
      }
    } catch (error) {
      console.error("Error discovering workflows from filesystem:", error);
    }
    
    return tools;
  }

  /**
   * Create a tool that can chain multiple other tools together
   */
  static createChainExecutorTool(): MCPTool {
    return {
      name: "chain_tools",
      description: "Chain multiple tools together, passing the output of one tool as input to the next. This is useful for complex operations that require multiple steps.",
      schema: {
        tool_sequence: {
          type: { type: "array" },
          description: "Array of tool names to execute in sequence"
        },
        initial_input: {
          type: { type: "object" },
          description: "The input data for the first tool in the sequence"
        }
      },
      implementation: `
        try {
          if (!inputs.tool_sequence || !Array.isArray(inputs.tool_sequence) || inputs.tool_sequence.length === 0) {
            throw new Error("No tools specified in the sequence");
          }
          
          const axios = require('axios');
          const baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';
          let currentInput = inputs.initial_input || {};
          let finalResult = null;
          
          for (const toolName of inputs.tool_sequence) {
            const executeUrl = \`\${baseUrl}/auto-mcp-server/execute\`;
            
            const response = await axios.post(executeUrl, {
              name: toolName,
              parameters: currentInput
            });
            
            finalResult = response.data?.result || response.data;
            currentInput = finalResult;
          }
          
          return {
            result: finalResult,
            chained_tools: inputs.tool_sequence
          };
        } catch (error) {
          return { error: error.message };
        }
      `
    };
  }
  
  /**
   * Sanitize a name to be used as a tool name
   */
  private static sanitizeToolName(name: string): string {
    // Remove special characters but preserve hyphens and underscores
    return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  }
}
```

### MCP Types

**File: `src/types/mcp.ts`**

```typescript
/**
 * Types for the Model Context Protocol (MCP) implementation
 */

/**
 * MCPRequestContext represents the context information for an MCP request
 * This is used in the StatelessMCPNode as part of the InputType
 */
export interface MCPRequestContext {
    /** The MCP operation being requested */
    operation?: string;
    
    /** HTTP method (GET, POST, etc.) */
    method?: string;
    
    /** Request body data */
    body?: Record<string, any>;
    
    /** Request parameters */
    params?: Record<string, any>;
    
    /** Query parameters */
    query?: Record<string, any>;
    
    /** HTTP headers */
    headers?: Record<string, any>;
    
    /** Optional client information */
    client?: {
      id?: string;
      name?: string;
      version?: string;
    };
  }
```

### MCP Server Implementation

**File: `src/nodes/examples/mcp-server/index.ts`**

```typescript
import {
	type INanoServiceResponse,
	NanoService,
	NanoServiceResponse,
} from "@nanoservice-ts/runner";
import { type Context, GlobalError } from "@nanoservice-ts/shared";
import { MCPRegistry } from "../../../adapters/MCPRegistry";
import { MCPTool } from "../../../adapters/NodeToMCPAdapter";
import { MCPRequestContext } from "../../../types/mcp";

// Input type for the MCP server node
export interface InputType {
	context: MCPRequestContext;
	tools?: MCPTool[];
	excluded_nodes?: string[];
	excluded_workflows?: string[];
	workflows_directory?: string;
	debug_mode?: boolean;
	discover_nodes?: boolean;
	discover_workflows?: boolean;
}

/**
 * StatelessMCPNode - A revolutionary implementation of the Model Context Protocol
 * that operates in a completely stateless manner, compatible with nanoservice architecture.
 * 
 * This node implements the core MCP protocol without requiring a persistent server.
 */
export default class StatelessMCPNode extends NanoService<InputType> {
	constructor() {
		super();
		this.inputSchema = {
			type: "object",
			properties: {
				tools: {
					type: "array",
					items: {
						type: "object",
						properties: {
							name: { type: "string" },
							description: { type: "string" },
							schema: { type: "object" },
							implementation: { type: "string" }
						},
						required: ["name", "description", "schema", "implementation"]
					}
				},
				debug_mode: { type: "boolean" },
				discover_workflows: { type: "boolean" },
				workflows_directory: { type: "string" },
				excluded_workflows: { 
					type: "array",
					items: { type: "string" }
				},
				excluded_nodes: { 
					type: "array",
					items: { type: "string" }
				}
			}
		};
	}

	/**
	 * Handle MCP requests in a stateless manner
	 * This method processes each request independently, with no server state
	 */
	async handle(ctx: Context, inputs: InputType): Promise<INanoServiceResponse> {
		const response = new NanoServiceResponse();

		try {
			// Extract the path from request to determine MCP operation
			const path = ctx.request.params.mcp_operation || '';
			const debug = inputs.debug_mode || false;

			// Log request in debug mode
			if (debug) {
				console.log(`MCP Request: ${path}`, {
					method: ctx.request.method,
					body: ctx.request.body,
					params: ctx.request.params
				});
			}

			// Get all available tools
			const allTools = await this.getAllTools(inputs);

			// Handle different MCP operations
			switch (path) {
				case 'tools':
					// List available tools
					return this.handleToolsRequest(allTools);
				
				case 'execute':
					// Execute a specific tool
					return this.handleExecuteRequest(ctx, allTools);
				
				default:
					// Handle root MCP endpoint (protocol info)
					return this.handleInfoRequest(allTools);
			}
		} catch (error: unknown) {
			// Error handling
			const nodeError = new GlobalError((error as Error).message);
			nodeError.setCode(500);
			nodeError.setStack((error as Error).stack);
			nodeError.setName(this.name);

			response.setError(nodeError);
			return response;
		}
	}

	/**
	 * Get all tools from various sources
	 */
	private async getAllTools(inputs: InputType): Promise<MCPTool[]> {
		// Start with manually defined tools
		let allTools: MCPTool[] = inputs.tools || [];
		
		const debug = inputs.debug_mode || false;
		if (debug) {
			console.log(`[MCP] Starting tool discovery...`);
		}
		
		// Use the improved fetchAvailableTools method for better error handling
		if (MCPRegistry) {
			try {
				const discoveredTools = await MCPRegistry.fetchAvailableTools({
					excludeNodes: inputs.excluded_nodes,
					workflowsDir: inputs.workflows_directory,
					excludeWorkflows: inputs.excluded_workflows,
					prioritizeNodes: true,  // Prioritize nodes over workflows
					includeChainTool: !(inputs.excluded_workflows || []).includes('chain-tools'),  // Only include chain_tools if not excluded
					discover_nodes: inputs.discover_nodes !== false, // Enable node discovery by default
					discover_workflows: inputs.discover_workflows === true // Explicitly enable workflow discovery
				});
				
				if (debug) {
					console.log(`[MCP] Found ${discoveredTools.length} tools from all sources`);
					if (inputs.discover_nodes !== false) {
						console.log(`[MCP] - Node discovery is enabled`);
					}
					if (inputs.discover_workflows === true) {
						console.log(`[MCP] - Workflow discovery is enabled`);
					}
					console.log(`[MCP] - Node tools have priority over workflow tools`);
				}
				
				allTools = [...allTools, ...discoveredTools];
			} catch (error) {
				console.error(`[MCP] Error during tool discovery:`, error);
				// Continue with any tools we already have
				if (debug) {
					console.log(`[MCP] Continuing with ${allTools.length} manually defined tools despite discovery error`);
				}
			}
		}
		
		// Add or replace the weather tool with our enhanced version
		// Only add if not in the excluded_workflows list
		if (!(inputs.excluded_workflows || []).includes('weather')) {
			const weatherToolIndex = allTools.findIndex(tool => 
				tool.name.toLowerCase().includes('weather')
			);
			
			// Create the enhanced weather tool
			const enhancedWeatherTool = this.convertWeatherToolToMCP();
			
			if (weatherToolIndex !== -1) {
				// Replace existing weather tool
				allTools[weatherToolIndex] = enhancedWeatherTool;
				if (debug) {
					console.log(`[MCP] Replaced existing weather tool with enhanced version`);
				}
			} else {
				// Add new weather tool
				allTools.push(enhancedWeatherTool);
				if (debug) {
					console.log(`[MCP] Added enhanced weather tool`);
				}
			}
		} else if (debug) {
			console.log(`[MCP] Skipping weather tool (in excluded_workflows list)`);
		}
		
		// Add the specialized tool for listing all available tools
		// Only add if not in the excluded_workflows list
		if (!(inputs.excluded_workflows || []).includes('list_available_tools')) {
			const listToolsTool = this.createListToolsTool();
			
			// Replace existing list_tools tool or add new one
			const listToolsIndex = allTools.findIndex(tool => 
				tool.name === 'list_available_tools'
			);
			
			if (listToolsIndex !== -1) {
				allTools[listToolsIndex] = listToolsTool;
				if (debug) {
					console.log(`[MCP] Replaced existing list_available_tools tool`);
				}
			} else {
				allTools.push(listToolsTool);
				if (debug) {
					console.log(`[MCP] Added specialized list_available_tools tool`);
				}
			}
		} else if (debug) {
			console.log(`[MCP] Skipping list_available_tools tool (in excluded_workflows list)`);
		}
		
		// Add node-to-workflow debugger tool
		// const debuggerTool = this.createNodeDebuggerTool();
		// allTools.push(debuggerTool);
		
		if (debug) {
			console.log(`[MCP] Total tools available: ${allTools.length}`);
			allTools.forEach(tool => {
				console.log(`[MCP] - ${tool.name}: ${tool.description}`);
			});
		}
		
		return allTools;
	}

	/**
	 * Handle requests to the /tools endpoint
	 * Lists all available tools and their schemas
	 */
	private handleToolsRequest(tools: MCPTool[]): INanoServiceResponse {
		const response = new NanoServiceResponse();

		const toolsData = tools.map(tool => ({
			name: tool.name,
			description: tool.description,
			schema: tool.schema,
			httpMethod: tool.httpMethod || "POST"
		}));

		response.setSuccess({
			protocol: "MCP",
			version: "1.0",
			type: "stateless",
			tools: toolsData
		});

		return response;
	}

	/**
	 * Handle requests to the /execute endpoint
	 * Executes a specified tool with the provided parameters
	 */
	private async handleExecuteRequest(ctx: Context, tools: MCPTool[]): Promise<INanoServiceResponse> {
		const response = new NanoServiceResponse();
		
		try {
			// Get tool name and parameters from the request body
			const body = ctx.request.body as Record<string, any>;
			const toolName = body?.name as string;
			const parameters = body?.parameters as Record<string, any> || {};
			
			if (!toolName) {
				throw new Error("Invalid request: Missing tool name");
			}
			
			// Find the requested tool
			const tool = tools.find(t => t.name === toolName);
			
			if (!tool) {
				throw new Error(`Tool '${toolName}' not found`);
			}
			
			// Create MCPRequestContext from ctx
			const mcpContext: MCPRequestContext = {
				operation: typeof ctx.request.params.mcp_operation === 'string' ? ctx.request.params.mcp_operation : 'execute',
				method: (ctx.request.method as unknown) as string,
				body: ctx.request.body as Record<string, any>,
				params: ctx.request.params as Record<string, any>,
				query: ctx.request.query as Record<string, any>,
				headers: ctx.request.headers as Record<string, any>,
				client: {
					id: ctx.id,
					name: 'mcp-server',
					version: '1.0.0'
				}
			};
			
			// Special handling for list_available_tools
			if (toolName === 'list_available_tools') {
				const toolsList = tools.map(t => ({
					name: t.name,
					description: t.description,
					schema: Object.entries(t.schema || {}).map(([paramName, schema]) => ({
						name: paramName,
						description: (schema as any)?.description || paramName,
						type: (schema as any)?.type?.type || 'string'
					}))
				}));
				
				// Filter by category if provided
				const category = parameters?.category?.toLowerCase();
				const filteredTools = category
					? toolsList.filter(t => 
						t.name.toLowerCase().includes(category) || 
						t.description.toLowerCase().includes(category))
					: toolsList;
				
				response.setSuccess({
					result: {
						tools: filteredTools,
						total: filteredTools.length,
						category: category || 'all'
					}
				});
				
				return response;
			}
			// Special handling for chain_tools
			else if (toolName === 'chain_tools') {
				const toolSequence = parameters.tool_sequence;
				const initialInput = parameters.initial_input || {};
				
				if (!toolSequence || !Array.isArray(toolSequence) || toolSequence.length === 0) {
					throw new Error("No tools specified in the sequence");
				}
				
				// Execute each tool in sequence, passing output as input to the next
				let currentInput = initialInput;
				let finalResult: any = null;
				
				for (const sequenceToolName of toolSequence) {
					// Find the tool
					const sequenceTool = tools.find(t => t.name === sequenceToolName);
					if (!sequenceTool) {
						throw new Error(`Tool '${sequenceToolName}' in sequence not found`);
					}
					
					// Execute the tool
					const executeResponse = await this.executeToolImplementation(sequenceTool, currentInput, mcpContext);
					finalResult = executeResponse?.result || executeResponse;
					
					// Use the result as input for the next tool
					currentInput = finalResult;
				}
				
				response.setSuccess({
					result: {
						result: finalResult,
						chained_tools: toolSequence
					}
				});
				
				return response;
			}
			
			// For all other tools, execute their implementation
			const result = await this.executeToolImplementation(tool, parameters, mcpContext);
			
			// Return the result
			response.setSuccess({
				result
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
	
	/**
	 * Execute a tool's implementation
	 */
	private async executeToolImplementation(tool: MCPTool, parameters: Record<string, any>, mcpContext?: MCPRequestContext): Promise<any> {
		try {
			// Prepare inputs with context if available
			const inputs = {
				...parameters,
				context: mcpContext
			};
			
			// Convert function string to async function
			const asyncExecuteFn = new Function('inputs', `
				return (async () => {
					try {
						${tool.implementation}
					} catch (error) {
						if (error.message && error.message.includes('require is not defined')) {
							return { error: 'The tool implementation uses Node.js require() which is not supported. Please update the tool implementation to use browser-compatible code.' };
						}
						throw error;
					}
				})();
			`);
			
			// Execute the tool implementation with the provided parameters
			return await asyncExecuteFn(inputs);
		} catch (error) {
			throw new Error(`Error executing tool: ${(error as Error).message}`);
		}
	}

	/**
	 * Handle requests to the root MCP endpoint
	 * Provides information about the MCP implementation
	 */
	private handleInfoRequest(tools: MCPTool[]): INanoServiceResponse {
		const response = new NanoServiceResponse();
		
		response.setSuccess({
			protocol: "Model Context Protocol",
			implementation: "Stateless MCP",
			version: "1.0.0",
			description: "A revolutionary stateless implementation of MCP for nanoservices",
			endpoints: [
				{
					path: "/tools",
					description: "List all available tools"
				},
				{
					path: "/execute",
					description: "Execute a specific tool"
				}
			],
			tools_count: tools.length
		});
		
		return response;
	}

	// Convert a weather tool to MCP format
	private convertWeatherToolToMCP(): MCPTool {
		return {
			name: "weather",
			description: "Get current weather information for any city or location worldwide. Use this tool whenever a user asks about weather, temperature, conditions, humidity, or wind for a specific location. The tool returns real-time data from Open-Meteo API.",
			schema: {
				city: {
					type: {
						type: "string"
					},
					description: "The name of the city or location to get weather information for. Examples: 'Paris', 'New York', 'Tokyo', 'Toronto', etc."
				}
			},
			implementation: `
				try {
					const baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';
					console.log("Making HTTP POST request to: " + baseUrl + "/weather");
					
					// Use axios to make the HTTP request
					const axios = require('axios');
					const response = await axios.post(baseUrl + "/weather", {
						city: inputs.city
					});
					
					console.log("Weather API response:", response.data);
					return response.data;
				} catch (error) {
					console.error("Error calling weather API:", error.message);
					return { error: error.message };
				}
			`
		};
	}
	
	// Create a specialized tool for listing all available tools
	private createListToolsTool(): MCPTool {
		return {
			name: "list_available_tools",
			description: "Get a list of all tools available on this MCP server.",
			schema: {
				category: {
					type: { type: "string" },
					description: "Optional category filter"
				}
			},
			implementation: `
				return { message: "Tools listing feature is temporarily unavailable." };
			`
		};
	}
}
```

### MCP Entry Point

**File: `src/mcp-entry.ts`**

```typescript
#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs";
import path from "path";

// Create logging
// Use the directory where the script is located, not the root
const projectDir = process.env.PROJECT_DIR || process.cwd();
const logDir = path.join(projectDir, "logs");

try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (error) {
  // If we can't create the log directory, log to stderr only
  console.error(`[${new Date().toISOString()}] Unable to create log directory: ${error}`);
}

// Setup logging function that works even without a log file
function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Always log to stderr
  fs.writeSync(process.stderr.fd, logMessage + "\n");
  
  // Try to log to file if possible
  try {
    if (!fs.existsSync(logDir)) {
      return; // Skip file logging if directory doesn't exist
    }
    
    const logFilePath = path.join(logDir, "mcp-entry.log");
    fs.appendFileSync(logFilePath, logMessage + "\n");
  } catch (error) {
    // Silently fail on file logging errors
    fs.writeSync(process.stderr.fd, `[${timestamp}] Error writing to log file: ${error}\n`);
  }
}

// Environment variables
const nanoserviceUrl = process.env.NANOSERVICE_BASE_URL || "http://localhost:4000";
log(`Using nanoservice URL: ${nanoserviceUrl}`);

// Simple dictionary to store tools by name
let availableTools: any[] = [];

// Create server
const server = new Server(
  {
    name: "nanoservice",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Fetch all available workflows and tools
async function fetchAvailableTools(): Promise<any[]> {
  try {
    log("Fetching tools from nanoservice...");
    
    // First try the auto-mcp-server endpoint which should have all tools and workflows
    try {
      // Add mode=node_first param to prioritize nodes over workflows
      const response = await axios.get(`${nanoserviceUrl}/auto-mcp-server/tools?mode=node_first`);
      availableTools = response.data.tools || [];
      log(`Found ${availableTools.length} tools via auto-mcp-server endpoint (node-first mode)`);
      return availableTools;
    } catch (error: any) {
      log(`Auto-MCP endpoint failed: ${error.message}, trying fallback endpoint...`);
      
      // Fallback to /tools endpoint
      try {
        const response = await axios.get(`${nanoserviceUrl}/tools`);
        availableTools = response.data.tools || [];
        log(`Found ${availableTools.length} tools via base /tools endpoint`);
        return availableTools;
      } catch (error: any) {
        log(`Tools endpoint failed: ${error.message}`);
        
        // Try to get nodes directly first
        try {
          log("Attempting to fetch nodes directly...");
          const response = await axios.get(`${nanoserviceUrl}/nodes`);
          const nodes = response.data || [];
          
          // Convert nodes to tool format
          const nodeTools = nodes.map((node: any) => ({
            name: node.name,
            description: node.description || `Node: ${node.name}`,
            schema: node.schema || {}
          }));
          
          log(`Found ${nodeTools.length} nodes directly`);
          availableTools = nodeTools;
          
          // Then try to add workflows
          try {
            const workflowResponse = await axios.get(`${nanoserviceUrl}/workflows`);
            const workflows = workflowResponse.data || [];
            
            // Convert workflows to tool format
            const workflowTools = workflows.map((workflow: any) => ({
              name: workflow.path,
              description: workflow.description || `Workflow: ${workflow.path}`,
              schema: workflow.schema || {}
            }));
            
            log(`Found ${workflowTools.length} workflows directly`);
            
            // Add workflows that don't clash with node names
            const nodeNames = new Set(nodeTools.map((tool: any) => tool.name.toLowerCase()));
            const uniqueWorkflows = workflowTools.filter((tool: any) => 
              !nodeNames.has(tool.name.toLowerCase())
            );
            
            log(`Adding ${uniqueWorkflows.length} unique workflows (prioritizing nodes)`);
            availableTools = [...nodeTools, ...uniqueWorkflows];
            return availableTools;
          } catch (error: any) {
            log(`Workflows endpoint failed: ${error.message}`);
            return nodeTools; // Return just the nodes if workflows fail
          }
        } catch (error: any) {
          log(`Nodes endpoint failed: ${error.message}`);
          
          // Final attempt - directly query workflows if possible
          try {
            const response = await axios.get(`${nanoserviceUrl}/workflows`);
            const workflows = response.data || [];
            
            // Convert workflows to tool format
            availableTools = workflows.map((workflow: any) => ({
              name: workflow.path,
              description: workflow.description || `Workflow: ${workflow.path}`,
              schema: workflow.schema || {}
            }));
            
            log(`Found ${availableTools.length} workflows directly`);
            return availableTools;
          } catch (error: any) {
            log(`Workflows endpoint failed: ${error.message}`);
            
            // If all endpoints fail, return an empty array
            return [];
          }
        }
      }
    }
  } catch (error) {
    log(`Error fetching tools: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Fetch the latest tools
  const tools = await fetchAvailableTools();
  
  // Log all tools for debugging
  tools.forEach(tool => {
    log(`Available tool: ${tool.name} - ${tool.description}`);
  });
  
  // Convert tools to MCP format
  return {
    tools: tools.map(tool => {
      // Preserve the original tool name exactly as provided by the server
      const schema = tool.schema || {};
      
      return {
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        inputSchema: {
          type: "object",
          properties: Object.entries(schema).reduce((acc: any, [key, val]: [string, any]) => {
            acc[key] = {
              type: "string",
              description: val.description || `Parameter: ${key}`
            };
            return acc;
          }, {}),
          required: Object.keys(schema)
        }
      };
    })
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args = {} } = request.params;
    log(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);
    
    // Find the tool from our available tools list
    const tool = availableTools.find(t => t.name === name);
    
    if (!tool) {
      // If tool not found, refresh tool list and try again
      await fetchAvailableTools();
      const refreshedTool = availableTools.find(t => t.name === name);
      
      if (!refreshedTool) {
        throw new Error(`Tool not found: ${name}`);
      }
    }
    
    // Special handling for chain_tools which allows workflow composition
    if (name === 'chain_tools') {
      log(`Executing chain_tools with sequence: ${JSON.stringify(args.tool_sequence)}`);
      
      // Execute each tool in sequence
      const toolSequence = Array.isArray(args.tool_sequence) ? args.tool_sequence : [];
      const initialInput = args.initial_input || {};
      
      if (toolSequence.length === 0) {
        throw new Error("No tools specified in the sequence");
      }
      
      let currentInput = initialInput;
      let finalResult: any = null;
      
      // Execute each tool in sequence
      for (const sequenceTool of toolSequence) {
        log(`Chain executing tool: ${sequenceTool}`);
        
        // Call the tool directly
        const toolResponse = await axios.post(`${nanoserviceUrl}/auto-mcp-server/execute`, {
          name: sequenceTool,
          parameters: currentInput
        });
        
        // Extract result and use as input for next tool
        finalResult = toolResponse.data?.result || toolResponse.data;
        currentInput = finalResult;
      }
      
      return {
        content: [
          {
            type: "text",
            text: typeof finalResult === "string" 
              ? finalResult 
              : JSON.stringify(finalResult, null, 2)
          }
        ]
      };
    }
    
    // Get the HTTP method for this tool (default to POST if not specified)
    const httpMethod = (tool.httpMethod || 'POST').toLowerCase();
    log(`Using HTTP method: ${httpMethod} for tool: ${name}`);
    
    // Call the nanoservice API using the appropriate HTTP method
    log(`Calling endpoint: ${nanoserviceUrl}/${name} with method: ${httpMethod}`);
    let response;
    
    switch (httpMethod) {
      case 'get':
        // For GET requests, convert args to query parameters
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        }
        const queryString = queryParams.toString();
        response = await axios.get(`${nanoserviceUrl}/${name}${queryString ? '?' + queryString : ''}`);
        break;
      
      case 'delete':
        response = await axios.delete(`${nanoserviceUrl}/${name}`, { data: args });
        break;
      
      case 'put':
        response = await axios.put(`${nanoserviceUrl}/${name}`, args);
        break;
      
      case 'patch':
        response = await axios.patch(`${nanoserviceUrl}/${name}`, args);
        break;
      
      case 'post':
      default:
        // Default to POST for backward compatibility
        response = await axios.post(`${nanoserviceUrl}/${name}`, args);
        break;
    }
    
    return {
      content: [
        {
          type: "text",
          text: typeof response.data === "string" 
            ? response.data 
            : JSON.stringify(response.data, null, 2)
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error executing tool: ${errorMessage}`);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  log("Starting MCP server...");
  
  // Pre-fetch tools to establish initial availability
  await fetchAvailableTools();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server running on stdio transport");
}

// Handle errors
process.on("uncaughtException", (error) => {
  log(`Uncaught exception: ${error.message}\n${error.stack}`);
});

process.on("unhandledRejection", (reason) => {
  log(`Unhandled rejection: ${reason}`);
});

// Start the server
runServer().catch((error) => {
  log(`Fatal error running server: ${error.message}`);
  process.exit(1);
});
```

### Init Registry

**File: `src/init-registry.ts`**

```typescript
import ExampleNodes from "./nodes/examples";
import ApiGatewayNodes from "./nodes/api-gateway";
import { MCPRegistry } from "./adapters/MCPRegistry";

export async function initRegistry() {
    console.log("Initializing global node registry...");
    
    // Register example nodes
    MCPRegistry.registerNodes(ExampleNodes);
    
    // Register API Gateway nodes
    console.log("Registering API Gateway nodes...");
    MCPRegistry.registerNodes(ApiGatewayNodes);
    
    // Discover and register all other nodes
    await MCPRegistry.discoverAndRegisterAllNodes();
    
    const nodeCount = Object.keys(MCPRegistry.getRegisteredNodes()).length;
    console.log(`Node registry initialized with ${nodeCount} nodes`);
    
    return MCPRegistry.getRegisteredNodes();
}
```

### Application Entry Point Changes

*Update `src/index.ts`*

```typescript
import { DefaultLogger } from "@nanoservice-ts/runner";
import { type Span, metrics, trace } from "@opentelemetry/api";
import HttpTrigger from "./HttpTrigger";
import { initRegistry } from "./init-registry";

// ... existing code ...

// Initialize the node registry
initRegistry().then(() => {
	console.log("Node registry initialization complete");
}).catch(error => {
	console.error("Error initializing node registry:", error);
});

if (process.env.DISABLE_TRIGGER_RUN !== "true") {
	new App().run();
}

```

### MCP Server Node Registration

*Update `src/nodes/examples/index.ts`*

```typescript
// ... existing imports ...
import StatelessMCPNode from "./mcp-server";
import WeatherToolNode from "./weather";

const ExampleNodes = {
  // ... existing nodes ...
  StatelessMCPNode,
  WeatherToolNode,
};

export default ExampleNodes;
```

### Auto‑MCP Server Workflow Example

`workflows/json/auto-mcp-server.json`

```json
{
    "name": "Auto-generated MCP Server",
    "description": "MCP server with tools generated from nanoservice nodes and workflows",
    "version": "1.0.0",
    "trigger": {
      "http": {
        "method": "*",
        "path": "/:mcp_operation?",
        "accept": "application/json"
      }
    },
    "steps": [
      {
        "name": "mcp-endpoint",
        "node": "mcp-server",
        "type": "module"
      }
    ],
    "nodes": {
      "mcp-endpoint": {
        "inputs": {
          "debug_mode": true,
          "discover_nodes": false,
          "discover_workflows": true,
          "workflows_directory": "/Users/wellingtonprado/Projects/Deskree/nano-service/workflows",
          "excluded_workflows": ["auto-mcp-server", "chatgpt-interface", "chatgpt-ui", "mcp-client", "list_available_tools", "empty", "email-signature-generator", "chain-tools", "feedback"],
          "excluded_nodes": ["mcp-server", "error", "mapper", "openai"],
          "tools": []
        }
      }
    }
  }
```

---

## Dependency Installation Reminder

```bash
npm install @modelcontextprotocol/sdk axios
```

---

## 🖥 Claude Desktop Integration

Once your MCP server is up and running, follow these steps to integrate it with Claude:

1. Build your project:

```bash
npm run build
```

2. Start your development server:

```bash
npm run dev
```

3. Open Claude Desktop → Go to **Settings > Developer > Edit Config**

4. Add this example config:

```json
{
  "mcpServers": {
    "nano-service": {
      "command": "node",
      "args": [
        "./dist/mcp-entry.js"
      ],
      "env": {
        "NANOSERVICE_BASE_URL": "http://localhost:4000",
        "PROJECT_DIR": "path/to/your/project",
        "WORKFLOWS_DIR": "path/to/your/project/workflows"
      }
    }
  },
  "cwd": "path/to/your/project"
}
```

Replace `path/to/your/project` with your actual project directory.

5. Save and restart Claude. You should now see your tools listed under the 🔨 **Tools** tab.

---

## ✅ Final Notes

* You now have a stateless MCP server ready to serve any AI assistant.
* Workflows and nodes are auto-registered and exposed to Claude.
* You can continue expanding with new tools and chained operations.

For detailed errors, logging, and advanced tool management, refer to the full guide linked above.

---

## 📎 Documentation

👉 [https://nanoservice.xyz/d/introduction/welcome](https://nanoservice.xyz/d/introduction/welcome)

If you found this helpful, give it a ⭐ on GitHub and subscribe to the [Deskree YouTube Channel](https://www.youtube.com/@deskree?sub_confirmation=1) for more updates!
