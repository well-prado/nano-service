// Add declaration for glob module
declare module 'glob';

import { glob } from 'glob';
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

type MCPTool = {
  name: string;
  description: string;
  schema: Record<string, any>;
  implementation: string;
};

type GenerateOptions = {
  output: string;
};

// Main function to analyze and generate MCP tools
export async function generateMCPTools(options: GenerateOptions): Promise<void> {
  // 1. Discover all nodes and workflows
  const nodes = await discoverNodes();
  const workflows = await discoverWorkflows();
  
  console.log(`Found ${nodes.length} nodes and ${workflows.length} workflows`);
  
  // 2. Analyze each to extract input/output schema
  const nodeTools = await Promise.all(nodes.map(analyzeNodeForMCP));
  const workflowTools = await Promise.all(workflows.map(analyzeWorkflowForMCP));
  
  // 3. Generate MCP tool definitions
  const tools = [...nodeTools, ...workflowTools].filter(Boolean) as MCPTool[];
  
  // 4. Write to an MCP server workflow file
  const outputFile = options.output || 'auto-mcp-server.json';
  writeMCPServerWorkflow(tools, outputFile);
  
  console.log(`Generated ${tools.length} MCP tools from ${nodes.length} nodes and ${workflows.length} workflows`);
  console.log(`Output written to workflows/json/${outputFile}`);
}

// Helper functions for discovering and analyzing nodes/workflows
async function discoverNodes(): Promise<string[]> {
  // Find all node files in the src/nodes directory
  return glob('src/nodes/**/*.ts', { ignore: ['**/*.test.ts', '**/index.ts', '**/ui.ts'] });
}

async function discoverWorkflows(): Promise<string[]> {
  // Find all workflow JSON files
  return glob('workflows/json/**/*.json', { ignore: ['**/auto-mcp-server.json'] });
}

function getNodeName(nodePath: string): string {
  // Extract node name from file path
  // Example: src/nodes/examples/mongodb-query.ts -> mongodb-query
  const basename = path.basename(nodePath, '.ts');
  return basename.toLowerCase();
}

function extractDescription(sourceFile: ts.SourceFile): string {
  let description = '';
  
  // Try to find a class with JSDoc comments
  ts.forEachChild(sourceFile, node => {
    if (ts.isClassDeclaration(node)) {
      const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
      if (leadingComments && leadingComments.length > 0) {
        const commentText = sourceFile.text.substring(leadingComments[0].pos, leadingComments[0].end);
        description = commentText.replace(/\/\*\*|\*\/|\*/g, '').trim();
      } else if (node.name) {
        // If no comments, use the class name as a fallback
        description = `Tool based on the ${node.name.text} node`;
      }
    }
  });
  
  // If no description found yet, try with the file name
  if (!description) {
    const basename = path.basename(sourceFile.fileName, '.ts');
    description = `Tool based on the ${basename} node`;
  }
  
  return description;
}

function extractInputSchema(sourceFile: ts.SourceFile): Record<string, any> {
  let schema: Record<string, any> = {};
  
  // Try to find the inputSchema property in the constructor
  ts.forEachChild(sourceFile, node => {
    if (ts.isClassDeclaration(node)) {
      node.members.forEach(member => {
        if (ts.isConstructorDeclaration(member)) {
          const constructorBody = member.body;
          if (constructorBody) {
            constructorBody.statements.forEach(statement => {
              if (ts.isExpressionStatement(statement)) {
                const expression = statement.expression;
                if (ts.isBinaryExpression(expression) && 
                    ts.isPropertyAccessExpression(expression.left) &&
                    expression.left.name.text === 'inputSchema') {
                  
                  // Found inputSchema assignment, try to extract the schema
                  if (ts.isObjectLiteralExpression(expression.right)) {
                    schema = extractSchemaFromObject(expression.right);
                  }
                }
              }
            });
          }
        }
      });
    }
  });
  
  // Also look for InputType interface that might define the schema
  let inputTypeDef: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined;
  ts.forEachChild(sourceFile, node => {
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && 
        node.name.text === 'InputType') {
      inputTypeDef = node;
    }
  });
  
  // If we found an InputType, use it to enhance our schema
  if (inputTypeDef) {
    const typeSchema = extractSchemaFromTypeDefinition(inputTypeDef);
    if (Object.keys(typeSchema).length > 0) {
      schema = { ...schema, ...typeSchema };
    }
  }
  
  // If no schema found or schema is empty, create a minimal schema
  if (Object.keys(schema).length === 0) {
    schema = { 
      type: "object",
      properties: {}
    };
  }
  
  return convertToMCPSchema(schema);
}

function extractSchemaFromObject(obj: ts.ObjectLiteralExpression): Record<string, any> {
  const result: Record<string, any> = {};
  
  obj.properties.forEach(prop => {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const propName = prop.name.text;
      
      if (propName === 'type' && ts.isStringLiteral(prop.initializer)) {
        result.type = prop.initializer.text;
      } else if (propName === 'properties' && ts.isObjectLiteralExpression(prop.initializer)) {
        result.properties = {};
        prop.initializer.properties.forEach(innerProp => {
          if (ts.isPropertyAssignment(innerProp) && ts.isIdentifier(innerProp.name)) {
            const innerPropName = innerProp.name.text;
            if (ts.isObjectLiteralExpression(innerProp.initializer)) {
              result.properties[innerPropName] = extractSchemaFromObject(innerProp.initializer);
            }
          }
        });
      } else if (propName === 'required' && ts.isArrayLiteralExpression(prop.initializer)) {
        result.required = [];
        prop.initializer.elements.forEach(element => {
          if (ts.isStringLiteral(element)) {
            result.required.push(element.text);
          }
        });
      }
    }
  });
  
  return result;
}

function extractSchemaFromTypeDefinition(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): Record<string, any> {
  const properties: Record<string, any> = {};
  
  if (ts.isInterfaceDeclaration(node)) {
    node.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const propName = member.name.text;
        properties[propName] = extractTypeFromTypeNode(member.type);
      }
    });
  } else if (ts.isTypeAliasDeclaration(node) && node.type && ts.isTypeLiteralNode(node.type)) {
    node.type.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const propName = member.name.text;
        properties[propName] = extractTypeFromTypeNode(member.type);
      }
    });
  }
  
  return {
    type: "object",
    properties
  };
}

function extractTypeFromTypeNode(typeNode?: ts.TypeNode): any {
  if (!typeNode) return { type: "any" };
  
  // Use type kind to determine type instead of isXXXKeyword functions
  if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
    return { type: "string" };
  } else if (typeNode.kind === ts.SyntaxKind.NumberKeyword) {
    return { type: "number" };
  } else if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
    return { type: "boolean" };
  } else if (ts.isArrayTypeNode(typeNode)) {
    return {
      type: "array",
      items: extractTypeFromTypeNode(typeNode.elementType)
    };
  } else if (ts.isTypeLiteralNode(typeNode)) {
    const properties: Record<string, any> = {};
    typeNode.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const propName = member.name.text;
        properties[propName] = extractTypeFromTypeNode(member.type);
      }
    });
    return {
      type: "object",
      properties
    };
  } else if (ts.isUnionTypeNode(typeNode)) {
    // Handle union types like string | number
    const types = typeNode.types.map(t => extractTypeFromTypeNode(t));
    // For MCP, we'll just use the first type as a simplification
    return types[0];
  }
  
  // Default to 'any' type for types we can't easily convert
  return { type: "any" };
}

function convertToMCPSchema(jsonSchema: Record<string, any>): Record<string, any> {
  const mcpSchema: Record<string, any> = {};
  
  // Convert JSON Schema properties to MCP schema format
  if (jsonSchema.properties) {
    Object.entries(jsonSchema.properties).forEach(([propName, propSchema]) => {
      const schemaObj = propSchema as Record<string, any>;
      
      mcpSchema[propName] = {
        type: { type: schemaObj.type || "string" },
        description: propName
      };
      
      // Add any enums if present
      if (schemaObj.enum) {
        mcpSchema[propName].enum = schemaObj.enum;
      }
    });
  }
  
  return mcpSchema;
}

function generateNodeImplementation(nodeName: string): string {
  // Create an implementation that calls the node through nanoservice
  return `
    // Create a fake context with the input parameters
    const ctx = {
      request: {
        body: inputs,
        method: "POST",
        headers: {},
        query: {},
        params: {}
      },
      response: { data: {} },
      vars: {}
    };
    
    // This is a simplified version - in a real implementation, you would
    // make an HTTP request to the nanoservice endpoint for this node
    // For now, we'll return mock data based on the inputs
    return {
      success: true,
      node: "${nodeName}",
      input_received: inputs,
      result: "This is a mock result. In a real implementation, this would call the ${nodeName} node."
    };
  `;
}

function generateSchemaFromWorkflow(workflow: any): Record<string, any> {
  const schema: Record<string, any> = {};
  
  try {
    // Extract parameters from the HTTP trigger path
    if (workflow.trigger?.http?.path) {
      const pathParams = extractPathParams(workflow.trigger.http.path);
      pathParams.forEach(param => {
        // Mark required params differently than optional ones
        const isRequired = !param.endsWith('?');
        const paramName = isRequired ? param : param.slice(0, -1);
        
        schema[paramName] = {
          type: { type: "string" },
          description: `Path parameter: ${paramName}`
        };
      });
    }
    
    // For a more comprehensive schema, we could also analyze:
    // 1. The input schemas of the nodes used in the workflow
    // 2. The inputs section in the workflow definition
    
    // Add a generic 'body' parameter if this is a POST or PUT endpoint
    if (workflow.trigger?.http?.method === 'POST' || 
        workflow.trigger?.http?.method === 'PUT' || 
        workflow.trigger?.http?.method === '*') {
      schema.body = {
        type: { type: "object" },
        description: "Request body for the workflow"
      };
    }
  } catch (error) {
    console.error(`Error generating schema for workflow:`, error);
  }
  
  return schema;
}

function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const regex = /:([a-zA-Z0-9_]+\??)/g;
  let match;
  
  while (match = regex.exec(path)) {
    params.push(match[1]);
  }
  
  return params;
}

function generateWorkflowImplementation(workflowId: string): string {
  // Create an implementation that runs the workflow
  return `
    // In a real implementation, this would make an HTTP request to execute the workflow
    // For this mock version, we'll construct a response based on the workflow ID and inputs
    const workflowPath = "${workflowId}";
    
    // Prepare parameters from the inputs
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'string') {
        queryParams.append(key, value);
      } else if (value !== null && value !== undefined) {
        queryParams.append(key, JSON.stringify(value));
      }
    }
    
    // This is where we would make the actual HTTP request
    return {
      success: true,
      workflow: workflowPath,
      input_received: inputs,
      result: "This is a mock result. In a real implementation, this would trigger the " + workflowPath + " workflow."
    };
  `;
}

async function analyzeNodeForMCP(nodePath: string): Promise<MCPTool | null> {
  try {
    console.log(`Analyzing node: ${nodePath}`);
    
    // Parse TypeScript to extract input schema and implementation details
    const sourceFile = ts.createSourceFile(
      nodePath,
      fs.readFileSync(nodePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    
    const nodeName = getNodeName(nodePath);
    const description = extractDescription(sourceFile);
    const schema = extractInputSchema(sourceFile);
    const implementation = generateNodeImplementation(nodeName);
    
    // Skip nodes with empty schemas
    if (Object.keys(schema).length === 0) {
      console.log(`Skipping ${nodeName} due to empty schema`);
      return null;
    }
    
    return {
      name: nodeName,
      description,
      schema,
      implementation
    };
  } catch (error) {
    console.error(`Error analyzing node ${nodePath}:`, error);
    return null;
  }
}

async function analyzeWorkflowForMCP(workflowPath: string): Promise<MCPTool | null> {
  try {
    console.log(`Analyzing workflow: ${workflowPath}`);
    
    // Parse workflow JSON to extract its functionality
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    const workflow = JSON.parse(workflowContent);
    
    // Skip workflow if it doesn't have a name or proper trigger
    if (!workflow.name || !workflow.trigger) {
      console.log(`Skipping ${workflowPath} due to missing name or trigger`);
      return null;
    }
    
    const workflowId = path.basename(workflowPath, '.json');
    const toolName = workflow.name.toLowerCase().replace(/\s+/g, '-');
    const schema = generateSchemaFromWorkflow(workflow);
    const implementation = generateWorkflowImplementation(workflowId);
    
    return {
      name: toolName,
      description: workflow.description || `Executes the ${workflow.name} workflow`,
      schema,
      implementation
    };
  } catch (error) {
    console.error(`Error analyzing workflow ${workflowPath}:`, error);
    return null;
  }
}

// Write the final MCP server workflow file
function writeMCPServerWorkflow(tools: MCPTool[], outputFile: string): void {
  const workflowContent = {
    name: "Auto-generated MCP Server",
    description: "MCP server with tools generated from nanoservice nodes and workflows",
    version: "1.0.0",
    trigger: {
      http: {
        method: "*",
        path: "/:mcp_operation?",
        accept: "application/json"
      }
    },
    steps: [
      {
        name: "filter-request",
        node: "@nanoservice-ts/if-else",
        type: "module"
      }
    ],
    nodes: {
      "filter-request": {
        conditions: [
          {
            type: "if",
            steps: [
              {
                name: "mcp-ui",
                node: "mcp-server-ui",
                type: "module"
              }
            ],
            condition: "ctx.request.method.toLowerCase() === \"get\" && !ctx.request.params.mcp_operation"
          },
          {
            type: "if",
            steps: [
              {
                name: "mcp-endpoint",
                node: "mcp-server",
                type: "module"
              }
            ],
            condition: "true"
          }
        ]
      },
      "mcp-endpoint": {
        inputs: {
          debug_mode: true,
          tools
        }
      },
      "mcp-ui": {
        inputs: {
          title: "Nanoservice MCP Dashboard"
        }
      }
    }
  };
  
  // Ensure the directory exists
  const outputPath = path.join('workflows', 'json', outputFile);
  
  fs.writeFileSync(
    outputPath,
    JSON.stringify(workflowContent, null, 2)
  );
} 