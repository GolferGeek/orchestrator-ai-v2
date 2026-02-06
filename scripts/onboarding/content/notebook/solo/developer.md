# Developer Getting Started

Essential guides for developers building with AI agents.

## Development Setup Guide

# Development Setup Guide

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ or Python 3.9+ installed
- A code editor (VS Code recommended)
- Git installed and configured
- Access to Orchestrator AI platform

## Initial Setup

### Step 1: Verify API Access

1. Log into the Orchestrator AI platform
2. Navigate to Settings > API Keys
3. Generate or copy your API key
4. Store it securely (use environment variables, never commit to git)

### Step 2: Test Your Connection

Create a simple test script:

\`\`\`javascript
// test-connection.js
const axios = require('axios');

async function testConnection() {
  try {
    const response = await axios.get('https://api.orchestratorai.io/health', {
      headers: {
        'Authorization': \`Bearer \${process.env.API_KEY}\`
      }
    });
    console.log('✅ Connection successful!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
\`\`\`

### Step 3: Set Up Your Development Environment

1. Create a project directory
2. Initialize your project (npm init or pip install)
3. Install required dependencies
4. Set up environment variables

## Creating Your First Agent

### Basic Agent Structure

\`\`\`javascript
const agent = {
  name: 'my-first-agent',
  description: 'A simple agent that processes text',
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  // ... configuration
};
\`\`\`

### Testing Your Agent

Always test with sample data first:

1. Start with simple inputs
2. Verify outputs match expectations
3. Test edge cases
4. Add error handling

## Best Practices

- **Version Control**: Always use git
- **Environment Variables**: Never hardcode secrets
- **Error Handling**: Always handle errors gracefully
- **Documentation**: Document your code
- **Testing**: Write tests for your agents

## Next Steps

1. Review the API documentation
2. Create your first test agent
3. Experiment with different models
4. Build your first production agent

## API Reference Quick Start

# API Quick Reference

## Authentication

All API requests require authentication:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Common Endpoints

### Create Agent

\`\`\`
POST /api/agents
Content-Type: application/json

{
  "name": "agent-name",
  "description": "Agent description",
  "model": "gpt-4"
}
\`\`\`

### Run Agent

\`\`\`
POST /api/agents/{id}/run
Content-Type: application/json

{
  "input": "Your input text",
  "options": {}
}
\`\`\`

### Get Agent Status

\`\`\`
GET /api/agents/{id}/status
\`\`\`

## Error Handling

Always check response status:

\`\`\`javascript
if (response.status === 200) {
  // Success
} else {
  // Handle error
  console.error('Error:', response.data);
}
\`\`\`

## Rate Limits

- Free tier: 100 requests/hour
- Pro tier: 1000 requests/hour

## Support

For help, check:
- API Documentation: https://docs.orchestratorai.io
- Community Forum: https://forum.orchestratorai.io
