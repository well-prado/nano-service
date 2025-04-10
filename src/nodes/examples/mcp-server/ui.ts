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
};

export default class MCPServerUI extends NanoService<InputType> {
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
			// Create index.html on-the-fly if it doesn't exist
			const indexPath = this.root("index.html");
			if (!fs.existsSync(indexPath)) {
				const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title><%= title %></title>
	<style>
		body {
			font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
			margin: 0;
			padding: 20px;
			color: #333;
			background-color: #f9f9f9;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
			background: white;
			border-radius: 8px;
			box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
			padding: 20px;
		}
		h1 {
			color: #333;
			margin-top: 0;
			padding-bottom: 10px;
			border-bottom: 1px solid #eee;
		}
		.card {
			background: #f9f9f9;
			border-radius: 6px;
			padding: 15px;
			margin-bottom: 15px;
			border: 1px solid #eee;
		}
		.hero-card {
			background: linear-gradient(135deg, #4b6cb7, #182848);
			color: white;
			padding: 25px;
			border-radius: 8px;
			margin-bottom: 25px;
		}
		.hero-card h2 {
			margin-top: 0;
			font-size: 1.8em;
		}
		.hero-card p {
			margin-bottom: 0;
			opacity: 0.9;
		}
		.server-url {
			font-family: monospace;
			padding: 10px;
			background: #f0f0f0;
			border-radius: 4px;
			border: 1px solid #ddd;
		}
		.tool-name {
			font-weight: bold;
			margin-bottom: 5px;
		}
		.tool-description {
			color: #666;
			font-size: 0.9em;
			margin-bottom: 10px;
		}
		label {
			display: block;
			margin-bottom: 5px;
			font-weight: bold;
		}
		input, textarea {
			width: 100%;
			padding: 8px;
			border: 1px solid #ddd;
			border-radius: 4px;
			margin-bottom: 15px;
			font-family: inherit;
		}
		textarea {
			height: 100px;
			resize: vertical;
		}
		button {
			background: #0066cc;
			color: white;
			border: none;
			padding: 8px 16px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9em;
		}
		button:hover {
			background: #0052a3;
		}
		pre {
			background: #f0f0f0;
			padding: 10px;
			border-radius: 4px;
			overflow: auto;
			font-size: 0.9em;
		}
		.response {
			margin-top: 20px;
		}
		.tab-container {
			margin: 20px 0;
		}
		.tab-buttons {
			display: flex;
			margin-bottom: 10px;
		}
		.tab-button {
			margin-right: 10px;
			background: #f0f0f0;
			border: 1px solid #ddd;
			padding: 5px 10px;
			cursor: pointer;
			border-radius: 4px;
		}
		.tab-button.active {
			background: #0066cc;
			color: white;
			border-color: #0066cc;
		}
		.tab-content {
			display: none;
		}
		.tab-content.active {
			display: block;
		}
		.badge {
			display: inline-block;
			padding: 3px 8px;
			border-radius: 12px;
			font-size: 0.8em;
			font-weight: bold;
			background-color: #4CAF50;
			color: white;
			margin-left: 8px;
		}
		.endpoint {
			font-family: monospace;
			background: #f0f0f0;
			padding: 5px;
			border-radius: 3px;
		}
		.copy-button {
			background: #ddd;
			color: #333;
			border: none;
			padding: 2px 5px;
			border-radius: 3px;
			cursor: pointer;
			font-size: 0.8em;
			margin-left: 5px;
		}
		.copy-button:hover {
			background: #ccc;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="hero-card">
			<h1><%= title %> <span class="badge">Stateless</span></h1>
			<p>A revolutionary approach to the Model Context Protocol that doesn't require a persistent server</p>
		</div>
		
		<div class="card">
			<h2>About Stateless MCP</h2>
			<p>Traditional MCP implementations require a persistent server, but this stateless version:</p>
			<ul>
				<li>Processes each request independently</li>
				<li>Scales horizontally without connection management</li>
				<li>Uses resources only when processing requests</li>
				<li>Is fully compatible with serverless architectures</li>
			</ul>
		</div>

		<div class="tab-container">
			<div class="tab-buttons">
				<div class="tab-button active" data-tab="debug">Debug Console</div>
				<div class="tab-button" data-tab="docs">Documentation</div>
				<div class="tab-button" data-tab="api">API Reference</div>
			</div>
			
			<div class="tab-content active" id="debug-tab">
				<h2>Debug Console</h2>
				<div>
					<label for="tool-selector">Select Tool:</label>
					<select id="tool-selector"></select>
					
					<div id="tool-params"></div>
					
					<button id="execute-button">Execute Tool</button>
					
					<div class="response">
						<h3>Response:</h3>
						<pre id="response-output">// Response will appear here</pre>
					</div>
				</div>
			</div>
			
			<div class="tab-content" id="docs-tab">
				<h2>Available Tools</h2>
				<div id="tools-list"></div>
				
				<h3>How to use Stateless MCP</h3>
				<p>This implementation follows the Model Context Protocol, allowing AI Assistants to access tools without a persistent server.</p>
				<p>You can call these endpoints directly from any client:</p>
				<ul>
					<li><span class="endpoint">GET /tools</span> - List all available tools</li>
					<li><span class="endpoint">POST /execute</span> - Execute a tool with parameters</li>
				</ul>
			</div>

			<div class="tab-content" id="api-tab">
				<h2>API Reference</h2>
				
				<div class="card">
					<h3>List Tools</h3>
					<p><span class="endpoint">GET /tools</span> <button class="copy-button" data-url="/tools">Copy</button></p>
					<p>Returns a list of all available tools and their schemas.</p>
					<h4>Example Response:</h4>
					<pre>{
  "protocol": "MCP",
  "version": "1.0",
  "type": "stateless",
  "tools": [
    {
      "name": "weather",
      "description": "Get weather information for a city",
      "schema": { ... }
    }
  ]
}</pre>
				</div>
				
				<div class="card">
					<h3>Execute Tool</h3>
					<p><span class="endpoint">POST /execute</span> <button class="copy-button" data-url="/execute">Copy</button></p>
					<p>Executes a tool with the provided parameters.</p>
					<h4>Request Body:</h4>
					<pre>{
  "name": "weather",
  "parameters": {
    "city": "London"
  }
}</pre>
					<h4>Example Response:</h4>
					<pre>{
  "result": {
    "city": "London",
    "temperature": 22,
    "condition": "Sunny",
    "humidity": 45
  }
}</pre>
				</div>
			</div>
		</div>
	</div>

	<script>
		// Sample tools data - will be populated dynamically
		let toolsData = [];
		let selectedTool = null;

		// Fetch tools data
		async function fetchTools() {
			try {
				const response = await fetch('/tools');
				if (response.ok) {
					const data = await response.json();
					toolsData = data.tools || [];
					populateToolSelector();
					populateToolsList();
				}
			} catch (error) {
				console.error('Error fetching tools:', error);
			}
		}

		function populateToolSelector() {
			const selector = document.getElementById('tool-selector');
			selector.innerHTML = '';
			
			toolsData.forEach(tool => {
				const option = document.createElement('option');
				option.value = tool.name;
				option.textContent = tool.name;
				selector.appendChild(option);
			});
			
			if (toolsData.length > 0) {
				selectedTool = toolsData[0];
				updateToolParams();
			}
			
			selector.addEventListener('change', (e) => {
				selectedTool = toolsData.find(t => t.name === e.target.value);
				updateToolParams();
			});
		}
		
		function updateToolParams() {
			const paramsContainer = document.getElementById('tool-params');
			paramsContainer.innerHTML = '';
			
			if (!selectedTool || !selectedTool.schema) return;
			
			Object.entries(selectedTool.schema).forEach(([paramName, paramInfo]) => {
				const label = document.createElement('label');
				label.textContent = paramName + ':';
				label.setAttribute('for', 'param-' + paramName);
				
				const input = document.createElement('input');
				input.id = 'param-' + paramName;
				input.name = paramName;
				input.placeholder = paramInfo.description || paramName;
				
				paramsContainer.appendChild(label);
				paramsContainer.appendChild(input);
			});
		}
		
		function populateToolsList() {
			const toolsList = document.getElementById('tools-list');
			toolsList.innerHTML = '';
			
			toolsData.forEach(tool => {
				const toolCard = document.createElement('div');
				toolCard.className = 'card';
				
				const toolName = document.createElement('div');
				toolName.className = 'tool-name';
				toolName.textContent = tool.name;
				
				const toolDesc = document.createElement('div');
				toolDesc.className = 'tool-description';
				toolDesc.textContent = tool.description;
				
				const toolSchema = document.createElement('pre');
				toolSchema.textContent = JSON.stringify(tool.schema || {}, null, 2);
				
				toolCard.appendChild(toolName);
				toolCard.appendChild(toolDesc);
				toolCard.appendChild(toolSchema);
				toolsList.appendChild(toolCard);
			});
		}
		
		// Execute tool
		document.getElementById('execute-button').addEventListener('click', async () => {
			if (!selectedTool) return;
			
			const params = {};
			const paramInputs = document.querySelectorAll('#tool-params input');
			paramInputs.forEach(input => {
				params[input.name] = input.value;
			});
			
			try {
				const response = await fetch('/execute', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						name: selectedTool.name,
						parameters: params
					})
				});
				
				const result = await response.json();
				document.getElementById('response-output').textContent = JSON.stringify(result, null, 2);
			} catch (error) {
				document.getElementById('response-output').textContent = 'Error: ' + error.message;
			}
		});
		
		// Tab switching
		document.querySelectorAll('.tab-button').forEach(button => {
			button.addEventListener('click', () => {
				// Update active tab button
				document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
				button.classList.add('active');
				
				// Show active tab content
				const tabId = button.dataset.tab;
				document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
				document.getElementById(tabId + '-tab').classList.add('active');
			});
		});

		// Copy URL to clipboard
		document.querySelectorAll('.copy-button').forEach(button => {
			button.addEventListener('click', () => {
				const url = window.location.origin + button.dataset.url;
				navigator.clipboard.writeText(url).then(() => {
					const originalText = button.textContent;
					button.textContent = 'Copied!';
					setTimeout(() => {
						button.textContent = originalText;
					}, 1500);
				});
			});
		});
		
		// Initialize
		fetchTools();
	</script>
</body>
</html>`;
				fs.writeFileSync(indexPath, htmlContent);
			}

			const content = fs.readFileSync(indexPath, "utf8");
			const render = ejs.compile(content, { client: false });
			const html = render({
				title: inputs.title || "Stateless MCP Dashboard"
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