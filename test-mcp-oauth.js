import { mcpManager } from './dist-server/server/mcp/manager.js';

const NOTION_MCP_URL = 'https://mcp.notion.com/mcp';

async function testMcpOAuthConnection() {
  console.log('=== Testing MCP OAuth Connection ===\n');
  
  // Add the Notion MCP server
  console.log('1. Adding Notion MCP server...');
  mcpManager.addServer({
    id: 'notion-oauth-test',
    name: 'Notion MCP (OAuth Test)',
    type: 'streamable-http',
    url: NOTION_MCP_URL,
    command: '',
    args: [],
    env: {},
    autoConnect: false,
  });
  console.log('✅ Server added');
  
  // Try to connect (without token - should fail gracefully)
  console.log('\n2. Testing connection without OAuth token...');
  try {
    const result = await mcpManager.connect('notion-oauth-test');
    console.log('✅ Connection successful:', result);
  } catch (error) {
    console.log('❌ Connection failed (expected):', error.message);
  }
  
  // Check server status
  console.log('\n3. Checking server status...');
  const serverStatus = mcpManager.getHealth('notion-oauth-test');
  console.log('Server status:', serverStatus.status);
  console.log('Last error:', serverStatus.lastError);
  
  // List servers
  console.log('\n4. Listing all servers...');
  const servers = mcpManager.listServers();
  console.log(`Found ${servers.length} servers`);
  servers.forEach(s => {
    console.log(`- ${s.id}: ${s.status}`);
  });
  
  console.log('\n=== Test Complete ===');
  console.log('Note: For successful connection, complete OAuth flow in the UI first.');
}

testMcpOAuthConnection().catch(console.error);