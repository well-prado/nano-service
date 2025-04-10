import ExampleNodes from "./nodes/examples";
import { MCPRegistry } from "./adapters/MCPRegistry";

/**
 * Initialize the global node registry with all available nodes
 */
export async function initRegistry() {
  console.log("Initializing global node registry...");
  
  // Register example nodes
  MCPRegistry.registerNodes(ExampleNodes);
  
  // Discover and register all other nodes
  await MCPRegistry.discoverAndRegisterAllNodes();
  
  const nodeCount = Object.keys(MCPRegistry.getRegisteredNodes()).length;
  console.log(`Node registry initialized with ${nodeCount} nodes`);
  
  return MCPRegistry.getRegisteredNodes();
} 