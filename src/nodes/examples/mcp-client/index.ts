import {
	type INanoServiceResponse,
	NanoService,
	NanoServiceResponse,
} from "@nanoservice-ts/runner";
import { type Context, GlobalError } from "@nanoservice-ts/shared";
import axios from "axios";
import OpenAI from 'openai';

type InputType = {
	serverUrl: string;
	openaiApiKey?: string;
	anthropicApiKey?: string;
	model?: string;
	messages: any[];
	useClaudeModel?: boolean;
};

const DEFAULT_MODEL = "gpt-4o";

// MCP Protocol constants
const MCP_VERSION = "1.0.0";
const MCP_ENDPOINTS = {
	TOOLS: "/tools", 
	EXECUTE: "/execute",
	INFO: "/"
};

/**
 * MCPClient - A client node that connects to MCP servers and processes
 * queries using AI models like Claude or GPT
 */
export default class MCPClient extends NanoService<InputType> {
	constructor() {
		super();
		this.inputSchema = {
			type: "object",
			properties: {
				serverUrl: {
					type: "string",
					description: 'URL of the MCP server'
				},
				openaiApiKey: {
					type: "string",
					description: 'OpenAI API key'
				},
				anthropicApiKey: {
					type: "string",
					description: 'Anthropic API key'
				},
				model: {
					type: "string",
					description: 'Model to use (e.g., gpt-4-turbo, gpt-3.5-turbo, claude-3-5-sonnet)'
				},
				messages: {
					type: "array",
					description: 'Messages for the chat completion'
				},
				useClaudeModel: {
					type: "boolean",
					description: 'Whether to use Claude model instead of GPT'
				}
			},
			required: ["serverUrl", "messages"]
		};
	}

	async handle(ctx: Context, inputs: InputType): Promise<INanoServiceResponse> {
		const response = new NanoServiceResponse();

		try {
			const serverUrl = inputs.serverUrl;
			const model = inputs.model || DEFAULT_MODEL;
			const openaiApiKey = inputs.openaiApiKey;
			const anthropicApiKey = inputs.anthropicApiKey;
			const useClaudeModel = inputs.useClaudeModel || false;
			const messages = inputs.messages || [];

			if (!serverUrl) {
				throw new Error("No MCP server URL provided");
			}

			// Fetch server capabilities and available tools using the MCP protocol
			const serverInfo = await this.fetchMCPServerInfo(serverUrl);
			console.log(`Connected to MCP Server: ${serverInfo.protocol || 'MCP'} ${serverInfo.version || MCP_VERSION}`);
			
			// Fetch tools following the MCP standard
			const tools = await this.fetchToolsFromMCPServer(serverUrl);
			console.log(`Found ${tools.length} tools from MCP server ${serverUrl}`);
			
			// If no tools are available, throw error following MCP protocol
			if (!tools || tools.length === 0) {
				throw new Error(`No tools found at MCP server: ${serverUrl}`);
			}

			// Process messages and generate response using OpenAI or Anthropic
			// No manual tool query detection - let the models use the MCP protocol tools
			let processedResponse;
			if (useClaudeModel && anthropicApiKey) {
				processedResponse = await this.processWithAnthropic(anthropicApiKey, model, messages, tools, serverUrl);
			} else if (openaiApiKey) {
				processedResponse = await this.processWithOpenAI(openaiApiKey, model, messages, tools, serverUrl);
			} else {
				throw new Error("No API key provided for OpenAI or Anthropic");
			}

			response.setSuccess(processedResponse);
		} catch (error) {
			console.error(`Error in MCP client:`, error);
			
			const nodeError = new GlobalError((error as Error).message);
			nodeError.setCode(500);
			nodeError.setStack((error as Error).stack);
			nodeError.setName(this.name);

			response.setError(nodeError);
		}

		return response;
	}
	
	/**
	 * Fetch MCP server information
	 */
	private async fetchMCPServerInfo(serverUrl: string): Promise<any> {
		try {
			// Format and validate the URL
			const formattedUrl = this.formatMCPUrl(serverUrl);
			
			// Use the root endpoint to get server info
			const infoUrl = `${formattedUrl}${MCP_ENDPOINTS.INFO === '/' ? '' : MCP_ENDPOINTS.INFO}`;
			console.log(`Fetching MCP server info from: ${infoUrl}`);
			
			const response = await axios.get(infoUrl);
			return response.data || { protocol: "MCP", version: MCP_VERSION };
		} catch (error) {
			console.error('Error fetching MCP server info:', error);
			// Return a default info object on error
			return { protocol: "MCP", version: MCP_VERSION };
		}
	}
	
	/**
	 * Fetch available tools from the MCP server
	 */
	private async fetchToolsFromMCPServer(serverUrl: string): Promise<any[]> {
		try {
			// Format and validate the URL
			const formattedUrl = this.formatMCPUrl(serverUrl);
			
			// Use the tools endpoint following MCP protocol
			const toolsUrl = `${formattedUrl}${MCP_ENDPOINTS.TOOLS}`;
			console.log(`Fetching tools from MCP server: ${toolsUrl}`);
			
			const response = await axios.get(toolsUrl);
			// Handle both MCP protocol formats (tools in response or direct array)
			return response.data?.tools || response.data || [];
		} catch (error) {
			console.error('Error fetching tools from MCP server:', error);
			throw new Error(`Error with MCP server: ${(error as Error).message}`);
		}
	}
	
	/**
	 * Execute a tool on the MCP server following MCP protocol
	 */
	private async executeToolOnMCPServer(serverUrl: string, toolName: string, parameters: any): Promise<any> {
		try {
			// Format and validate the URL
			const formattedUrl = this.formatMCPUrl(serverUrl);
			
			// Use the execute endpoint following MCP protocol
			const executeUrl = `${formattedUrl}${MCP_ENDPOINTS.EXECUTE}`;
			console.log(`Executing tool ${toolName} on MCP server: ${executeUrl}`);
			console.log(`Parameters:`, parameters);
			
			// Format the request following MCP protocol
			const response = await axios.post(executeUrl, {
				name: toolName,
				parameters
			});
			
			// Handle both MCP protocol formats (result in response or direct data)
			return response.data?.result || response.data;
		} catch (error) {
			console.error(`Error executing tool ${toolName} on MCP server:`, error);
			// Return error in MCP protocol format
			return {
				isError: true,
				content: [{
					type: "text",
					text: `Error executing tool ${toolName}: ${(error as Error).message}`
				}]
			};
		}
	}
	
	/**
	 * Format and validate MCP URL
	 */
	private formatMCPUrl(url: string): string {
		// Ensure URL has a protocol prefix
		let formattedUrl = url;
		if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
			formattedUrl = `http://${formattedUrl}`;
		}
		
		// Validate URL is properly formatted
		try {
			new URL(formattedUrl);
		} catch (e) {
			console.error(`Invalid MCP server URL: ${formattedUrl}`);
			throw new Error(`Invalid MCP server URL: ${formattedUrl}`);
		}
		
		// Ensure URL ends with slash for proper path joining
		if (!formattedUrl.endsWith('/')) {
			formattedUrl = `${formattedUrl}/`;
		}
		
		return formattedUrl;
	}
	
	/**
	 * Process a query using OpenAI models (GPT)
	 */
	private async processWithOpenAI(
		apiKey: string,
		model: string,
		messages: any[],
		tools: any[],
		serverUrl: string
	): Promise<any> {
		// Convert tools to OpenAI format
		const openaiTools = tools.map(tool => {
			// Fix schema format - extract simple types from nested objects
			const fixedSchema: Record<string, any> = {};
			
			if (tool.schema) {
				Object.entries(tool.schema).forEach(([paramName, paramSchema]: [string, any]) => {
					const paramType = paramSchema.type?.type || "string";
					
					fixedSchema[paramName] = {
						type: paramType,
						description: paramSchema.description || `Parameter: ${paramName}`
					};
					
					// Add items property for array types
					if (paramType === "array") {
						// Default to string items if not specified
						fixedSchema[paramName].items = {
							type: "string"
						};
					}
					
					// Add enum if available
					if (paramSchema.enum) {
						fixedSchema[paramName].enum = paramSchema.enum;
					}
				});
			}
			
			// Sanitize tool name to match OpenAI requirements
			const sanitizedName = this.sanitizeToolName(tool.name);
			
			return {
				type: "function" as const,
				function: {
					name: sanitizedName,
					description: tool.description,
					parameters: {
						type: "object",
						properties: fixedSchema,
						required: Object.keys(fixedSchema)
					}
				}
			};
		});
		
		// Special handling for multiple tool execution (MCP parallel execution)
		openaiTools.push({
			type: "function" as const,
			function: {
				name: "multi_tool_use_parallel",
				description: "Use this to execute multiple tools in parallel",
				parameters: {
					type: "object",
					properties: {
						tools_to_use: {
							type: "array",
							items: {
								type: "object",
								properties: {
									tool_name: {
										type: "string",
										enum: tools.map(t => this.sanitizeToolName(t.name))
									},
									parameters: {
										type: "object"
									}
								},
								required: ["tool_name", "parameters"]
							}
						}
					},
					required: ["tools_to_use"]
				}
			}
		});

		// Add a system message instructing the model to use tools if not already present
		const hasSystemMessage = messages.some(msg => msg.role === 'system');
		const processedMessages = [...messages];
		
		if (!hasSystemMessage) {
			processedMessages.unshift({
				role: 'system',
				content: `You are an AI assistant with access to external tools through the Model Context Protocol (MCP).

When asked about available tools or capabilities, use the list_available_tools tool to provide accurate information about what tools are available.

NEVER invent tools or capabilities you don't have. ALWAYS use the list_available_tools tool to check what's available when asked about your capabilities.

ALWAYS USE TOOLS when they can help answer a user's question. Present information from tools in a clear, readable format.

For weather-related queries, use the weather tool with the specific city mentioned. Present all available data from the result.

Never claim you can't access information when a suitable tool is available.`
			});
		}
		
		try {
			console.log(`Creating OpenAI client with model ${model}`);
			const openai = new OpenAI({ apiKey });
			
			// Create a request to OpenAI
			const response = await openai.chat.completions.create({
				model,
				messages: processedMessages,
				tools: openaiTools,
				tool_choice: "auto" // Let the model decide when to use tools
			});
			
			// Extract the message from the response
			const responseMessage = response.choices[0]?.message;
			
			// If there are tool calls, handle them
			if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
				// Handle multiple tool calls
				const toolResults = await Promise.all(
					responseMessage.tool_calls.map(async (toolCall: any) => {
						if (toolCall.type !== 'function') return null;
						
						const { name, arguments: argsString } = toolCall.function;
						const args = JSON.parse(argsString);
						
						// Handle multi-tool execution
						if (name === "multi_tool_use_parallel") {
							const { tools_to_use } = args;
							const multiResults = await Promise.all(
								tools_to_use.map(async (toolToUse: any) => {
									const { tool_name, parameters } = toolToUse;
									// Find the original tool name before sanitization
									const originalToolName = this.findOriginalToolName(tools, tool_name);
									const result = await this.executeToolOnMCPServer(serverUrl, originalToolName, parameters);
									return { tool_name, result };
								})
							);
							
							return {
								tool_call_id: toolCall.id,
								name,
								result: multiResults
							};
						}
						
						// Handle single tool execution - find original name
						const originalToolName = this.findOriginalToolName(tools, name);
						const result = await this.executeToolOnMCPServer(serverUrl, originalToolName, args);
						return {
							tool_call_id: toolCall.id,
							name,
							result
						};
					})
				);
				
				// Filter out null results
				const validToolResults = toolResults.filter((result: any) => result !== null);
				
				// Add tool results to messages
				const updatedMessages = [
					...processedMessages,
					responseMessage,
					...validToolResults.map((toolResult: any) => ({
						role: "tool" as const,
						tool_call_id: toolResult?.tool_call_id,
						name: toolResult?.name,
						content: JSON.stringify(toolResult?.result)
					}))
				];
				
				// Make a second call to OpenAI to summarize the results
				const secondResponse = await openai.chat.completions.create({
					model,
					messages: updatedMessages,
				});
				
				return secondResponse.choices[0]?.message;
			} else {
				// No tool calls were made, return the original response
				return responseMessage;
			}
		} catch (error) {
			console.error("Error processing with OpenAI:", error);
			throw error;
		}
	}
	
	/**
	 * Sanitize a tool name to conform to OpenAI's requirements
	 * Only alphanumeric characters, underscores, and hyphens are allowed
	 */
	private sanitizeToolName(name: string): string {
		// Replace any invalid characters with underscore
		return name.replace(/[^a-zA-Z0-9_-]/g, '_');
	}
	
	/**
	 * Find the original tool name from a sanitized version
	 */
	private findOriginalToolName(tools: any[], sanitizedName: string): string {
		// First try exact match
		const exactMatch = tools.find(tool => tool.name === sanitizedName);
		if (exactMatch) return exactMatch.name;
		
		// Then try to find by sanitized name
		const matchingTool = tools.find(tool => this.sanitizeToolName(tool.name) === sanitizedName);
		
		// If it's the list_available_tools tool, prioritize it
		if (sanitizedName === 'list_available_tools') {
			return sanitizedName;
		}
		
		return matchingTool ? matchingTool.name : sanitizedName;
	}
	
	/**
	 * Process a query using Anthropic models (Claude)
	 */
	private async processWithAnthropic(
		apiKey: string,
		model: string,
		messages: any[],
		tools: any[],
		serverUrl: string
	): Promise<any> {
		if (!apiKey) {
			throw new Error('Anthropic API key is required');
		}
		
		// Check if we need to add a system message with tools information
		const hasSystemMessage = messages.some(msg => msg.role === 'system');
		
		// Create a tools description for the system message if needed
		if (!hasSystemMessage) {
			// Add system message to beginning
			messages.unshift({
				role: 'system',
				content: `You have access to external tools through the Model Context Protocol (MCP).

When asked about available tools or capabilities, use the list_available_tools tool to provide accurate information about what tools are available. 

NEVER invent tools or capabilities you don't have. ALWAYS use the list_available_tools tool to check what's available when asked about your capabilities.

ALWAYS USE TOOLS when they can help answer a user's question. Present information from tools in a clear, readable format.

For weather-related queries, use the weather tool with the specific city mentioned. Present all available data from the result.

If a tool call fails, explain what went wrong to the user.`
			});
		}
		
		// Convert messages to Anthropic format if needed
		const claudeMessages = messages.map(msg => {
			// Handle OpenAI format conversion if needed
			if (msg.role === 'assistant' && msg.tool_calls) {
				// Convert OpenAI tool calls to Anthropic format
				return {
					role: msg.role,
					content: [
						{ type: "text", text: msg.content || "" }
					]
				};
			}
			
			if (msg.role === 'tool') {
				// Convert OpenAI tool results to Anthropic format
				return {
					role: 'user',
					content: [
						{
							type: "tool_result",
							tool_name: msg.name,
							tool_result_id: msg.tool_call_id,
							content: msg.content
						}
					]
				};
			}
			
			// Default mapping
			return {
				role: msg.role === 'user' ? 'user' : 'assistant',
				content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
			};
		});
		
		// Format tools for Claude
		const claudeTools = tools.map(tool => ({
			name: tool.name,
			description: tool.description,
			input_schema: this.convertMCPSchemaToJSONSchema(tool.schema)
		}));
		
		try {
			// Call Anthropic API directly (no SDK)
			const response = await axios.post(
				'https://api.anthropic.com/v1/messages',
				{
					model: model || 'claude-3-5-sonnet-20241022',
					max_tokens: 4000,
					messages: claudeMessages,
					tools: claudeTools
				},
				{
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01'
					}
				}
			);
			
			const responseMessage = response.data?.content || [];
			
			// Check if there are tool calls in the response
			const toolCalls = responseMessage.filter(
				(content: any) => content.type === 'tool_use'
			);
			
			if (toolCalls && toolCalls.length > 0) {
				// Handle tool calls and gather results
				const toolResults = await Promise.all(
					toolCalls.map(async (toolCall: any) => {
						const { name, input } = toolCall;
						try {
							const result = await this.executeToolOnMCPServer(serverUrl, name, input);
							return {
								type: "tool_result",
								tool_call_id: toolCall.id,
								tool_name: name,
								content: JSON.stringify(result)
							};
						} catch (error) {
							console.error(`Error executing tool ${name}:`, error);
							return {
								type: "tool_result",
								tool_call_id: toolCall.id,
								tool_name: name,
								content: JSON.stringify({ error: (error as Error).message })
							};
						}
					})
				);
				
				// Add tool results to messages
				const updatedMessages = [
					...claudeMessages,
					{ role: "assistant", content: responseMessage },
					...toolResults.map((result: any) => ({
						role: "user", 
						content: [result]
					}))
				];
				
				// Make a second call to Claude to summarize the results
				const secondResponse = await axios.post(
					'https://api.anthropic.com/v1/messages',
					{
						model: model || 'claude-3-5-sonnet-20241022',
						max_tokens: 4000,
						messages: updatedMessages
					},
					{
						headers: {
							'Content-Type': 'application/json',
							'x-api-key': apiKey,
							'anthropic-version': '2023-06-01'
						}
					}
				);
				
				return secondResponse.data;
			}
			
			// If no tool calls, return the response directly
			return response.data;
		} catch (error) {
			console.error("Error processing with Claude:", error);
			throw error;
		}
	}
	
	/**
	 * Convert MCP schema to JSON Schema format
	 */
	private convertMCPSchemaToJSONSchema(mcpSchema: Record<string, any>): Record<string, any> {
		const jsonSchema: Record<string, any> = {
			type: "object",
			properties: {},
			required: []
		};
		
		for (const [propName, propSchema] of Object.entries(mcpSchema)) {
			const typeInfo = propSchema.type || { type: "string" };
			const paramType = typeInfo.type || "string";
			
			jsonSchema.properties[propName] = {
				type: paramType,
				description: propSchema.description || propName
			};
			
			// Add items property for array types
			if (paramType === "array") {
				// Default to string items if not specified
				jsonSchema.properties[propName].items = {
					type: "string"
				};
			}
			
			// Add additional properties if present
			if (propSchema.enum) {
				jsonSchema.properties[propName].enum = propSchema.enum;
			}
			
			// Add to required properties
			if (propSchema.required) {
				jsonSchema.required.push(propName);
			}
		}
		
		return jsonSchema;
	}
} 