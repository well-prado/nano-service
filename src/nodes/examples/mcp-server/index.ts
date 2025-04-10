import {
	type INanoServiceResponse,
	NanoService,
	NanoServiceResponse,
} from "@nanoservice-ts/runner";
import { type Context, GlobalError } from "@nanoservice-ts/shared";
import { MCPRegistry } from "../../../adapters/MCPRegistry";
import { MCPTool } from "../../../adapters/NodeToMCPAdapter";
import path from "path";
import axios from "axios";

// Input type for the MCP server node
type InputType = {
	tools?: MCPTool[];
	debug_mode?: boolean;
	discover_workflows?: boolean;
	workflows_directory?: string;
	excluded_workflows?: string[];
	excluded_nodes?: string[];
};

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
		
		// Add tools from node registry
		if (MCPRegistry) {
			// Use tools from registry
			const nodeTools = MCPRegistry.getNodeMCPTools({
				excludeNodes: inputs.excluded_nodes
			});
			
			if (debug) {
				console.log(`[MCP] Found ${nodeTools.length} node tools`);
			}
			
			allTools = [...allTools, ...nodeTools];
			
			// Add tools from workflows if enabled
			if (inputs.discover_workflows) {
				try {
					// Use the base workflows directory instead of a specific format directory
					const workflowsBaseDir = inputs.workflows_directory?.includes("/") 
						? inputs.workflows_directory 
						: path.resolve(process.cwd(), "workflows");
					
					if (debug) {
						console.log(`[MCP] Discovering workflows from ${workflowsBaseDir}`);
					}
					
					const workflowTools = MCPRegistry.getWorkflowMCPTools({
						workflowsDir: workflowsBaseDir,
						excludeWorkflows: inputs.excluded_workflows
					});
					
					if (debug) {
						console.log(`[MCP] Found ${workflowTools.length} workflow tools`);
					}
					
					allTools = [...allTools, ...workflowTools];
				} catch (error) {
					console.error(`[MCP] Error discovering workflows:`, error);
				}
			}
		}
		
		// Add or replace the weather tool with our enhanced version
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
		
		// Add the specialized tool for listing all available tools
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
			schema: tool.schema
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
			
			// Special handling for list_available_tools
			if (toolName === 'list_available_tools') {
				console.log(`Executing list_available_tools with category: ${parameters.category || 'all'}`);
				
				// Format tools for more user-friendly display
				const category = parameters.category?.toLowerCase();
				
				// Filter tools if category is provided
				let filteredTools = tools;
				if (category) {
					filteredTools = tools.filter(t => 
						t.name.toLowerCase().includes(category) || 
						(t.description && t.description.toLowerCase().includes(category))
					);
				}
				
				// Format the tools list
				const formattedTools = filteredTools.map(t => {
					// Format parameters if available
					let paramInfo = "";
					if (t.schema) {
						paramInfo = "\nParameters:\n" + Object.entries(t.schema)
							.map(([name, schema]: [string, any]) => {
								const desc = schema.description || "No description";
								return `- ${name}: ${desc}`;
							})
							.join("\n");
					}
					
					return {
						name: t.name,
						description: t.description || "No description available",
						parameters: paramInfo
					};
				});
				
				// Create a readable formatted response
				const readableResponse = formattedTools.map(t => 
					`Tool: ${t.name}\nDescription: ${t.description}${t.parameters}`
				).join('\n\n');
				
				response.setSuccess({
					result: {
						total_tools: filteredTools.length,
						category: category || "all",
						tools: formattedTools,
						formatted_response: `Available tools${category ? ` in category "${category}"` : ''}:\n\n${readableResponse}`
					}
				});
				
				return response;
			}
			
			// Special handling for weather tools
			else if (toolName.toLowerCase().includes('weather')) {
				console.log(`Executing real weather workflow for ${toolName}`);
				
				try {
					// Get the base URL for the nanoservice
					const baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';
					
					// Use the workflow name directly without path parameters
					// The weather-tool workflow handles city via body/param
					const city = parameters.city || 'New York';
					console.log(`Calling weather workflow for city: ${city}`);
					
					// Make an HTTP POST to the weather-tool workflow with the city in the body
					// This avoids path parameter issues
					const weatherUrl = `${baseUrl}/weather-tool`;
					console.log(`Making HTTP POST request to: ${weatherUrl}`);
					
					const weatherResponse = await axios.post(weatherUrl, { city });
					
					console.log(`Weather workflow response:`, weatherResponse.data);
					
					// Return the actual weather data from the workflow
					response.setSuccess({
						result: weatherResponse.data
					});
					
					return response;
				} catch (error) {
					console.error(`Error calling weather workflow:`, error);
					// Fall back to more basic implementation if the workflow call fails
					
					// This is just a fallback in case the real workflow is not available
					const city = parameters.city || 'New York';
					response.setSuccess({
						result: { 
							city: city, 
							temperature: 22, 
							condition: 'Unknown',
							humidity: 50,
							note: 'This is fallback data because the real weather workflow failed. Error: ' + (error as Error).message
						}
					});
					
					return response;
				}
			} else if (toolName.toLowerCase().includes('calculator')) {
				// Special handling for calculator
				try {
					const expression = parameters.expression || '0';
					// Use Function constructor instead of eval for better safety
					const result = new Function('return ' + expression)();
					response.setSuccess({
						result: { result }
					});
					return response;
				} catch (error) {
					response.setSuccess({
						result: { error: (error as Error).message }
					});
					return response;
				}
			}
			
			try {
				// For other tools, convert function string to async function
				const asyncExecuteFn = new Function('inputs', `
					return (async () => {
						try {
							${tool.implementation}
						} catch (error) {
							if (error.message.includes('require is not defined')) {
								return { error: 'The tool implementation uses Node.js require() which is not supported. Please update the tool implementation to use browser-compatible code.' };
							}
							throw error;
						}
					})();
				`);
				
				// Execute the tool implementation with the provided parameters
				const result = await asyncExecuteFn(parameters);
				
				// Return the result
				response.setSuccess({
					result: result
				});
			} catch (error) {
				throw new Error(`Error executing tool: ${(error as Error).message}`);
			}
			
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
					console.log("Making HTTP POST request to: " + baseUrl + "/weather-tool");
					
					// Use axios to make the HTTP request
					const axios = require('axios');
					const response = await axios.post(baseUrl + "/weather-tool", {
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
			description: "Get a comprehensive list of all tools available on this MCP server. Use this tool when the user asks what tools are available, what capabilities the assistant has, or what functions can be performed.",
			schema: {
				category: {
					type: {
						type: "string"
					},
					description: "Optional category filter (e.g., 'weather', 'database', etc.). Leave empty to list all tools."
				}
			},
			implementation: `
				try {
					// Get all tools through the MCP protocol
					const baseUrl = process.env.NANOSERVICE_BASE_URL || 'http://localhost:4000';
					const mcpServer = baseUrl + "/auto-mcp-server";
					console.log("Fetching tools list from MCP server:", mcpServer);
					
					const axios = require('axios');
					const response = await axios.get(mcpServer + "/tools");
					const allTools = response.data?.tools || [];
					
					// Optional category filtering
					let filteredTools = allTools;
					const category = inputs.category?.toLowerCase();
					if (category) {
						filteredTools = allTools.filter(tool => 
							tool.name.toLowerCase().includes(category) || 
							(tool.description && tool.description.toLowerCase().includes(category))
						);
					}
					
					// Format the tools for user-friendly display
					const toolsInfo = filteredTools.map(tool => {
						// Create parameter descriptions if available
						let paramInfo = "";
						if (tool.schema) {
							paramInfo = "\\nParameters: " + Object.entries(tool.schema)
								.map(([name, schema]) => {
									const desc = schema.description || "No description";
									return \`- \${name}: \${desc}\`;
								})
								.join("\\n");
						}
						
						return {
							name: tool.name,
							description: tool.description || "No description available",
							parameters: paramInfo
						};
					});
					
					return {
						total_tools: filteredTools.length,
						category: category || "all",
						tools: toolsInfo
					};
				} catch (error) {
					console.error("Error listing tools:", error.message);
					return { error: error.message };
				}
			`
		};
	}
}