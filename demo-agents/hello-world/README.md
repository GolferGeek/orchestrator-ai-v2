# Hello World Agent

The simplest possible Orchestrator AI agent - perfect for learning!

## Purpose

This agent demonstrates:
- Basic agent structure
- Simple IO schema
- Context (system prompt) definition
- LLM configuration

## Usage

### Via Web UI

1. Log in to the platform
2. Find "Hello World Agent" in the catalog
3. Start a conversation
4. Try: "Hello! My name is Alice. What can you do?"

### Via API

```bash
curl -X POST http://localhost:6100/agents/hello-world/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "taskId": "test-123",
    "conversationId": "conv-123",
    "content": {
      "name": "Alice",
      "question": "Hello! What can you do?"
    }
  }'
```

## Expected Response

```json
{
  "greeting": "Hello Alice! Nice to meet you!",
  "response": "I'm the Hello World Agent, and I'm here to help you with basic questions and provide friendly greetings. What would you like to know?"
}
```

## Learning Points

1. **IO Schema**: Defines what goes in and comes out
2. **Context**: The agent's "personality" and instructions
3. **LLM Config**: Which model to use (Ollama local model here)
4. **Capabilities**: Tags describing what the agent can do

## Next Steps

- Modify the `context` field to change agent behavior
- Add more fields to the IO schema
- Try different LLM models
- Check out other demo agents for more complex examples

## See Also

- [Build Your First Agent Tutorial](../../docs/tutorials/BUILD_FIRST_AGENT.md)
- [Examples Guide](../../docs/EXAMPLES.md)
