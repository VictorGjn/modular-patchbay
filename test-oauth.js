import { discoverOAuth, startOAuthFlow, getToken } from './server/services/mcpOAuth.js';

const NOTION_MCP_URL = 'https://mcp.notion.com/mcp';
const REDIRECT_URI = 'http://localhost:4800/api/mcp/oauth/callback';

async function testOAuthDiscovery() {
  console.log('Testing OAuth discovery for Notion MCP...');
  
  try {
    const metadata = await discoverOAuth(NOTION_MCP_URL);
    console.log('✅ OAuth discovery successful!');
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    return true;
  } catch (error) {
    console.error('❌ OAuth discovery failed:', error.message);
    return false;
  }
}

async function testTokenRetrieval() {
  console.log('\nTesting token retrieval...');
  
  try {
    const token = await getToken(NOTION_MCP_URL);
    console.log('Token result:', token ? 'Found token' : 'No token found');
    return true;
  } catch (error) {
    console.error('❌ Token retrieval failed:', error.message);
    return false;
  }
}

async function testOAuthFlowStart() {
  console.log('\nTesting OAuth flow start (without actually opening browser)...');
  
  try {
    const { authUrl, state } = await startOAuthFlow(NOTION_MCP_URL, REDIRECT_URI);
    console.log('✅ OAuth flow start successful!');
    console.log('Auth URL:', authUrl);
    console.log('State:', state);
    return true;
  } catch (error) {
    console.error('❌ OAuth flow start failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('=== MCP OAuth End-to-End Test ===\n');
  
  const discoveryOk = await testOAuthDiscovery();
  await testTokenRetrieval();
  
  if (discoveryOk) {
    await testOAuthFlowStart();
  }
  
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);