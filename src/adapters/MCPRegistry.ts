import { NanoService } from "@nanoservice-ts/runner";
import { NodeToMCPAdapter, MCPTool } from "./NodeToMCPAdapter";

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
   * Get workflow MCP tools
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
   * Get all MCP tools (nodes + workflows)
   */
  static getAllMCPTools(options: {
    excludeNodes?: string[];
    workflowsDir?: string;
    excludeWorkflows?: string[];
  } = {}): MCPTool[] {
    return [
      ...this.getNodeMCPTools({ excludeNodes: options.excludeNodes }),
      ...this.getWorkflowMCPTools({
        workflowsDir: options.workflowsDir,
        excludeWorkflows: options.excludeWorkflows
      })
    ];
  }

  /**
   * Register all nodes from the src/nodes directory
   */
  static async discoverAndRegisterAllNodes(baseDir?: string): Promise<void> {
    const nodes = await NodeToMCPAdapter.discoverNodesFromDirectory(baseDir);
    this.registerNodes(nodes);
  }
} 