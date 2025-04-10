import {
	type INanoServiceResponse,
	NanoService,
	NanoServiceResponse,
} from "@nanoservice-ts/runner";
import { type Context, GlobalError } from "@nanoservice-ts/shared";
import fs from "node:fs";
import path from "node:path";
import ejs from "ejs";

const rootDir = path.resolve(__dirname, ".");

type InputType = {
	title?: string;
	openai_api_key?: string;
	anthropic_api_key?: string;
	model?: string;
	workflow_docs?: boolean;
	mcp_support?: boolean;
};

export default class ChatGPTUI extends NanoService<InputType> {
	constructor() {
		super();
		this.inputSchema = {
			type: "object",
			properties: {
				title: { type: "string" },
				openai_api_key: { type: "string" },
				anthropic_api_key: { type: "string" },
				model: { type: "string" },
				workflow_docs: { type: "boolean" },
				mcp_support: { type: "boolean" }
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
			// Create index.html on-the-fly if it doesn't exist
			const indexPath = this.root("index.html");
			
			// Default values
			const title = inputs.title || "Nanoservice ChatGPT Interface";
			const model = inputs.model || "gpt-4o";
			const showWorkflowDocs = inputs.workflow_docs === undefined ? true : inputs.workflow_docs;
			const mcpSupport = inputs.mcp_support === undefined ? true : inputs.mcp_support;
			
			let htmlContent = '';
			
			// Check if we have a template file
			if (fs.existsSync(indexPath)) {
				htmlContent = fs.readFileSync(indexPath, "utf8");
			} else {
				// Create the HTML template dynamically
				htmlContent = this.generateHtmlTemplate();
			}
			
			const render = ejs.compile(htmlContent, { client: false });
			const html = render({
				title,
				openai_api_key: inputs.openai_api_key || "",
				anthropic_api_key: inputs.anthropic_api_key || "",
				model,
				showWorkflowDocs,
				mcpSupport
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
	
	private generateHtmlTemplate(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title><%= title %></title>
	<script src="https://cdn.tailwindcss.com"></script>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/github.min.css">
	<script src="https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/highlight.min.js"></script>
	<script src="https://cdn.jsdelivr.net/npm/marked@4.2.12/marked.min.js"></script>
	<style>
		.conversation-list {
			height: calc(100vh - 4rem);
			overflow-y: auto;
		}
		.chat-container {
			height: calc(100vh - 4rem);
			display: flex;
			flex-direction: column;
		}
		.message-container {
			flex-grow: 1;
			overflow-y: auto;
			padding: 1rem;
		}
		.user-message {
			background-color: #f7f7f8;
			border-radius: 0.5rem;
			padding: 1rem;
			margin-bottom: 1rem;
			max-width: 80%;
			align-self: flex-end;
		}
		.assistant-message {
			background-color: #ffffff;
			border: 1px solid #e5e7eb;
			border-radius: 0.5rem;
			padding: 1rem;
			margin-bottom: 1rem;
			max-width: 80%;
			align-self: flex-start;
		}
		.thinking {
			color: #6b7280;
			font-style: italic;
		}
		pre {
			background-color: #f3f4f6;
			padding: 0.75rem;
			border-radius: 0.5rem;
			overflow-x: auto;
			margin: 0.5rem 0;
		}
		code {
			font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
			font-size: 0.875rem;
		}
		.markdown-body table {
			border-collapse: collapse;
			margin: 1rem 0;
			width: 100%;
		}
		.markdown-body th, .markdown-body td {
			border: 1px solid #e5e7eb;
			padding: 0.5rem;
		}
		.markdown-body th {
			background-color: #f3f4f6;
			font-weight: 600;
		}
		.conversation-item {
			padding: 0.75rem 1rem;
			border-radius: 0.25rem;
			cursor: pointer;
			transition: background-color 0.2s;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.conversation-item:hover {
			background-color: #f3f4f6;
		}
		.conversation-item.active {
			background-color: #e5e7eb;
		}
		.tab-active {
			background-color: #e5e7eb;
			font-weight: 600;
			border-bottom: 2px solid #3b82f6;
		}
	</style>
</head>
<body class="bg-gray-50 text-gray-900">
	<div class="flex h-screen">
		<!-- Left Sidebar -->
		<div class="w-64 bg-white border-r border-gray-200 flex flex-col">
			<div class="p-4 flex justify-between items-center border-b border-gray-200">
				<h2 class="text-lg font-semibold">Conversations</h2>
				<button id="new-chat-btn" class="p-1 rounded-full hover:bg-gray-100">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
				</button>
			</div>
			
			<!-- Tab Navigation -->
			<div class="flex border-b border-gray-200">
				<button id="conversations-tab" class="flex-1 py-2 text-center tab-active">Chats</button>
				<% if (showWorkflowDocs) { %>
				<button id="workflows-tab" class="flex-1 py-2 text-center">Workflows</button>
				<% } %>
			</div>
			
			<!-- Conversations List -->
			<div id="conversations-container" class="flex-1 overflow-y-auto">
				<div id="conversation-list" class="conversation-list"></div>
			</div>
			
			<% if (showWorkflowDocs) { %>
			<!-- Workflows List (initially hidden) -->
			<div id="workflows-container" class="flex-1 overflow-y-auto hidden">
				<div id="workflows-list" class="conversation-list"></div>
			</div>
			<% } %>
			
			<!-- Settings Button -->
			<div class="p-4 border-t border-gray-200">
				<button id="settings-btn" class="flex items-center justify-center w-full p-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					Settings
				</button>
			</div>
		</div>
		
		<!-- Main Chat Area -->
		<div class="flex-1 flex flex-col">
			<!-- Chat Header -->
			<div class="p-4 bg-white border-b border-gray-200 flex justify-between items-center">
				<h1 class="text-xl font-semibold" id="chat-title"><%= title %></h1>
				<div>
					<span id="model-badge" class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"><%= model %></span>
				</div>
			</div>
			
			<!-- Chat Messages -->
			<div id="message-container" class="flex-1 overflow-y-auto p-4 bg-white">
				<div id="welcome-message" class="p-4 max-w-xl mx-auto">
					<h2 class="text-2xl font-bold mb-4">Welcome to Nanoservice ChatGPT UI</h2>
					<p class="mb-4">This interface lets you interact with ChatGPT models directly from your nanoservice application.</p>
					<p class="mb-2"><strong>Features:</strong></p>
					<ul class="list-disc pl-5 mb-4">
						<li>Chat with OpenAI's models</li>
						<li>View and manage conversation history</li>
						<% if (showWorkflowDocs) { %>
						<li>Browse available workflows and their documentation</li>
						<% } %>
						<li>Code syntax highlighting</li>
						<li>Markdown rendering</li>
					</ul>
					<p class="mb-4">To get started, type your message in the input field below and press Enter.</p>
				</div>
				<div id="messages" class="space-y-4"></div>
			</div>
			
			<!-- Chat Input -->
			<div class="p-4 bg-white border-t border-gray-200">
				<div class="relative">
					<textarea id="message-input" class="w-full p-3 pr-12 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" placeholder="Type your message..." rows="3"></textarea>
					<button id="send-btn" class="absolute bottom-3 right-3 p-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
						</svg>
					</button>
				</div>
			</div>
		</div>
		
		<!-- Settings Modal (initially hidden) -->
		<div id="settings-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden">
			<div class="bg-white rounded-lg p-6 w-full max-w-md">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold">Settings</h3>
					<button id="close-settings-btn" class="text-gray-500 hover:text-gray-700">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
						<input type="password" id="api-key-input" class="w-full p-2 border border-gray-300 rounded-md" value="<%= openai_api_key %>" placeholder="sk-...">
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Model</label>
						<select id="model-input" class="w-full p-2 border border-gray-300 rounded-md">
							<option value="gpt-4o" <%= model === 'gpt-4o' ? 'selected' : '' %>>GPT-4o</option>
							<option value="gpt-4-turbo" <%= model === 'gpt-4-turbo' ? 'selected' : '' %>>GPT-4 Turbo</option>
							<option value="gpt-3.5-turbo" <%= model === 'gpt-3.5-turbo' ? 'selected' : '' %>>GPT-3.5 Turbo</option>
						</select>
					</div>
					<% if (mcpSupport) { %>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">MCP Server</label>
						<select id="mcp-server-input" class="w-full p-2 border border-gray-300 rounded-md">
							<option value="">None (Use OpenAI directly)</option>
							<!-- MCP servers will be populated dynamically -->
						</select>
					</div>
					<% } %>
					<div class="pt-4 border-t border-gray-200">
						<button id="save-settings-btn" class="w-full p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Save Settings</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<script>
		document.addEventListener('DOMContentLoaded', () => {
			// DOM Elements
			const conversationList = document.getElementById('conversation-list');
			const workflowsList = document.getElementById('workflows-list');
			const conversationsTab = document.getElementById('conversations-tab');
			const workflowsTab = document.getElementById('workflows-tab');
			const conversationsContainer = document.getElementById('conversations-container');
			const workflowsContainer = document.getElementById('workflows-container');
			const messageContainer = document.getElementById('message-container');
			const messages = document.getElementById('messages');
			const messageInput = document.getElementById('message-input');
			const sendBtn = document.getElementById('send-btn');
			const newChatBtn = document.getElementById('new-chat-btn');
			const settingsBtn = document.getElementById('settings-btn');
			const settingsModal = document.getElementById('settings-modal');
			const closeSettingsBtn = document.getElementById('close-settings-btn');
			const saveSettingsBtn = document.getElementById('save-settings-btn');
			const apiKeyInput = document.getElementById('api-key-input');
			const modelInput = document.getElementById('model-input');
			const modelBadge = document.getElementById('model-badge');
			const chatTitle = document.getElementById('chat-title');
			const welcomeMessage = document.getElementById('welcome-message');
			
			// Conversation state
			let conversations = [];
			let currentConversationId = null;
			let workflows = [];
			let mcpServers = [];
			let settings = {
				apiKey: '<%= openai_api_key %>',
				model: '<%= model %>',
				mcpServer: ''
			};
			
			// Load saved conversations from localStorage
			function loadConversations() {
				const savedConversations = localStorage.getItem('conversations');
				if (savedConversations) {
					conversations = JSON.parse(savedConversations);
					renderConversationList();
				}
			}
			
			// Save conversations to localStorage
			function saveConversations() {
				localStorage.setItem('conversations', JSON.stringify(conversations));
			}
			
			// Load settings from localStorage
			function loadSettings() {
				const savedSettings = localStorage.getItem('chatSettings');
				if (savedSettings) {
					const parsed = JSON.parse(savedSettings);
					settings = { ...settings, ...parsed };
					apiKeyInput.value = settings.apiKey || '';
					modelInput.value = settings.model || 'gpt-4o';
					modelBadge.textContent = settings.model || 'gpt-4o';
					
					// Set MCP server if available
					if (settings.mcpServer && document.getElementById('mcp-server-input')) {
						document.getElementById('mcp-server-input').value = settings.mcpServer;
					}
				}
			}
			
			// Save settings to localStorage
			function saveSettings() {
				localStorage.setItem('chatSettings', JSON.stringify(settings));
			}
			
			// Create a new conversation
			function createNewConversation() {
				const id = Date.now().toString();
				const conversation = {
					id,
					title: 'New Conversation',
					messages: [],
					created: new Date().toISOString()
				};
				conversations.unshift(conversation);
				saveConversations();
				renderConversationList();
				setCurrentConversation(id);
			}
			
			// Set the current conversation
			function setCurrentConversation(id) {
				currentConversationId = id;
				
				// Update UI for the selected conversation
				const items = conversationList.querySelectorAll('.conversation-item');
				items.forEach(item => {
					if (item.dataset.id === id) {
						item.classList.add('active');
					} else {
						item.classList.remove('active');
					}
				});
				
				// Display the conversation messages
				renderMessages();
				
				// Update chat title
				const conversation = conversations.find(c => c.id === id);
				if (conversation) {
					chatTitle.textContent = conversation.title;
				}
				
				// Hide welcome message when a conversation is selected
				welcomeMessage.classList.add('hidden');
			}
			
			// Render the conversation list
			function renderConversationList() {
				conversationList.innerHTML = '';
				
				if (conversations.length === 0) {
					const emptyState = document.createElement('div');
					emptyState.className = 'p-4 text-center text-gray-500';
					emptyState.textContent = 'No conversations yet';
					conversationList.appendChild(emptyState);
					return;
				}
				
				conversations.forEach(conversation => {
					const item = document.createElement('div');
					item.className = 'conversation-item ' + (conversation.id === currentConversationId ? 'active' : '');
					item.dataset.id = conversation.id;
					
					const date = new Date(conversation.created);
					const formattedDate = date.toLocaleDateString();
					
					item.innerHTML = \`
						<div class="flex items-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
							</svg>
							<div class="overflow-hidden">
								<div class="truncate">\${conversation.title}</div>
								<div class="text-xs text-gray-500">\${formattedDate}</div>
							</div>
						</div>
					\`;
					
					item.addEventListener('click', () => {
						setCurrentConversation(conversation.id);
					});
					
					conversationList.appendChild(item);
				});
			}
			
			// Fetch and render workflows
			async function fetchWorkflows() {
				try {
					const response = await fetch('/chatgpt-interface/workflows');
					const data = await response.json();
					workflows = data.workflows || [];
					renderWorkflowsList();
				} catch (error) {
					console.error('Error fetching workflows:', error);
					// Fallback data if API isn't available
					workflows = [
						{ name: 'Weather API', description: 'Get weather information for a city' },
						{ name: 'Database Query', description: 'Execute database queries' },
						{ name: 'MCP Server', description: 'Model Context Protocol server' }
					];
					renderWorkflowsList();
				}
			}
			
			// Fetch and render MCP servers
			async function fetchMCPServers() {
				try {
					const response = await fetch('/chatgpt-interface/mcp-servers');
					const data = await response.json();
					mcpServers = data.mcp_servers || [];
					
					// Populate the MCP server dropdown
					const mcpServerInput = document.getElementById('mcp-server-input');
					if (mcpServerInput) {
						// Clear existing options except the first one
						while (mcpServerInput.options.length > 1) {
							mcpServerInput.remove(1);
						}
						
						// Add servers to dropdown
						mcpServers.forEach(server => {
							const option = document.createElement('option');
							option.value = server.url;
							option.textContent = server.name;
							mcpServerInput.appendChild(option);
						});
						
						// Set the selected server if one is saved in settings
						if (settings.mcpServer) {
							mcpServerInput.value = settings.mcpServer;
						}
					}
				} catch (error) {
					console.error('Error fetching MCP servers:', error);
				}
			}
			
			// Render workflows list
			function renderWorkflowsList() {
				workflowsList.innerHTML = '';
				
				if (workflows.length === 0) {
					const emptyState = document.createElement('div');
					emptyState.className = 'p-4 text-center text-gray-500';
					emptyState.textContent = 'No workflows available';
					workflowsList.appendChild(emptyState);
					return;
				}
				
				workflows.forEach(workflow => {
					const item = document.createElement('div');
					item.className = 'conversation-item';
					
					item.innerHTML = \`
						<div class="flex items-center">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
							</svg>
							<div>
								<div class="font-medium">\${workflow.name}</div>
								<div class="text-xs text-gray-500 truncate">\${workflow.description}</div>
							</div>
						</div>
					\`;
					
					item.addEventListener('click', () => {
						createWorkflowConversation(workflow);
					});
					
					workflowsList.appendChild(item);
				});
			}
			
			// Create a conversation about a workflow
			function createWorkflowConversation(workflow) {
				const id = Date.now().toString();
				const conversation = {
					id,
					title: \`About \${workflow.name}\`,
					messages: [
						{ role: 'system', content: 'You are an assistant that helps with nanoservice workflows.' },
						{ role: 'user', content: \`Tell me about the "\${workflow.name}" workflow and how to use it.\` }
					],
					created: new Date().toISOString()
				};
				
				conversations.unshift(conversation);
				saveConversations();
				renderConversationList();
				setCurrentConversation(id);
				
				// Immediately send the first message
				sendMessage(conversation.messages[1].content);
			}
			
			// Render messages for the current conversation
			function renderMessages() {
				messages.innerHTML = '';
				
				if (!currentConversationId) return;
				
				const conversation = conversations.find(c => c.id === currentConversationId);
				if (!conversation) return;
				
				// Filter out system messages
				const visibleMessages = conversation.messages.filter(m => m.role !== 'system');
				
				visibleMessages.forEach(message => {
					const messageEl = document.createElement('div');
					messageEl.className = 'flex ' + (message.role === 'user' ? 'justify-end' : 'justify-start');
					
					const contentEl = document.createElement('div');
					contentEl.className = message.role === 'user' ? 'user-message' : 'assistant-message';
					
					if (message.role === 'assistant' && message.content.trim() === '...') {
						contentEl.classList.add('thinking');
						contentEl.textContent = 'Thinking...';
					} else if (message.role === 'assistant' && message.content.trim() === '...mcp-loading') {
						contentEl.classList.add('thinking');
						contentEl.innerHTML = '<span class="font-semibold">Calling MCP tools...</span><br>Getting response from Model Context Protocol server';
					} else {
						// Render markdown
						contentEl.innerHTML = marked.parse(message.content);
						
						// Apply syntax highlighting to code blocks
						contentEl.querySelectorAll('pre code').forEach(block => {
							hljs.highlightElement(block);
						});
					}
					
					messageEl.appendChild(contentEl);
					messages.appendChild(messageEl);
				});
				
				// Scroll to bottom
				messageContainer.scrollTop = messageContainer.scrollHeight;
			}
			
			// Add a message to the current conversation
			function addMessage(role, content) {
				if (!currentConversationId) {
					createNewConversation();
				}
				
				const conversation = conversations.find(c => c.id === currentConversationId);
				if (!conversation) return;
				
				// Add the message
				conversation.messages.push({ role, content });
				
				// If this is the first user message, update the conversation title
				if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
					// Limit title length
					conversation.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
					chatTitle.textContent = conversation.title;
				}
				
				saveConversations();
				renderMessages();
			}
			
			// Send a message to the OpenAI API or MCP server
			async function sendMessage(content) {
				if (!content.trim()) return;
				
				addMessage('user', content);
				
				// Add a loading message - different for MCP vs regular chat
				if (settings.mcpServer) {
					addMessage('assistant', '...mcp-loading');
				} else {
					addMessage('assistant', '...');
				}
				
				try {
					// Prepare the messages for the API
					const conversation = conversations.find(c => c.id === currentConversationId);
					
					// Start with a system message if there isn't one
					if (!conversation.messages.some(m => m.role === 'system')) {
						conversation.messages.unshift({
							role: 'system',
							content: 'You are a helpful assistant that specializes in nanoservice development. Be concise and helpful.'
						});
						saveConversations();
					}
					
					let assistantMessage;
					
					// Check if MCP server is selected
					if (settings.mcpServer) {
						// Use MCP client
						const response = await fetch('/chatgpt-interface/mcp-chat-completion', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								serverUrl: settings.mcpServer,
								apiKey: settings.apiKey,
								anthropicApiKey: settings.anthropicApiKey || "",
								model: settings.model,
								messages: conversation.messages.filter(m => m.role !== 'assistant' || m.content.trim() !== '...'),
								useClaudeModel: false
							})
						});
						
						if (!response.ok) {
							const error = await response.json();
							throw new Error(error.message || 'Error with MCP server');
						}
						
						// Check the content type to determine how to process the response
						const contentType = response.headers.get('content-type');
						
						if (contentType && contentType.includes('application/json')) {
							// Handle JSON response
							const data = await response.json();
							// Check for different response formats
							if (data.choices && data.choices.length > 0 && data.choices[0].message) {
								// OpenAI style response
								assistantMessage = data.choices[0].message.content;
							} else {
								// Fallback to other formats
								assistantMessage = data.content || data.message || "No response from MCP server";
							}
						} else {
							// Handle text response
							assistantMessage = await response.text();
						}
					} else {
						// Use OpenAI directly
						const response = await fetch('/chatgpt-interface/chat-completion', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								apiKey: settings.apiKey,
								model: settings.model,
								messages: conversation.messages.filter(m => m.role !== 'assistant' || m.content.trim() !== '...')
							})
						});
						
						if (!response.ok) {
							const error = await response.json();
							throw new Error(error.message || 'Unknown error');
						}
						
						// Check the content type to determine how to process the response
						const contentType = response.headers.get('content-type');
						if (contentType && contentType.includes('application/json')) {
							// Handle JSON response
							const data = await response.json();
							assistantMessage = data.content || data.message || data.choices?.[0]?.message?.content || "No response";
						} else {
							// Handle text response (from OpenAI node)
							assistantMessage = await response.text();
						}
					}
					
					// Replace the loading message with the actual response
					conversation.messages = conversation.messages.filter(m => !(m.role === 'assistant' && (m.content.trim() === '...' || m.content.trim() === '...mcp-loading')));
					conversation.messages.push({ role: 'assistant', content: assistantMessage });
					
					saveConversations();
					renderMessages();
				} catch (error) {
					console.error('Error calling API:', error);
					
					// Remove the loading message
					const conversation = conversations.find(c => c.id === currentConversationId);
					conversation.messages = conversation.messages.filter(m => !(m.role === 'assistant' && (m.content.trim() === '...' || m.content.trim() === '...mcp-loading')));
					
					// Add an error message
					conversation.messages.push({ role: 'assistant', content: \`Error: \${error.message || 'Failed to communicate with API'}\` });
					
					saveConversations();
					renderMessages();
				}
			}
			
			// Event Listeners
			sendBtn.addEventListener('click', () => {
				const content = messageInput.value.trim();
				if (content) {
					sendMessage(content);
					messageInput.value = '';
				}
			});
			
			messageInput.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					sendBtn.click();
				}
			});
			
			newChatBtn.addEventListener('click', () => {
				createNewConversation();
			});
			
			settingsBtn.addEventListener('click', () => {
				settingsModal.classList.remove('hidden');
			});
			
			closeSettingsBtn.addEventListener('click', () => {
				settingsModal.classList.add('hidden');
			});
			
			saveSettingsBtn.addEventListener('click', () => {
				settings.apiKey = apiKeyInput.value;
				settings.model = modelInput.value;
				
				// Save MCP server selection if available
				const mcpServerInput = document.getElementById('mcp-server-input');
				if (mcpServerInput) {
					settings.mcpServer = mcpServerInput.value;
				}
				
				saveSettings();
				modelBadge.textContent = settings.model;
				settingsModal.classList.add('hidden');
			});
			
			// Tab switching
			if (conversationsTab && workflowsTab) {
				conversationsTab.addEventListener('click', () => {
					conversationsTab.classList.add('tab-active');
					workflowsTab.classList.remove('tab-active');
					conversationsContainer.classList.remove('hidden');
					workflowsContainer.classList.add('hidden');
				});
				
				workflowsTab.addEventListener('click', () => {
					workflowsTab.classList.add('tab-active');
					conversationsTab.classList.remove('tab-active');
					workflowsContainer.classList.remove('hidden');
					conversationsContainer.classList.add('hidden');
				});
			}
			
			// Initialize
			loadSettings();
			loadConversations();
			if (workflowsTab) {
				fetchWorkflows();
			}
			<% if (mcpSupport) { %>
			fetchMCPServers();
			<% } %>
			
			// Create a new conversation if none exists
			if (conversations.length === 0) {
				createNewConversation();
			} else {
				// Set the first conversation as active
				setCurrentConversation(conversations[0].id);
			}
		});
	</script>
</body>
</html>`;
	}
} 