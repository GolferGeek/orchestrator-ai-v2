# RAG Filler Documents

Sample documents for testing and demonstrating RAG (Retrieval-Augmented Generation) agents.

## Collections

| Folder | Purpose | Target Agent |
|--------|---------|--------------|
| `hr-documents/` | HR policies, employee handbook, benefits | HR Policy Assistant |
| `law/` | Legal templates, contracts, memos | Legal Research Assistant |

## Usage

1. Create a RAG collection in the database
2. Upload documents from these folders via the API
3. Register a RAG agent pointing to the collection
4. Query the agent

## Adding New Collections

Create a new folder with:
- Realistic document content (can be AI-generated filler)
- Mix of document types (policies, procedures, templates, memos)
- Consistent naming conventions
- A README explaining the collection's purpose
