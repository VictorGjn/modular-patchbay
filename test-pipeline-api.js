/**
 * Test script for the Pipeline API endpoint
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPipelineAPI() {
  const testPayload = {
    sources: [
      {
        path: join(__dirname, 'test-pipeline.md'),
        knowledgeType: 'evidence',
        depth: 1
      }
    ],
    query: 'compare approach A vs approach B',
    tokenBudget: 5000,
    options: {
      contrastiveRetrieval: false,
      provenance: true
    }
  };

  try {
    console.log('Testing Pipeline API...');
    console.log('Request payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch('http://localhost:4800/api/pipeline/assemble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('\n=== Pipeline API Response ===');
    console.log('Status:', result.status);
    console.log('Stats:', result.data?.stats);
    console.log('System Prompt Length:', result.data?.systemPrompt?.length || 0);
    console.log('Provenance Sources:', result.data?.provenance?.sources?.length || 0);
    
    if (result.data?.systemPrompt) {
      console.log('\n=== System Prompt Preview ===');
      console.log(result.data.systemPrompt.slice(0, 500) + '...');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Only run if this file is executed directly
if (process.argv[1] === __filename) {
  testPipelineAPI();
}

export { testPipelineAPI };