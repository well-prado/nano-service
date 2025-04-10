import { Command } from 'commander';
import { generateMCPTools } from './generate-mcp-tools';

const program = new Command();

program
  .name('nanoservice-tools')
  .description('Utility tools for nanoservice-ts')
  .version('1.0.0');

program
  .command('generate-mcp')
  .description('Generate MCP tools from existing nodes and workflows')
  .option('-o, --output <file>', 'Output workflow file', 'auto-mcp-server.json')
  .action(async (options) => {
    console.log('Generating MCP tools...');
    await generateMCPTools(options);
    console.log('Done!');
  });

program.parse(); 