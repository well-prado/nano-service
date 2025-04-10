import {
	type INanoServiceResponse,
	NanoService,
	NanoServiceResponse,
} from "@nanoservice-ts/runner";
import { type Context, GlobalError } from "@nanoservice-ts/shared";
import path from "node:path";

const rootDir = path.resolve(__dirname, ".");

type MCPToolSchema = {
  name: string;
  description: string;
  schema: Record<string, any>;
};

type InputType = {
  title?: string;
  tools?: MCPToolSchema[];
  base_path?: string;
};

export default class MCPServerCustomUI extends NanoService<InputType> {
	constructor() {
		super();
		this.inputSchema = {
			type: "object",
			properties: {
				title: { type: "string" },
        tools: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              schema: { type: "object" }
            }
          }
        },
        base_path: { type: "string" }
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
      // Default values
      const title = inputs.title || "MCP Debug Console";
      const tools = inputs.tools || [];
      const base_path = inputs.base_path || "";
      
      console.log("MCPServerCustomUI: Rendering UI with tools:", tools.length ? tools.map(t => t.name).join(", ") : "none");
      
      // Generate the HTML content
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
    select {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 15px;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    
    <div class="card">
      <h3>Available Tools</h3>
      <p>Select a tool to use:</p>
      
      <select id="toolSelector">
        <option value="">-- Select a tool --</option>
        ${tools.map(tool => `<option value="${tool.name}">${tool.name} - ${tool.description}</option>`).join('')}
      </select>
      
      <div id="toolForm"></div>
      
      <button id="executeButton" disabled>Execute Tool</button>
      
      <div class="response">
        <h3>Response</h3>
        <pre id="responseOutput">No response yet</pre>
      </div>
    </div>
  </div>

  <script>
    const toolSelector = document.getElementById('toolSelector');
    const toolForm = document.getElementById('toolForm');
    const executeButton = document.getElementById('executeButton');
    const responseOutput = document.getElementById('responseOutput');
    
    // Tool definitions
    const tools = ${JSON.stringify(tools)};
    
    // Base path for API requests
    const basePath = "${base_path}";
    
    // When a tool is selected, generate the form
    toolSelector.addEventListener('change', function() {
      const selectedTool = toolSelector.value;
      toolForm.innerHTML = '';
      
      if (!selectedTool) {
        executeButton.disabled = true;
        return;
      }
      
      // Find the tool definition
      const tool = tools.find(t => t.name === selectedTool);
      if (!tool) {
        executeButton.disabled = true;
        return;
      }
      
      // Enable execute button
      executeButton.disabled = false;
      
      // Generate form fields from schema
      for (const [paramName, paramDef] of Object.entries(tool.schema)) {
        const fieldId = \`param_\${paramName}\`;
        const fieldLabel = document.createElement('label');
        fieldLabel.setAttribute('for', fieldId);
        fieldLabel.textContent = \`\${paramName} (\${paramDef.type.type}): \${paramDef.description || ''}\`;
        
        let inputElement;
        
        // Create appropriate input based on type
        if (paramDef.type.type === 'string') {
          inputElement = document.createElement('input');
          inputElement.setAttribute('type', 'text');
        } else if (paramDef.type.type === 'number') {
          inputElement = document.createElement('input');
          inputElement.setAttribute('type', 'number');
        } else {
          inputElement = document.createElement('textarea');
          inputElement.setAttribute('placeholder', 'Enter JSON value');
        }
        
        inputElement.setAttribute('id', fieldId);
        inputElement.setAttribute('name', paramName);
        
        toolForm.appendChild(fieldLabel);
        toolForm.appendChild(inputElement);
      }
    });
    
    // Execute button click handler
    executeButton.addEventListener('click', async function() {
      const selectedTool = toolSelector.value;
      const tool = tools.find(t => t.name === selectedTool);
      
      if (!tool) return;
      
      // Collect parameters from form
      const parameters = {};
      for (const paramName of Object.keys(tool.schema)) {
        const fieldId = \`param_\${paramName}\`;
        const inputElement = document.getElementById(fieldId);
        
        if (tool.schema[paramName].type.type === 'number') {
          parameters[paramName] = Number(inputElement.value);
        } else if (tool.schema[paramName].type.type === 'object' || 
                  tool.schema[paramName].type.type === 'array' ||
                  tool.schema[paramName].type.type === 'any') {
          try {
            parameters[paramName] = JSON.parse(inputElement.value);
          } catch (e) {
            parameters[paramName] = inputElement.value;
          }
        } else {
          parameters[paramName] = inputElement.value;
        }
      }
      
      // Execute the tool
      try {
        responseOutput.textContent = 'Executing...';
        
        const response = await fetch(basePath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: selectedTool,
            parameters
          })
        });
        
        const result = await response.json();
        responseOutput.textContent = JSON.stringify(result, null, 2);
      } catch (error) {
        responseOutput.textContent = \`Error: \${error.message}\`;
      }
    });
  </script>
</body>
</html>`;
      
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