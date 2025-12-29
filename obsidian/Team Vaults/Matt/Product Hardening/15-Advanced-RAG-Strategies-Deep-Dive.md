# Advanced RAG Strategies - Deep Dive

## High-Level Understanding Document

**Date:** 2025-01-27
**Purpose:** Provide a clear, accessible explanation of each advanced RAG strategy, what it does, and how we implement it in Orchestrator AI.

---

## Overview

RAG (Retrieval-Augmented Generation) enhances LLM responses by retrieving relevant context from a knowledge base before generating answers. **Advanced RAG** goes beyond basic "retrieve and respond" to dramatically improve accuracy, relevance, and user experience.

**Basic RAG Flow:**
```
User Query → Embed Query → Vector Search → Top-K Chunks → LLM + Context → Response
```

**Advanced RAG** adds layers of intelligence to each step of this flow.

---

## Strategy 1: Parent Document RAG

### What It Does
When a search matches a small chunk, retrieve the **full parent document** instead of just the chunk. This gives the LLM more complete context.

### Why It Matters
Small chunks (500 tokens) match well but lack context. Full documents (5000+ tokens) provide complete context but match poorly. Parent Document RAG gets the best of both.

### How It Works
```
User Query: "What are the quarterly sales targets?"

Standard RAG:
→ Returns: "...targets are $2M for Q1..." (chunk - missing context)

Parent Document RAG:
→ Matches chunk: "...targets are $2M for Q1..."
→ Retrieves parent: Full sales strategy document including targets,
  methodology, historical context, team responsibilities
→ LLM gets complete picture
```

### Implementation Pseudocode
```typescript
// 1. Store parent document reference with each chunk
interface Chunk {
  id: string;
  content: string;
  embedding: number[];
  parentDocumentId: string;  // ← Key addition
  chunkIndex: number;
}

// 2. During ingestion
async function ingestDocument(document: Document) {
  const parentId = generateId();

  // Store full document
  await storeParentDocument(parentId, document.fullContent);

  // Create and store chunks with parent reference
  const chunks = splitIntoChunks(document.content, 500);
  for (const [index, chunk] of chunks.entries()) {
    await storeChunk({
      content: chunk,
      embedding: await embed(chunk),
      parentDocumentId: parentId,
      chunkIndex: index
    });
  }
}

// 3. During retrieval
async function parentDocumentSearch(query: string, topK: number) {
  // Search chunks as usual
  const matchedChunks = await vectorSearch(query, topK * 2);

  // Get unique parent documents
  const parentIds = [...new Set(matchedChunks.map(c => c.parentDocumentId))];

  // Retrieve full parent documents
  const parentDocs = await getParentDocuments(parentIds.slice(0, topK));

  return parentDocs;
}
```

### When to Use
- Documents with interconnected sections (policies, procedures, manuals)
- When context around a match is critical
- Long-form content where partial retrieval loses meaning

---

## Strategy 2: Multi-Query RAG

### What It Does
Generate **multiple query variations** from the user's original query, search with each, then merge results. This captures different phrasings and perspectives.

### Why It Matters
Users often phrase queries in ways that don't match how information is stored. Multi-Query expands coverage.

### How It Works
```
User Query: "How do I reset my password?"

Generated Variations:
1. "password reset procedure"
2. "forgot password recovery steps"
3. "change account password instructions"
4. "credential reset process"

→ Search with ALL variations
→ Merge and deduplicate results
→ Return comprehensive context
```

### Implementation Pseudocode
```typescript
async function multiQuerySearch(originalQuery: string, topK: number) {
  // 1. Generate query variations using LLM
  const variations = await generateQueryVariations(originalQuery, 4);
  // Returns: ["password reset procedure", "forgot password recovery", ...]

  // 2. Search with each variation in parallel
  const allResults = await Promise.all(
    [originalQuery, ...variations].map(query =>
      vectorSearch(query, topK)
    )
  );

  // 3. Merge and deduplicate
  const merged = mergeResults(allResults.flat());

  // 4. Re-rank by frequency + relevance score
  const ranked = rankByFrequencyAndScore(merged);

  return ranked.slice(0, topK);
}

async function generateQueryVariations(query: string, count: number) {
  const prompt = `Generate ${count} alternative phrasings for this query
  that might retrieve relevant information from a knowledge base:

  Original: "${query}"

  Return only the variations, one per line.`;

  const response = await llm.complete(prompt);
  return response.split('\n').filter(Boolean);
}
```

### When to Use
- Diverse knowledge bases with varied terminology
- When users might phrase things differently than documentation
- Technical content with multiple jargon terms for same concepts

---

## Strategy 3: Query Expansion RAG

### What It Does
Expand the query with **related terms, synonyms, and contextual keywords** before searching. Similar to Multi-Query but focuses on term expansion rather than rephrasing.

### Why It Matters
Bridges vocabulary gaps between user queries and stored content.

### How It Works
```
User Query: "laptop battery issues"

Expanded Query: "laptop battery issues problems power charging
  drain life cells lithium replacement troubleshoot"

→ Single search with expanded terms
→ Broader semantic matching
```

### Implementation Pseudocode
```typescript
async function queryExpansionSearch(query: string, topK: number) {
  // 1. Extract key terms
  const keyTerms = extractKeyTerms(query);
  // Returns: ["laptop", "battery", "issues"]

  // 2. Expand each term with synonyms/related terms
  const expansions = await expandTerms(keyTerms);
  // Returns: {
  //   "laptop": ["notebook", "computer", "device"],
  //   "battery": ["power", "charging", "cells", "lithium"],
  //   "issues": ["problems", "errors", "failures", "troubleshoot"]
  // }

  // 3. Build expanded query
  const expandedQuery = buildExpandedQuery(query, expansions);
  // "laptop notebook battery power charging issues problems troubleshoot"

  // 4. Create combined embedding
  const embedding = await embed(expandedQuery);

  // 5. Search with expanded embedding
  return vectorSearch(embedding, topK);
}

async function expandTerms(terms: string[]) {
  const expansions = {};

  for (const term of terms) {
    // Option 1: Use LLM for contextual expansion
    const related = await llm.complete(
      `List 3-5 synonyms or related terms for "${term}" in a technical context.`
    );

    // Option 2: Use a thesaurus/knowledge base
    // const related = await lookupSynonyms(term);

    expansions[term] = related.split(',').map(t => t.trim());
  }

  return expansions;
}
```

### When to Use
- Domain-specific content with specialized vocabulary
- Multi-language or jargon-heavy content
- When search recall is more important than precision

---

## Strategy 4: Hybrid Search RAG

### What It Does
Combines **vector (semantic) search** with **keyword (BM25) search** for comprehensive retrieval. Gets both exact matches AND semantically similar content.

### Why It Matters
Vector search misses exact keyword matches; keyword search misses semantic similarity. Hybrid catches both.

### How It Works
```
User Query: "Error code E-4521 troubleshooting"

Vector Search Results:
→ "Troubleshooting common system errors..."
→ "Error diagnosis procedures..."

Keyword (BM25) Search Results:
→ "E-4521: Memory allocation failure. Steps to resolve..."
→ "Error code reference: E-4521 indicates..."

Hybrid Result (merged + ranked):
→ Combines exact match for "E-4521" WITH semantic troubleshooting content
```

### Implementation Pseudocode
```typescript
interface HybridSearchOptions {
  query: string;
  collectionId: string;
  keywordWeight: number;  // 0.0 to 1.0 (default: 0.5)
  semanticWeight: number; // 0.0 to 1.0 (default: 0.5)
  topK: number;
}

async function hybridSearch(options: HybridSearchOptions) {
  const { query, collectionId, keywordWeight, semanticWeight, topK } = options;

  // 1. Perform both searches in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, collectionId, topK * 2),
    bm25Search(query, collectionId, topK * 2)
  ]);

  // 2. Normalize scores (0-1 range)
  const normalizedVector = normalizeScores(vectorResults);
  const normalizedKeyword = normalizeScores(keywordResults);

  // 3. Combine results with weighted scoring
  const combined = {};

  for (const result of normalizedVector) {
    combined[result.id] = {
      ...result,
      hybridScore: result.score * semanticWeight
    };
  }

  for (const result of normalizedKeyword) {
    if (combined[result.id]) {
      combined[result.id].hybridScore += result.score * keywordWeight;
    } else {
      combined[result.id] = {
        ...result,
        hybridScore: result.score * keywordWeight
      };
    }
  }

  // 4. Sort by hybrid score and return top-K
  return Object.values(combined)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, topK);
}

// BM25 implementation (keyword search)
async function bm25Search(query: string, collectionId: string, topK: number) {
  // Use PostgreSQL full-text search or dedicated BM25 implementation
  const tokens = tokenize(query);

  return db.query(`
    SELECT id, content,
           ts_rank(to_tsvector('english', content), plainto_tsquery($1)) as score
    FROM chunks
    WHERE collection_id = $2
      AND to_tsvector('english', content) @@ plainto_tsquery($1)
    ORDER BY score DESC
    LIMIT $3
  `, [tokens.join(' & '), collectionId, topK]);
}
```

### When to Use
- Content with specific codes, IDs, or technical identifiers
- Legal/medical documents with precise terminology
- Any scenario where both exact matches and semantic relevance matter

---

## Strategy 5: Self-RAG (Self-Reflective RAG)

### What It Does
The LLM **evaluates retrieved context** and decides if it's sufficient. If not, it refines the query and retrieves again. Self-correcting retrieval loop.

### Why It Matters
First retrieval isn't always best. Self-RAG iteratively improves until the LLM is confident it has what it needs.

### How It Works
```
User Query: "How to configure SSO?"

Iteration 1:
→ Retrieve: Generic authentication docs
→ LLM Evaluation: "Context doesn't mention SSO configuration. Need more specific info."
→ Refined Query: "SSO SAML configuration steps enterprise"

Iteration 2:
→ Retrieve: SSO implementation guide
→ LLM Evaluation: "Sufficient context. Proceeding with answer."
→ Generate Response
```

### Implementation Pseudocode
```typescript
async function selfRAGSearch(query: string, maxIterations: number = 3) {
  let currentQuery = query;
  let iteration = 0;
  let context = [];

  while (iteration < maxIterations) {
    // 1. Retrieve context
    const retrieved = await vectorSearch(currentQuery, 5);
    context = [...context, ...retrieved];

    // 2. LLM evaluates if context is sufficient
    const evaluation = await evaluateContext(query, context);

    if (evaluation.isSufficient) {
      // 3a. Context is good - proceed to generate
      return {
        context: deduplicateContext(context),
        iterations: iteration + 1,
        finalQuery: currentQuery
      };
    }

    // 3b. Context insufficient - refine query
    currentQuery = evaluation.refinedQuery;
    iteration++;
  }

  // Max iterations reached - use best available context
  return {
    context: deduplicateContext(context),
    iterations: maxIterations,
    finalQuery: currentQuery
  };
}

async function evaluateContext(originalQuery: string, context: Chunk[]) {
  const contextText = context.map(c => c.content).join('\n\n');

  const prompt = `
  Original Question: "${originalQuery}"

  Retrieved Context:
  ${contextText}

  Evaluate:
  1. Does this context contain enough information to answer the question?
  2. If NO, what specific information is missing?
  3. Suggest a refined query to find the missing information.

  Respond in JSON:
  {
    "isSufficient": boolean,
    "missingInfo": "string or null",
    "refinedQuery": "string or null"
  }`;

  const response = await llm.complete(prompt);
  return JSON.parse(response);
}
```

### When to Use
- Complex questions requiring specific information
- Large knowledge bases where first retrieval may miss target
- High-stakes scenarios where answer quality is critical

---

## Strategy 6: Corrective RAG (C-RAG)

### What It Does
Detects when retrieval **fails or returns low-quality results**, then takes corrective action: refines query, tries different search strategies, or falls back to web search.

### Why It Matters
Handles retrieval failures gracefully instead of generating hallucinated responses from poor context.

### How It Works
```
User Query: "Latest tax law changes 2024"

Initial Retrieval:
→ Low confidence results (outdated 2022 tax docs)
→ C-RAG Detection: "Results are outdated/irrelevant"

Corrective Actions:
1. Try alternative query: "tax legislation updates recent"
2. If still failing: Fall back to web search
3. Combine best available context
4. Flag response as potentially incomplete
```

### Implementation Pseudocode
```typescript
async function correctiveRAG(query: string, topK: number) {
  // 1. Initial retrieval
  const initialResults = await vectorSearch(query, topK);

  // 2. Evaluate retrieval quality
  const quality = await evaluateRetrievalQuality(query, initialResults);

  if (quality.isGood) {
    return { results: initialResults, corrected: false };
  }

  // 3. Retrieval failed - apply corrective actions
  const corrections = [];

  // 3a. Try refined query
  if (quality.suggestedQuery) {
    const refined = await vectorSearch(quality.suggestedQuery, topK);
    corrections.push(...refined);
  }

  // 3b. Try different search strategy
  const hybridResults = await hybridSearch({
    query,
    keywordWeight: 0.7,  // Emphasize keywords
    semanticWeight: 0.3,
    topK
  });
  corrections.push(...hybridResults);

  // 3c. Fallback to web search if enabled
  if (quality.shouldUseWebSearch) {
    const webResults = await webSearch(query);
    corrections.push(...webResults);
  }

  // 4. Merge and re-rank all results
  const merged = mergeAndRank([...initialResults, ...corrections]);

  return {
    results: merged.slice(0, topK),
    corrected: true,
    corrections: quality.issues
  };
}

async function evaluateRetrievalQuality(query: string, results: Chunk[]) {
  // Check various quality signals
  const scores = results.map(r => r.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Low scores indicate poor match
  if (avgScore < 0.5) {
    return {
      isGood: false,
      issues: ['Low relevance scores'],
      suggestedQuery: await generateAlternativeQuery(query),
      shouldUseWebSearch: avgScore < 0.3
    };
  }

  // Use LLM to verify relevance
  const relevanceCheck = await llm.complete(`
    Query: "${query}"
    Top Result: "${results[0].content.slice(0, 500)}"

    Is this result relevant to the query? Answer YES or NO with brief reason.
  `);

  if (relevanceCheck.startsWith('NO')) {
    return {
      isGood: false,
      issues: ['Content not relevant to query'],
      suggestedQuery: await generateAlternativeQuery(query),
      shouldUseWebSearch: true
    };
  }

  return { isGood: true };
}
```

### When to Use
- Mission-critical applications where bad retrieval is worse than no retrieval
- Knowledge bases that may have gaps
- Applications with web search fallback capability

---

## Strategy 7: Adaptive RAG

### What It Does
**Routes queries based on complexity**: Simple questions skip RAG entirely (direct LLM answer), complex questions use full RAG pipeline.

### Why It Matters
Not every question needs RAG. "What is 2+2?" doesn't need document retrieval. Adaptive RAG optimizes latency and cost.

### How It Works
```
Query Classification:

Simple Queries (No RAG):
→ "What is the capital of France?" → Direct LLM answer
→ "Calculate 15% of 200" → Direct LLM answer

Complex Queries (Full RAG):
→ "What is our company's vacation policy?" → RAG retrieval
→ "Explain the authentication flow for SSO" → RAG retrieval

Ambiguous Queries (Hybrid):
→ "How does caching work?" → Check if org-specific, then decide
```

### Implementation Pseudocode
```typescript
type QueryComplexity = 'simple' | 'complex' | 'ambiguous';

async function adaptiveRAG(query: string, context?: ConversationContext) {
  // 1. Classify query complexity
  const complexity = await classifyQueryComplexity(query, context);

  switch (complexity) {
    case 'simple':
      // Direct LLM answer - no retrieval needed
      return {
        response: await llm.complete(query),
        usedRAG: false,
        classification: 'simple'
      };

    case 'complex':
      // Full RAG pipeline
      const ragContext = await vectorSearch(query, 5);
      return {
        response: await llm.complete(query, { context: ragContext }),
        usedRAG: true,
        classification: 'complex'
      };

    case 'ambiguous':
      // Quick check if RAG would help
      const quickResults = await vectorSearch(query, 2);
      if (quickResults[0]?.score > 0.7) {
        // Good match found - use RAG
        const fullResults = await vectorSearch(query, 5);
        return {
          response: await llm.complete(query, { context: fullResults }),
          usedRAG: true,
          classification: 'ambiguous->complex'
        };
      }
      // No good match - direct answer
      return {
        response: await llm.complete(query),
        usedRAG: false,
        classification: 'ambiguous->simple'
      };
  }
}

async function classifyQueryComplexity(
  query: string,
  context?: ConversationContext
): Promise<QueryComplexity> {
  // Rule-based classification
  const simplePatterns = [
    /^what is \d+ [\+\-\*\/] \d+/i,          // Math
    /^(who|what|when|where) (is|are|was|were) the/i,  // Basic facts
    /^define /i,                              // Definitions
    /^translate /i                            // Translations
  ];

  if (simplePatterns.some(p => p.test(query))) {
    return 'simple';
  }

  // Organization-specific indicators
  const orgSpecificPatterns = [
    /\b(our|we|company|policy|procedure|internal)\b/i,
    /\b(employee|customer|product|service)\b/i
  ];

  if (orgSpecificPatterns.some(p => p.test(query))) {
    return 'complex';
  }

  // Use LLM for ambiguous cases
  const classification = await llm.complete(`
    Classify this query:
    "${query}"

    - SIMPLE: General knowledge, math, definitions (no retrieval needed)
    - COMPLEX: Requires organization-specific or domain knowledge
    - AMBIGUOUS: Could go either way

    Reply with just one word: SIMPLE, COMPLEX, or AMBIGUOUS
  `);

  return classification.toLowerCase().trim() as QueryComplexity;
}
```

### When to Use
- High-volume applications where latency and cost matter
- Mixed query types (some general, some domain-specific)
- When you want to optimize LLM token usage

---

## Strategy 8: Agentic RAG

### What It Does
The LLM becomes an **agent that decides what to retrieve, when, and how**. It reasons about information needs and makes retrieval calls as tools.

### Why It Matters
For complex questions requiring multiple pieces of information from different sources, Agentic RAG orchestrates retrieval intelligently.

### How It Works
```
User Query: "Compare our Q3 sales to Q3 last year and explain the difference"

Agent Reasoning:
1. "I need Q3 2024 sales data" → Tool: retrieve_sales(period="Q3 2024")
2. "I need Q3 2023 sales data" → Tool: retrieve_sales(period="Q3 2023")
3. "I need context on market conditions" → Tool: search_knowledge_base("market conditions 2024")
4. "Now I can compare and explain"
→ Generate comprehensive response
```

### Implementation Pseudocode
```typescript
// Define retrieval tools available to the agent
const retrievalTools = {
  search_knowledge_base: {
    description: "Search the company knowledge base for relevant information",
    parameters: { query: "string", topK: "number" },
    execute: async (params) => vectorSearch(params.query, params.topK)
  },
  get_document: {
    description: "Retrieve a specific document by ID or title",
    parameters: { identifier: "string" },
    execute: async (params) => getDocumentByIdentifier(params.identifier)
  },
  search_by_date_range: {
    description: "Search for documents within a date range",
    parameters: { query: "string", startDate: "string", endDate: "string" },
    execute: async (params) => searchWithDateFilter(params)
  }
};

async function agenticRAG(query: string, maxSteps: number = 5) {
  const messages = [
    {
      role: 'system',
      content: `You are a research agent. Use the available tools to gather
      information needed to answer the user's question. Think step by step
      about what information you need, retrieve it, then synthesize an answer.

      Available tools: ${JSON.stringify(Object.keys(retrievalTools))}`
    },
    { role: 'user', content: query }
  ];

  let gatheredContext = [];
  let step = 0;

  while (step < maxSteps) {
    // 1. Agent decides next action
    const response = await llm.chat(messages, {
      tools: retrievalTools,
      tool_choice: 'auto'
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      // Agent is done gathering - ready to answer
      break;
    }

    // 2. Execute tool calls
    for (const toolCall of response.toolCalls) {
      const tool = retrievalTools[toolCall.name];
      const result = await tool.execute(toolCall.parameters);

      gatheredContext.push({
        tool: toolCall.name,
        query: toolCall.parameters,
        result
      });

      // Add result to conversation
      messages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    step++;
  }

  // 3. Generate final answer with all gathered context
  messages.push({
    role: 'user',
    content: 'Based on the information gathered, provide a comprehensive answer.'
  });

  const finalResponse = await llm.chat(messages);

  return {
    response: finalResponse.content,
    reasoning: gatheredContext,
    steps: step
  };
}
```

### When to Use
- Complex multi-part questions
- Questions requiring information synthesis from multiple sources
- Research-style queries
- When LLM reasoning about retrieval improves results

---

## Strategy 9: Multi-Step RAG

### What It Does
**Iterative retrieval** where each step builds on previous results. The query evolves based on what was found.

### Why It Matters
Some questions can't be answered in one retrieval step. Multi-Step progressively narrows down to the answer.

### How It Works
```
User Query: "What training is required for the new compliance system?"

Step 1: "compliance system" → Finds: New system is called "ComplianceHub"
Step 2: "ComplianceHub training requirements" → Finds: 3 courses required
Step 3: "ComplianceHub course 1 details" → Finds: Course content
Step 4: Synthesize complete answer from all steps
```

### Implementation Pseudocode
```typescript
async function multiStepRAG(
  query: string,
  maxSteps: number = 4,
  topK: number = 3
) {
  const steps = [];
  let currentQuery = query;
  let accumulatedContext = [];

  for (let step = 0; step < maxSteps; step++) {
    // 1. Retrieve for current query
    const results = await vectorSearch(currentQuery, topK);
    accumulatedContext.push(...results);

    steps.push({
      query: currentQuery,
      results: results.map(r => r.content.slice(0, 200))
    });

    // 2. Check if we have enough to answer
    const assessment = await assessCompleteness(query, accumulatedContext);

    if (assessment.isComplete) {
      break;
    }

    // 3. Generate follow-up query based on what we learned
    currentQuery = await generateFollowUpQuery(
      query,
      accumulatedContext,
      assessment.missingInfo
    );
  }

  // 4. Generate answer from accumulated context
  const response = await generateAnswer(query, accumulatedContext);

  return {
    response,
    steps,
    totalChunks: accumulatedContext.length
  };
}

async function assessCompleteness(originalQuery: string, context: Chunk[]) {
  const contextSummary = summarizeContext(context);

  const assessment = await llm.complete(`
    Original Question: "${originalQuery}"

    Information Gathered So Far:
    ${contextSummary}

    Assessment:
    1. Can this question be fully answered with the current information?
    2. If not, what specific information is still missing?

    Respond in JSON:
    {
      "isComplete": boolean,
      "missingInfo": "string or null",
      "confidence": number (0-1)
    }
  `);

  return JSON.parse(assessment);
}

async function generateFollowUpQuery(
  originalQuery: string,
  context: Chunk[],
  missingInfo: string
) {
  const prompt = `
    Original Question: "${originalQuery}"
    Missing Information: "${missingInfo}"

    Generate a focused search query to find the missing information.
    Keep it concise and specific.
  `;

  return await llm.complete(prompt);
}
```

### When to Use
- Complex research questions
- Questions requiring information chains (A leads to B leads to C)
- When initial retrieval only partially answers the question

---

## Strategy 10: Contextual Compression RAG

### What It Does
**Compresses retrieved chunks** to extract only the relevant portions, reducing noise and fitting more information in the context window.

### Why It Matters
Retrieved chunks often contain irrelevant text. Compression extracts just what's needed, allowing more sources in context.

### How It Works
```
Retrieved Chunk (500 tokens):
"Chapter 5: System Administration. This chapter covers various aspects
of system administration including user management, security policies,
and backup procedures. Section 5.3: Password Policies. The minimum
password length is 12 characters. Passwords must contain uppercase,
lowercase, numbers, and symbols. Passwords expire every 90 days..."

User Query: "What is the minimum password length?"

Compressed Result (30 tokens):
"The minimum password length is 12 characters."

→ 10x reduction, same answer quality
```

### Implementation Pseudocode
```typescript
async function contextualCompressionRAG(query: string, topK: number = 5) {
  // 1. Retrieve more chunks than needed (we'll compress them)
  const candidates = await vectorSearch(query, topK * 3);

  // 2. Compress each chunk to extract relevant portions
  const compressed = await Promise.all(
    candidates.map(chunk => compressChunk(chunk, query))
  );

  // 3. Filter out chunks that compressed to nothing
  const relevant = compressed.filter(c => c.compressedContent.length > 0);

  // 4. Re-rank by relevance of compressed content
  const reranked = await rerankCompressed(relevant, query);

  // 5. Return top-K compressed chunks
  return reranked.slice(0, topK);
}

async function compressChunk(chunk: Chunk, query: string) {
  const prompt = `
    Question: "${query}"

    Document:
    ${chunk.content}

    Extract ONLY the sentences that are directly relevant to answering
    the question. If nothing is relevant, respond with "NO_RELEVANT_CONTENT".

    Relevant excerpts:
  `;

  const compressed = await llm.complete(prompt);

  return {
    ...chunk,
    originalContent: chunk.content,
    compressedContent: compressed === 'NO_RELEVANT_CONTENT' ? '' : compressed,
    compressionRatio: compressed.length / chunk.content.length
  };
}

// Alternative: Use a dedicated compression model
async function compressWithCrossEncoder(chunk: Chunk, query: string) {
  // Split chunk into sentences
  const sentences = chunk.content.split(/[.!?]+/).filter(Boolean);

  // Score each sentence's relevance to query
  const scores = await crossEncoderScore(query, sentences);

  // Keep only sentences above relevance threshold
  const threshold = 0.5;
  const relevantSentences = sentences.filter((_, i) => scores[i] > threshold);

  return {
    ...chunk,
    compressedContent: relevantSentences.join('. ')
  };
}
```

### When to Use
- Large chunks with mixed relevance
- Token-constrained contexts (smaller models)
- When you want to include more sources without hitting token limits

---

## Strategy 11: Ensemble RAG

### What It Does
Runs **multiple retrieval strategies in parallel** and combines their results. Different strategies catch different types of matches.

### Why It Matters
No single strategy is best for all queries. Ensemble combines strengths of multiple approaches.

### How It Works
```
User Query: "E-4521 troubleshooting steps"

Strategy 1 (Vector Search):
→ "General troubleshooting procedures..."

Strategy 2 (BM25 Keyword):
→ "E-4521: Specific error resolution..."

Strategy 3 (Multi-Query):
→ "Error handling and recovery..."

Ensemble (Reciprocal Rank Fusion):
→ Combines and ranks all results
→ Returns best from each strategy
```

### Implementation Pseudocode
```typescript
interface EnsembleStrategy {
  name: string;
  weight: number;
  search: (query: string, topK: number) => Promise<Chunk[]>;
}

async function ensembleRAG(query: string, topK: number = 5) {
  // 1. Define strategies and their weights
  const strategies: EnsembleStrategy[] = [
    {
      name: 'vector',
      weight: 0.4,
      search: (q, k) => vectorSearch(q, k)
    },
    {
      name: 'bm25',
      weight: 0.3,
      search: (q, k) => bm25Search(q, k)
    },
    {
      name: 'multiQuery',
      weight: 0.3,
      search: (q, k) => multiQuerySearch(q, k)
    }
  ];

  // 2. Run all strategies in parallel
  const allResults = await Promise.all(
    strategies.map(async strategy => ({
      name: strategy.name,
      weight: strategy.weight,
      results: await strategy.search(query, topK * 2)
    }))
  );

  // 3. Combine using Reciprocal Rank Fusion (RRF)
  const rrfScores = {};
  const k = 60; // RRF constant

  for (const { name, weight, results } of allResults) {
    results.forEach((chunk, rank) => {
      if (!rrfScores[chunk.id]) {
        rrfScores[chunk.id] = { chunk, score: 0, sources: [] };
      }

      // RRF formula: 1 / (k + rank)
      rrfScores[chunk.id].score += weight * (1 / (k + rank + 1));
      rrfScores[chunk.id].sources.push(name);
    });
  }

  // 4. Sort by combined score and return top-K
  const ranked = Object.values(rrfScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked.map(r => ({
    ...r.chunk,
    ensembleScore: r.score,
    foundBy: r.sources
  }));
}
```

### When to Use
- Diverse query types where no single strategy dominates
- When you want robust retrieval across different scenarios
- High-stakes applications where missing relevant content is costly

---

## Strategy 12: Reranking Pipeline

### What It Does
After initial retrieval, uses a **cross-encoder model** to rerank results based on actual query-document relevance (not just embedding similarity).

### Why It Matters
Bi-encoder embeddings are fast but imprecise. Cross-encoders are slow but highly accurate. Reranking gets the best of both.

### How It Works
```
Initial Retrieval (Bi-encoder, fast):
1. "Password reset procedure for employees" (score: 0.85)
2. "Password policy requirements" (score: 0.83)
3. "Account recovery steps" (score: 0.82)
4. "Security best practices" (score: 0.80)
5. "Employee onboarding guide" (score: 0.79)

Query: "How do I reset my password?"

Reranking (Cross-encoder, accurate):
1. "Password reset procedure for employees" → 0.95 (stays #1)
2. "Account recovery steps" → 0.88 (moves up)
3. "Password policy requirements" → 0.72 (moves down)
4. "Security best practices" → 0.45 (much lower)
5. "Employee onboarding guide" → 0.23 (irrelevant)
```

### Implementation Pseudocode
```typescript
interface RerankingOptions {
  query: string;
  candidates: Chunk[];
  model: string;  // e.g., 'cross-encoder/ms-marco-MiniLM-L-6-v2'
  topK: number;
}

async function rerankingPipeline(options: RerankingOptions) {
  const { query, candidates, model, topK } = options;

  // 1. Score each candidate with cross-encoder
  const scored = await Promise.all(
    candidates.map(async (chunk) => ({
      ...chunk,
      rerankScore: await crossEncoderScore(query, chunk.content, model)
    }))
  );

  // 2. Sort by rerank score
  const reranked = scored.sort((a, b) => b.rerankScore - a.rerankScore);

  // 3. Return top-K
  return reranked.slice(0, topK);
}

// Cross-encoder scoring (using Ollama or external API)
async function crossEncoderScore(
  query: string,
  document: string,
  model: string
): Promise<number> {
  // Option 1: Use Ollama with a reranking model
  const response = await ollama.embeddings({
    model: model,
    prompt: `Query: ${query}\nDocument: ${document}\nRelevance:`
  });

  // Option 2: Use external reranking API (Cohere, Voyage, etc.)
  // const response = await cohereRerank(query, [document]);

  return response.score;
}

// Full retrieval + reranking pipeline
async function retrieveAndRerank(query: string, topK: number = 5) {
  // 1. Initial retrieval (get 3x candidates)
  const candidates = await vectorSearch(query, topK * 3);

  // 2. Rerank candidates
  const reranked = await rerankingPipeline({
    query,
    candidates,
    model: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
    topK
  });

  return reranked;
}
```

### When to Use
- When initial retrieval quality is inconsistent
- High-precision requirements (legal, medical, financial)
- When you can afford the latency of cross-encoder scoring

---

## Implementation Summary

### Current State (Orchestrator AI)
- ✅ Basic RAG with pgvector
- ✅ MMR (Maximal Marginal Relevance)
- ⚠️ Reranking (falls back to basic search)
- ❌ Other advanced strategies not implemented

### Implementation Priority

**Phase 1 (Core Patterns):**
1. Hybrid Search - Combine vector + keyword
2. Reranking Pipeline - Cross-encoder reranking
3. Query Expansion - Synonym/term expansion

**Phase 2 (Intelligent Retrieval):**
4. Multi-Query RAG - Query variations
5. Parent Document RAG - Full context retrieval
6. Contextual Compression - Token optimization

**Phase 3 (Advanced Patterns):**
7. Self-RAG - Self-correcting retrieval
8. Adaptive RAG - Query routing
9. Corrective RAG - Failure handling

**Phase 4 (Complex Workflows):**
10. Multi-Step RAG - Iterative refinement
11. Agentic RAG - LLM-guided retrieval
12. Ensemble RAG - Strategy combination

---

## File Locations (Proposed)

```
apps/api/src/rag/
├── search/
│   ├── hybrid-search.service.ts      # Hybrid Search RAG
│   ├── reranking.service.ts          # Reranking Pipeline
│   ├── query-expansion.service.ts    # Query Expansion RAG
│   ├── multi-query.service.ts        # Multi-Query RAG
│   └── bm25.service.ts               # BM25 keyword search
├── strategies/
│   ├── parent-document.strategy.ts   # Parent Document RAG
│   ├── self-rag.strategy.ts          # Self-RAG
│   ├── corrective-rag.strategy.ts    # Corrective RAG
│   ├── adaptive-rag.strategy.ts      # Adaptive RAG
│   ├── multi-step.strategy.ts        # Multi-Step RAG
│   ├── agentic-rag.strategy.ts       # Agentic RAG
│   └── ensemble.strategy.ts          # Ensemble RAG
├── compression/
│   └── contextual-compression.service.ts
└── providers/
    ├── vector-db.interface.ts
    ├── pgvector.provider.ts
    ├── pinecone.provider.ts
    ├── weaviate.provider.ts
    └── qdrant.provider.ts
```

---

## Strategy 13: RAG-Fusion (Reciprocal Rank Fusion)

### What It Does
Generates **multiple query variations**, retrieves with each, then combines results using **Reciprocal Rank Fusion (RRF)** - a mathematical formula that weights items by their rank position across all result sets.

### Why It Matters
RRF provides a robust, mathematically-principled way to merge results from multiple queries. Items appearing at the top of multiple lists get the highest combined scores.

### How It Works
```
User Query: "How to optimize database performance?"

Generated Queries:
1. "database performance optimization techniques"
2. "SQL query tuning best practices"
3. "database indexing strategies"
4. "slow query troubleshooting"

Each query returns ranked results → RRF combines them:
- Doc appearing #1 in 3 lists → High RRF score
- Doc appearing #5 in 1 list → Lower RRF score
- Result: Best docs surface to top regardless of which query found them
```

### Implementation Pseudocode
```typescript
async function ragFusion(originalQuery: string, topK: number = 5) {
  // 1. Generate multiple query variations
  const queries = await generateQueryVariations(originalQuery, 4);
  const allQueries = [originalQuery, ...queries];

  // 2. Retrieve with each query in parallel
  const allResults = await Promise.all(
    allQueries.map(q => vectorSearch(q, topK * 2))
  );

  // 3. Apply Reciprocal Rank Fusion
  const k = 60; // RRF constant (standard value)
  const fusedScores = new Map();

  allResults.forEach((results, queryIndex) => {
    results.forEach((doc, rank) => {
      const currentScore = fusedScores.get(doc.id)?.score || 0;
      // RRF formula: sum of 1/(k + rank) across all lists
      const rrfScore = 1 / (k + rank + 1);
      fusedScores.set(doc.id, {
        doc,
        score: currentScore + rrfScore,
        foundInQueries: [...(fusedScores.get(doc.id)?.foundInQueries || []), queryIndex]
      });
    });
  });

  // 4. Sort by fused score and return top-K
  return Array.from(fusedScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => ({ ...item.doc, rrfScore: item.score }));
}
```

### When to Use
- When single queries miss relevant documents
- For broad topic searches where rephrasing helps
- When you want mathematically robust result merging

---

## Strategy 14: RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval)

### What It Does
Builds a **hierarchical tree of summaries** from documents. Leaf nodes are original chunks, parent nodes are summaries of children, up to a root summary. Retrieval can traverse from high-level concepts down to details.

### Why It Matters
Captures both **fine-grained details** (leaf nodes) and **holistic understanding** (summary nodes). Perfect for multi-hop reasoning where you need both the big picture and specific facts.

### How It Works
```
Document: 50-page research paper

RAPTOR Tree Construction:
Level 0 (Leaves): 500 original chunks (100 tokens each)
Level 1: 50 cluster summaries (10 chunks each)
Level 2: 5 topic summaries
Level 3 (Root): 1 document summary

Retrieval Options:
A) Hierarchical: Start at root, traverse down based on query
B) Flattened: Search all levels, retrieve from any level

Query: "What are the main findings?"
→ Retrieves from Level 2-3 (high-level summaries)

Query: "What was the sample size in experiment 3?"
→ Retrieves from Level 0-1 (fine details)
```

### Implementation Pseudocode
```typescript
interface RaptorNode {
  id: string;
  level: number;
  content: string;
  embedding: number[];
  childIds: string[];
  parentId: string | null;
}

// Building the RAPTOR tree
async function buildRaptorTree(document: string, chunkSize: number = 100) {
  const tree: RaptorNode[] = [];

  // Level 0: Create leaf nodes (original chunks)
  const leafChunks = splitIntoChunks(document, chunkSize);
  const leaves = await Promise.all(
    leafChunks.map(async (content, i) => ({
      id: `leaf-${i}`,
      level: 0,
      content,
      embedding: await embed(content),
      childIds: [],
      parentId: null
    }))
  );
  tree.push(...leaves);

  // Build higher levels recursively
  let currentLevel = leaves;
  let levelNum = 1;

  while (currentLevel.length > 1) {
    // Cluster embeddings using GMM or K-means
    const clusters = clusterEmbeddings(
      currentLevel.map(n => n.embedding),
      Math.ceil(currentLevel.length / 10) // ~10 nodes per cluster
    );

    // Summarize each cluster
    const parentNodes = await Promise.all(
      clusters.map(async (clusterIndices, i) => {
        const clusterContent = clusterIndices
          .map(idx => currentLevel[idx].content)
          .join('\n\n');

        const summary = await llm.complete(
          `Summarize the following text concisely:\n\n${clusterContent}`
        );

        const node: RaptorNode = {
          id: `level${levelNum}-${i}`,
          level: levelNum,
          content: summary,
          embedding: await embed(summary),
          childIds: clusterIndices.map(idx => currentLevel[idx].id),
          parentId: null
        };

        // Link children to parent
        clusterIndices.forEach(idx => {
          currentLevel[idx].parentId = node.id;
        });

        return node;
      })
    );

    tree.push(...parentNodes);
    currentLevel = parentNodes;
    levelNum++;
  }

  return tree;
}

// Retrieval from RAPTOR tree (flattened approach)
async function raptorSearch(tree: RaptorNode[], query: string, topK: number) {
  const queryEmbedding = await embed(query);

  // Search across ALL levels (flattened)
  const scored = tree.map(node => ({
    node,
    score: cosineSimilarity(queryEmbedding, node.embedding)
  }));

  // Return top-K from any level
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => item.node);
}
```

### When to Use
- Long documents requiring both overview and detail
- Multi-hop reasoning questions
- Research papers, legal documents, technical manuals
- When you need 20%+ accuracy improvement on complex QA

---

## Strategy 15: GraphRAG (Knowledge Graph RAG)

### What It Does
Extracts **entities and relationships** from documents to build a **knowledge graph**. Queries are converted to graph traversals, enabling multi-hop reasoning and relationship-aware retrieval.

### Why It Matters
Vector search finds similar text but can't reason about relationships. GraphRAG enables queries like "What companies did the CEO's former colleagues found?" - impossible with standard RAG.

### How It Works
```
Document: "John Smith, CEO of TechCorp, previously worked with Mary
at StartupX. Mary later founded InnovateCo."

Knowledge Graph:
[John Smith] --CEO_OF--> [TechCorp]
[John Smith] --WORKED_WITH--> [Mary]
[John Smith] --PREV_COMPANY--> [StartupX]
[Mary] --WORKED_AT--> [StartupX]
[Mary] --FOUNDED--> [InnovateCo]

Query: "What companies are connected to John Smith?"
→ Graph traversal returns: TechCorp, StartupX, InnovateCo (via Mary)

This multi-hop result is impossible with pure vector search.
```

### Implementation Pseudocode
```typescript
interface Entity {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'concept' | 'event';
  properties: Record<string, any>;
}

interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
}

// Extract entities and relationships using LLM
async function extractKnowledgeGraph(text: string) {
  const prompt = `
    Extract entities and relationships from this text.
    Return JSON with format:
    {
      "entities": [{ "name": "...", "type": "person|org|concept|event" }],
      "relationships": [{ "source": "...", "target": "...", "type": "..." }]
    }

    Text: ${text}
  `;

  const result = await llm.complete(prompt);
  return JSON.parse(result);
}

// Build graph from documents
async function buildKnowledgeGraph(documents: string[]) {
  const entities = new Map<string, Entity>();
  const relationships: Relationship[] = [];

  for (const doc of documents) {
    const { entities: docEntities, relationships: docRels } =
      await extractKnowledgeGraph(doc);

    // Merge entities (deduplicate by name)
    for (const entity of docEntities) {
      if (!entities.has(entity.name)) {
        entities.set(entity.name, {
          id: generateId(),
          ...entity,
          properties: {}
        });
      }
    }

    // Add relationships
    for (const rel of docRels) {
      relationships.push({
        id: generateId(),
        source: entities.get(rel.source)!.id,
        target: entities.get(rel.target)!.id,
        type: rel.type,
        properties: {}
      });
    }
  }

  return { entities: Array.from(entities.values()), relationships };
}

// Query the knowledge graph
async function graphRAGSearch(query: string, graph: KnowledgeGraph) {
  // Option 1: Convert query to Cypher (for Neo4j)
  const cypher = await llm.complete(`
    Convert this question to a Cypher query:
    Question: ${query}

    Available node types: ${graph.nodeTypes.join(', ')}
    Available relationship types: ${graph.relTypes.join(', ')}
  `);

  const graphResults = await neo4j.query(cypher);

  // Option 2: Use LLM with graph context
  const relevantSubgraph = await extractRelevantSubgraph(query, graph);

  return {
    graphContext: relevantSubgraph,
    cypherQuery: cypher,
    results: graphResults
  };
}
```

### When to Use
- Questions involving relationships between entities
- Multi-hop reasoning (A→B→C connections)
- When 99% search precision matters (vs ~70% for basic RAG)
- Cybersecurity threat detection, supply chain analysis

---

## Strategy 16: HyDE (Hypothetical Document Embeddings)

### What It Does
Instead of embedding the query directly, **generate a hypothetical answer** first, then embed that answer to search. The hypothetical document is more likely to match real documents in vocabulary and structure.

### Why It Matters
Queries are short and may use different words than documents. A hypothetical answer uses similar language to actual documents, improving retrieval.

### How It Works
```
Query: "How do I fix a memory leak in Python?"

Step 1 - Generate Hypothetical Answer (without retrieval):
"Memory leaks in Python can be fixed by properly managing object
references, using context managers for resource cleanup, employing
weak references when appropriate, and utilizing tools like
tracemalloc or objgraph to identify the source of leaks..."

Step 2 - Embed the Hypothetical Document:
→ This embedding matches real documentation better than the short query

Step 3 - Search with Hypothetical Embedding:
→ Retrieves actual documentation about memory leak solutions
```

### Implementation Pseudocode
```typescript
async function hydeSearch(query: string, topK: number = 5) {
  // 1. Generate hypothetical document (answer without retrieval)
  const hypotheticalDoc = await llm.complete(`
    Write a detailed answer to this question as if you were writing
    documentation. Do not say "I don't know" - write what a good
    answer would look like:

    Question: ${query}
  `);

  // 2. Embed the hypothetical document (not the original query)
  const hydeEmbedding = await embed(hypotheticalDoc);

  // 3. Search with the hypothetical embedding
  const results = await vectorSearchByEmbedding(hydeEmbedding, topK);

  return {
    results,
    hypotheticalDocument: hypotheticalDoc
  };
}

// Variant: Generate multiple hypothetical documents
async function multiHydeSearch(query: string, topK: number = 5) {
  // Generate 3 different hypothetical answers
  const hypotheticals = await Promise.all([
    generateHypothetical(query, 'technical'),
    generateHypothetical(query, 'beginner-friendly'),
    generateHypothetical(query, 'step-by-step')
  ]);

  // Embed all and average (or search with each)
  const embeddings = await Promise.all(
    hypotheticals.map(h => embed(h))
  );

  // Option A: Average embeddings
  const avgEmbedding = averageEmbeddings(embeddings);
  return vectorSearchByEmbedding(avgEmbedding, topK);

  // Option B: Search with each and merge (like RAG-Fusion)
  // const allResults = await Promise.all(embeddings.map(e => vectorSearchByEmbedding(e, topK)));
  // return applyRRF(allResults);
}
```

### When to Use
- Short queries that don't match document vocabulary
- Technical domains with specialized terminology
- When queries are phrased as questions but docs are statements

---

## Strategy 17: Sentence Window Retrieval

### What It Does
Retrieves based on **individual sentences** (for precise matching) but returns a **window of surrounding sentences** (for context). Decouples retrieval granularity from synthesis context.

### Why It Matters
Single sentences embed well but lack context. Full paragraphs have context but dilute the embedding. Sentence window gets both precision AND context.

### How It Works
```
Document stored as sentences:
S1: "The authentication system uses OAuth 2.0."
S2: "Users are redirected to the identity provider."
S3: "After successful login, a token is returned."
S4: "The token expires after 24 hours."
S5: "Refresh tokens can extend the session."

Query: "How long do tokens last?"
→ Best match: S4 (sentence about expiration)
→ Retrieved window (±2): S2, S3, S4, S5, plus next sentence

LLM gets full context, not just the matching sentence.
```

### Implementation Pseudocode
```typescript
interface SentenceChunk {
  id: string;
  sentenceIndex: number;
  sentence: string;
  embedding: number[];
  documentId: string;
}

// Ingestion: Store individual sentences with document reference
async function ingestWithSentenceWindow(document: Document) {
  const sentences = splitIntoSentences(document.content);

  // Store full document
  await storeDocument(document.id, document.content, sentences);

  // Index individual sentences
  for (let i = 0; i < sentences.length; i++) {
    await storeSentenceChunk({
      id: `${document.id}-s${i}`,
      sentenceIndex: i,
      sentence: sentences[i],
      embedding: await embed(sentences[i]),
      documentId: document.id
    });
  }
}

// Retrieval: Match on sentence, return window
async function sentenceWindowSearch(
  query: string,
  topK: number = 5,
  windowSize: number = 3  // sentences on each side
) {
  // 1. Search at sentence level
  const matchedSentences = await vectorSearch(query, topK);

  // 2. Expand each match to include surrounding window
  const windowedResults = await Promise.all(
    matchedSentences.map(async (match) => {
      const doc = await getDocument(match.documentId);
      const sentences = doc.sentences;

      const startIdx = Math.max(0, match.sentenceIndex - windowSize);
      const endIdx = Math.min(sentences.length - 1, match.sentenceIndex + windowSize);

      const window = sentences.slice(startIdx, endIdx + 1).join(' ');

      return {
        matchedSentence: match.sentence,
        sentenceIndex: match.sentenceIndex,
        window,
        windowRange: [startIdx, endIdx],
        score: match.score
      };
    })
  );

  return windowedResults;
}
```

### When to Use
- Large documents where paragraph-level is too coarse
- When you need precise retrieval but full context for synthesis
- Default window size: 5 sentences on each side

---

## Strategy 18: Small-to-Big Retrieval (Child-Parent Chunks)

### What It Does
Store **small chunks** (children) for precise retrieval, but link them to **larger chunks** (parents) for synthesis. Search finds the needle, returns the haystack section.

### Why It Matters
Small chunks (100-200 tokens) embed meaningfully. Large chunks (500-1000 tokens) provide context. Child-parent linking gets both benefits.

### How It Works
```
Document Processing:
1. Split into parent chunks (512 tokens)
2. Split each parent into child chunks (128 tokens)
3. Link children to parents

Parent Chunk P1:
├── Child C1: "Authentication uses OAuth..."
├── Child C2: "The token contains claims..."
├── Child C3: "Refresh tokens are stored..."
└── Child C4: "Token expiration is configurable..."

Query: "Where are refresh tokens stored?"
→ Child C3 matches best
→ Return Parent P1 (full 512-token context)
```

### Implementation Pseudocode
```typescript
interface ChildChunk {
  id: string;
  content: string;
  embedding: number[];
  parentId: string;
}

interface ParentChunk {
  id: string;
  content: string;
  childIds: string[];
}

async function ingestSmallToBig(document: string) {
  // 1. Create parent chunks (larger)
  const parentChunks = splitIntoChunks(document, 512);

  for (let i = 0; i < parentChunks.length; i++) {
    const parentId = `parent-${i}`;

    // Store parent (no embedding needed - only used for retrieval)
    await storeParentChunk({
      id: parentId,
      content: parentChunks[i],
      childIds: []
    });

    // 2. Create child chunks from parent
    const childChunks = splitIntoChunks(parentChunks[i], 128);

    for (let j = 0; j < childChunks.length; j++) {
      const childId = `child-${i}-${j}`;

      // Store child WITH embedding (used for search)
      await storeChildChunk({
        id: childId,
        content: childChunks[j],
        embedding: await embed(childChunks[j]),
        parentId: parentId
      });

      // Link to parent
      await addChildToParent(parentId, childId);
    }
  }
}

async function smallToBigSearch(query: string, topK: number = 5) {
  // 1. Search on child chunks (small, precise)
  const matchedChildren = await vectorSearch(query, topK * 2);

  // 2. Get unique parent IDs
  const parentIds = [...new Set(matchedChildren.map(c => c.parentId))];

  // 3. Retrieve parent chunks
  const parents = await Promise.all(
    parentIds.slice(0, topK).map(id => getParentChunk(id))
  );

  // 4. Return parents with match info
  return parents.map(parent => ({
    content: parent.content,
    matchedChildren: matchedChildren
      .filter(c => c.parentId === parent.id)
      .map(c => c.content)
  }));
}
```

### When to Use
- Long documents where you need both precision and context
- Legal documents, research papers, technical manuals
- Recommended chunk sizes: Parents 400-512, Children 100-128 tokens

---

## Strategy 19: Semantic Chunking

### What It Does
Instead of splitting by fixed character/token count, split documents at **semantic boundaries** - where the topic or meaning changes. Creates more coherent chunks.

### Why It Matters
Fixed-size chunking cuts mid-sentence or mid-thought. Semantic chunking keeps related ideas together, improving both embedding quality and retrieval relevance.

### How It Works
```
Fixed-Size Chunking (500 chars):
Chunk 1: "...the authentication flow begins. First, the user ente"
Chunk 2: "rs their credentials. The system validates them against..."

Problem: Thought split mid-sentence!

Semantic Chunking:
Chunk 1: "The authentication flow begins. First, the user enters
         their credentials. The system validates them against
         the user database."
Chunk 2: "If validation succeeds, a session token is generated.
         The token contains user claims and permissions..."

Better: Complete thoughts preserved!
```

### Implementation Pseudocode
```typescript
// Percentile-based semantic chunking
async function semanticChunking(
  document: string,
  breakpointPercentile: number = 90
) {
  // 1. Split into sentences
  const sentences = splitIntoSentences(document);

  // 2. Embed each sentence
  const embeddings = await Promise.all(
    sentences.map(s => embed(s))
  );

  // 3. Calculate similarity between consecutive sentences
  const similarities = [];
  for (let i = 0; i < embeddings.length - 1; i++) {
    similarities.push(
      cosineSimilarity(embeddings[i], embeddings[i + 1])
    );
  }

  // 4. Find breakpoints where similarity drops significantly
  const threshold = percentile(similarities, 100 - breakpointPercentile);
  const breakpoints = similarities
    .map((sim, i) => sim < threshold ? i : -1)
    .filter(i => i !== -1);

  // 5. Create chunks at breakpoints
  const chunks = [];
  let startIdx = 0;

  for (const breakpoint of breakpoints) {
    chunks.push(sentences.slice(startIdx, breakpoint + 1).join(' '));
    startIdx = breakpoint + 1;
  }
  chunks.push(sentences.slice(startIdx).join(' ')); // Last chunk

  return chunks;
}

// Alternative: LLM-based semantic chunking
async function llmSemanticChunking(document: string) {
  const prompt = `
    Split this document into coherent chunks. Each chunk should:
    - Contain one complete topic or idea
    - Be 200-500 words
    - Not cut mid-sentence or mid-thought

    Return chunks separated by "---CHUNK---"

    Document:
    ${document}
  `;

  const result = await llm.complete(prompt);
  return result.split('---CHUNK---').map(c => c.trim());
}
```

### When to Use
- Documents with distinct sections or topics
- When fixed-size chunks cause retrieval problems
- Research shows 70% accuracy improvement in some cases

---

## Strategy 20: Chain-of-Thought RAG (CoT-RAG / RAT)

### What It Does
Combines **Chain-of-Thought reasoning** with RAG. The LLM reasons through the problem step-by-step, retrieving relevant information at each step as needed.

### Why It Matters
Complex questions need both reasoning AND retrieval. CoT-RAG validates each reasoning step with retrieved evidence, reducing hallucinations.

### How It Works
```
Query: "Should we expand into the European market?"

Step 1 (Reasoning): "I need to understand our current market position"
→ Retrieve: Company market analysis docs
→ Finding: "Currently 80% North American revenue"

Step 2 (Reasoning): "What are the regulatory requirements in EU?"
→ Retrieve: EU compliance documentation
→ Finding: "GDPR compliance required, estimated 6 months"

Step 3 (Reasoning): "What's the competitive landscape?"
→ Retrieve: Market research reports
→ Finding: "3 major competitors already established"

Step 4 (Synthesis): Combine all findings into recommendation
```

### Implementation Pseudocode
```typescript
interface ThoughtStep {
  thought: string;
  query: string;
  retrieved: Chunk[];
  refinedThought: string;
}

async function chainOfThoughtRAG(question: string, maxSteps: number = 5) {
  const steps: ThoughtStep[] = [];

  // 1. Initial chain-of-thought (zero-shot)
  const initialThoughts = await llm.complete(`
    Question: ${question}

    Think through this step by step. For each step, identify what
    information you would need to verify or support your reasoning.

    Format:
    Step 1: [thought] | Need to know: [info needed]
    Step 2: [thought] | Need to know: [info needed]
    ...
  `);

  const thoughtSteps = parseThoughtSteps(initialThoughts);

  // 2. For each thought step, retrieve and refine
  for (const step of thoughtSteps.slice(0, maxSteps)) {
    // Retrieve information for this step
    const retrieved = await vectorSearch(step.infoNeeded, 3);

    // Refine thought based on retrieved info
    const refinedThought = await llm.complete(`
      Original thought: ${step.thought}

      Retrieved information:
      ${retrieved.map(r => r.content).join('\n\n')}

      Refine your thought based on this information. Correct any
      assumptions and incorporate the evidence.
    `);

    steps.push({
      thought: step.thought,
      query: step.infoNeeded,
      retrieved,
      refinedThought
    });
  }

  // 3. Generate final answer from refined chain
  const finalAnswer = await llm.complete(`
    Question: ${question}

    Reasoning steps (evidence-based):
    ${steps.map((s, i) => `Step ${i + 1}: ${s.refinedThought}`).join('\n')}

    Based on this evidence-backed reasoning, provide a comprehensive answer.
  `);

  return {
    answer: finalAnswer,
    reasoning: steps
  };
}
```

### When to Use
- Complex analytical questions
- When you need to show reasoning with evidence
- Decision-support systems requiring audit trails
- Reports 4-44% accuracy improvement on reasoning tasks

---

## Strategy 21: Auto-Merging Retrieval

### What It Does
Uses **hierarchical chunks** (large → medium → small). If multiple small chunks from the same parent are relevant, **automatically merge** them back into the parent for context.

### Why It Matters
Sometimes multiple fragments from the same section are relevant. Instead of returning fragments, return the unified section.

### How It Works
```
Document hierarchy:
Large (2048 tokens)
├── Medium (512 tokens)
│   ├── Small (128 tokens) ← Matched
│   ├── Small (128 tokens) ← Matched
│   └── Small (128 tokens)
└── Medium (512 tokens)
    └── Small (128 tokens)

Query matches 2 small chunks from same Medium parent
→ Auto-merge: Return the Medium chunk instead of 2 small ones

Threshold: If > 50% of small chunks match, return parent
```

### Implementation Pseudocode
```typescript
interface HierarchicalChunk {
  id: string;
  content: string;
  level: 'large' | 'medium' | 'small';
  parentId: string | null;
  childIds: string[];
}

async function autoMergingSearch(
  query: string,
  topK: number = 5,
  mergeThreshold: number = 0.5  // Merge if > 50% of siblings match
) {
  // 1. Search at smallest level
  const smallMatches = await vectorSearch(query, topK * 3, { level: 'small' });

  // 2. Group matches by parent
  const parentGroups = groupBy(smallMatches, 'parentId');

  // 3. Decide whether to merge for each parent
  const results = [];

  for (const [parentId, matches] of Object.entries(parentGroups)) {
    const parent = await getChunk(parentId);
    const totalChildren = parent.childIds.length;
    const matchedChildren = matches.length;

    if (matchedChildren / totalChildren >= mergeThreshold) {
      // Merge: Return parent instead of children
      results.push({
        content: parent.content,
        merged: true,
        mergedFrom: matches.map(m => m.id),
        score: Math.max(...matches.map(m => m.score))
      });
    } else {
      // Don't merge: Return individual matches
      results.push(...matches.map(m => ({
        content: m.content,
        merged: false,
        score: m.score
      })));
    }
  }

  // 4. Sort by score and return top-K
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

### When to Use
- Hierarchically structured documents
- When context fragmentation is a problem
- Recommended levels: 2048 → 512 → 128 tokens

---

## Strategy 22: Metadata Filtering RAG

### What It Does
Combines vector search with **structured metadata filters**. Filter by date, author, department, document type, etc. before or during vector search.

### Why It Matters
Not all retrieved context is appropriate. Metadata filtering ensures recency, relevance, and compliance (e.g., only search approved documents).

### How It Works
```
Query: "What's our vacation policy?"
Filters:
  - document_type: "policy"
  - status: "approved"
  - department: "HR"
  - updated_after: "2024-01-01"

Without filters: Might return draft policies, outdated docs, wrong dept
With filters: Only current, approved HR policies
```

### Implementation Pseudocode
```typescript
interface MetadataFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}

async function metadataFilteredSearch(
  query: string,
  filters: MetadataFilter[],
  topK: number = 5
) {
  // Option 1: Pre-filter then vector search
  const filteredDocs = await applyMetadataFilters(filters);
  const docIds = filteredDocs.map(d => d.id);
  return vectorSearch(query, topK, { documentIds: docIds });

  // Option 2: Combined query (if vector DB supports)
  return vectorDB.search({
    query: await embed(query),
    topK,
    filters: {
      $and: filters.map(f => ({
        [f.field]: { [`$${f.operator}`]: f.value }
      }))
    }
  });
}

// Auto-extract filters from natural language query
async function extractFiltersFromQuery(query: string) {
  const result = await llm.complete(`
    Extract metadata filters from this query:
    "${query}"

    Available fields: date, author, department, document_type, status

    Return JSON: { "filters": [...], "cleanQuery": "..." }
  `);

  return JSON.parse(result);
}

// Example usage
async function smartSearch(naturalQuery: string) {
  // "Show me HR policies updated this year about remote work"
  const { filters, cleanQuery } = await extractFiltersFromQuery(naturalQuery);
  // filters: [{ field: "department", op: "eq", value: "HR" },
  //           { field: "date", op: "gt", value: "2024-01-01" }]
  // cleanQuery: "remote work policies"

  return metadataFilteredSearch(cleanQuery, filters, 5);
}
```

### When to Use
- Multi-tenant systems (filter by organization)
- Time-sensitive content (filter by date)
- Compliance requirements (filter by approval status)
- Large knowledge bases with diverse content

---

## Strategy 23: Multimodal RAG (ColPali)

### What It Does
Extends RAG beyond text to handle **images, tables, charts, and visual documents**. Uses vision-language models to understand and retrieve visual content.

### Why It Matters
Many documents contain critical information in images, diagrams, or tables that text-only RAG completely misses.

### How It Works
```
Traditional RAG:
PDF → Extract text only → Lose tables, charts, images

Multimodal RAG:
PDF → Render as images → Vision model embeds visual content
    → Retrieve relevant pages/sections as images
    → Vision LLM interprets images for answer

Query: "What does the revenue chart show for Q3?"
→ Retrieves the actual chart image
→ Vision model interprets the chart
→ Accurate answer with visual evidence
```

### Implementation Pseudocode
```typescript
// Using ColPali for visual document retrieval
async function multimodalIngest(document: Document) {
  if (document.type === 'pdf') {
    // Convert PDF pages to images
    const pageImages = await pdfToImages(document.content);

    for (let i = 0; i < pageImages.length; i++) {
      // Embed image using vision model (ColPali)
      const visualEmbedding = await colpali.embed(pageImages[i]);

      await storeVisualChunk({
        id: `${document.id}-page-${i}`,
        pageNumber: i,
        imageData: pageImages[i],
        embedding: visualEmbedding,
        documentId: document.id
      });
    }
  }
}

async function multimodalSearch(query: string, topK: number = 5) {
  // 1. Embed query for visual matching
  const queryEmbedding = await colpali.embedQuery(query);

  // 2. Search visual embeddings
  const matchedPages = await vectorSearch(queryEmbedding, topK);

  // 3. Return images for vision LLM processing
  return matchedPages.map(p => ({
    pageNumber: p.pageNumber,
    image: p.imageData,
    score: p.score
  }));
}

async function multimodalQA(query: string) {
  // 1. Retrieve relevant visual content
  const relevantImages = await multimodalSearch(query, 3);

  // 2. Use vision LLM to answer with visual context
  const answer = await visionLLM.complete({
    prompt: query,
    images: relevantImages.map(r => r.image)
  });

  return {
    answer,
    sources: relevantImages
  };
}
```

### When to Use
- PDFs with charts, graphs, tables
- Technical diagrams and schematics
- Scanned documents
- Presentations and slides

---

## Strategy 24: Late Chunking

### What It Does
Instead of chunking first then embedding, **embed the full document first**, then chunk the embeddings. Preserves cross-chunk context in the embedding.

### Why It Matters
Traditional chunking loses context at boundaries. Late chunking maintains document-level context in each chunk's embedding.

### How It Works
```
Traditional (Early) Chunking:
Document → Split into chunks → Embed each chunk independently
Problem: Chunk "It refers to the system" loses context of what "It" is

Late Chunking:
Document → Embed full document (token-level) → Split embeddings
Benefit: Each chunk embedding retains full document context
```

### Implementation Pseudocode
```typescript
async function lateChunking(document: string, chunkSize: number = 256) {
  // 1. Get token-level embeddings for full document
  const tokenEmbeddings = await embeddingModel.embedTokens(document);
  // Returns: array of embeddings, one per token

  // 2. Tokenize to get boundaries
  const tokens = tokenize(document);

  // 3. Group token embeddings into chunks
  const chunks = [];
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunkTokens = tokens.slice(i, i + chunkSize);
    const chunkEmbeddings = tokenEmbeddings.slice(i, i + chunkSize);

    // Average token embeddings to get chunk embedding
    const chunkEmbedding = averageEmbeddings(chunkEmbeddings);

    chunks.push({
      content: chunkTokens.join(''),
      embedding: chunkEmbedding,
      startToken: i,
      endToken: Math.min(i + chunkSize, tokens.length)
    });
  }

  return chunks;
}
```

### When to Use
- When cross-chunk references are common ("it", "this", "the above")
- Documents with strong internal coherence
- Requires models that support token-level embedding output

---

## Strategy 25: Iterative Retrieval with Feedback

### What It Does
Implements a **feedback loop** where user interactions (clicks, ratings, corrections) improve future retrievals. Learns from usage patterns.

### Why It Matters
Static RAG doesn't improve. Feedback-driven RAG gets smarter over time, learning what users actually find relevant.

### How It Works
```
Session 1:
Query: "deployment process"
Retrieved: [Doc A, Doc B, Doc C]
User clicked: Doc B
→ Log: Query "deployment" → Doc B relevant

Session 2:
Query: "how to deploy"
→ Boost Doc B based on learned relevance

Over time:
→ System learns query-document relationships
→ Retrieval improves automatically
```

### Implementation Pseudocode
```typescript
interface FeedbackSignal {
  queryId: string;
  query: string;
  documentId: string;
  signal: 'click' | 'upvote' | 'downvote' | 'used_in_answer';
  timestamp: Date;
}

// Log user feedback
async function logFeedback(signal: FeedbackSignal) {
  await db.feedbackSignals.insert(signal);

  // Update document relevance scores
  const weight = {
    click: 0.1,
    upvote: 0.5,
    downvote: -0.3,
    used_in_answer: 0.3
  }[signal.signal];

  await updateQueryDocRelevance(signal.query, signal.documentId, weight);
}

// Enhanced search with learned relevance
async function feedbackEnhancedSearch(query: string, topK: number = 5) {
  // 1. Standard vector search
  const vectorResults = await vectorSearch(query, topK * 2);

  // 2. Get learned relevance scores for similar queries
  const learnedScores = await getLearnedRelevance(query);

  // 3. Combine scores
  const enhanced = vectorResults.map(doc => {
    const learned = learnedScores.get(doc.id) || 0;
    return {
      ...doc,
      enhancedScore: doc.score * 0.7 + learned * 0.3
    };
  });

  // 4. Re-rank by enhanced score
  return enhanced
    .sort((a, b) => b.enhancedScore - a.enhancedScore)
    .slice(0, topK);
}

// Find similar past queries for relevance transfer
async function getLearnedRelevance(query: string) {
  // Find similar past queries
  const queryEmbedding = await embed(query);
  const similarQueries = await findSimilarPastQueries(queryEmbedding, 10);

  // Aggregate document relevance from similar queries
  const relevanceScores = new Map();
  for (const pastQuery of similarQueries) {
    const feedback = await getFeedbackForQuery(pastQuery.id);
    for (const fb of feedback) {
      const current = relevanceScores.get(fb.documentId) || 0;
      relevanceScores.set(fb.documentId, current + fb.weight * pastQuery.similarity);
    }
  }

  return relevanceScores;
}
```

### When to Use
- Production systems with user interactions
- When you can collect implicit (clicks) or explicit (ratings) feedback
- Long-running systems that should improve over time

---

## Complete Strategy Catalog

| # | Strategy | Category | Key Benefit |
|---|----------|----------|-------------|
| 1 | Parent Document | Context Expansion | Full document context from chunk match |
| 2 | Multi-Query | Query Enhancement | Multiple query perspectives |
| 3 | Query Expansion | Query Enhancement | Synonym/term coverage |
| 4 | Hybrid Search | Retrieval Method | Vector + keyword combined |
| 5 | Self-RAG | Intelligent Retrieval | Self-correcting retrieval loop |
| 6 | Corrective RAG | Failure Handling | Graceful retrieval failure recovery |
| 7 | Adaptive RAG | Query Routing | Skip RAG for simple queries |
| 8 | Agentic RAG | Complex Workflows | LLM-guided multi-step retrieval |
| 9 | Multi-Step RAG | Complex Workflows | Iterative query refinement |
| 10 | Contextual Compression | Token Optimization | Extract only relevant content |
| 11 | Ensemble RAG | Retrieval Method | Multiple strategies combined |
| 12 | Reranking Pipeline | Post-Retrieval | Cross-encoder precision boost |
| 13 | RAG-Fusion | Query Enhancement | RRF-based result merging |
| 14 | RAPTOR | Hierarchical | Tree of summaries for multi-hop |
| 15 | GraphRAG | Knowledge Graphs | Entity-relationship reasoning |
| 16 | HyDE | Query Enhancement | Hypothetical document matching |
| 17 | Sentence Window | Context Expansion | Sentence match → window context |
| 18 | Small-to-Big | Hierarchical | Child chunks → parent context |
| 19 | Semantic Chunking | Preprocessing | Meaning-based chunk boundaries |
| 20 | CoT-RAG | Reasoning | Chain-of-thought with retrieval |
| 21 | Auto-Merging | Context Expansion | Merge related fragments |
| 22 | Metadata Filtering | Filtering | Structured attribute filters |
| 23 | Multimodal RAG | Content Type | Images, charts, visual content |
| 24 | Late Chunking | Preprocessing | Document-context embeddings |
| 25 | Feedback Loop | Learning | User feedback improves retrieval |

---

## Updated Implementation Priority

### Phase 1: Foundation (Must-Have)
1. Hybrid Search - Vector + BM25
2. Reranking Pipeline - Cross-encoder
3. Small-to-Big / Parent Document - Context expansion
4. Metadata Filtering - Structured filters

### Phase 2: Query Intelligence
5. Multi-Query / RAG-Fusion - Query variations
6. Query Expansion / HyDE - Term expansion
7. Semantic Chunking - Better preprocessing

### Phase 3: Self-Correcting
8. Self-RAG - Iterative refinement
9. Corrective RAG - Failure handling
10. Adaptive RAG - Smart routing

### Phase 4: Advanced Architectures
11. RAPTOR - Hierarchical summaries
12. GraphRAG - Knowledge graphs
13. CoT-RAG - Reasoning chains

### Phase 5: Production Features
14. Multimodal RAG - Visual content
15. Feedback Loop - Learning system

---

## Updated File Structure

```
apps/api/src/rag/
├── preprocessing/
│   ├── semantic-chunking.service.ts
│   ├── late-chunking.service.ts
│   └── hierarchical-chunking.service.ts
├── query/
│   ├── query-expansion.service.ts
│   ├── multi-query.service.ts
│   ├── hyde.service.ts
│   └── query-routing.service.ts
├── retrieval/
│   ├── hybrid-search.service.ts
│   ├── bm25.service.ts
│   ├── metadata-filter.service.ts
│   ├── sentence-window.service.ts
│   ├── small-to-big.service.ts
│   └── auto-merge.service.ts
├── ranking/
│   ├── reranking.service.ts
│   ├── rag-fusion.service.ts
│   └── ensemble.service.ts
├── advanced/
│   ├── raptor.service.ts
│   ├── graph-rag.service.ts
│   ├── self-rag.service.ts
│   ├── corrective-rag.service.ts
│   ├── adaptive-rag.service.ts
│   ├── agentic-rag.service.ts
│   └── cot-rag.service.ts
├── multimodal/
│   ├── colpali.service.ts
│   └── vision-rag.service.ts
├── learning/
│   ├── feedback.service.ts
│   └── relevance-learning.service.ts
└── providers/
    ├── vector-db.interface.ts
    ├── pgvector.provider.ts
    ├── pinecone.provider.ts
    └── neo4j.provider.ts (for GraphRAG)
```

---

## References

- **Internal:** `docs/prd/v2-final-solution.md` Section 1
- **Internal:** `specs/prd-phase-6-rag-infrastructure.md`
- **External:** [ottomator-agents/all-rag-strategies](https://github.com/coleam00/ottomator-agents/tree/main/all-rag-strategies)
- **External:** [NirDiamant/RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)
- **Research:** [RAPTOR Paper (ICLR 2024)](https://arxiv.org/abs/2401.18059)
- **Research:** [GraphRAG (Microsoft)](https://microsoft.github.io/graphrag/)
- **Research:** [RAG-Fusion Paper](https://arxiv.org/abs/2402.03367)
- **Research:** [CoT-RAG Paper](https://arxiv.org/abs/2504.13534)
- **Research:** [Self-RAG Paper](https://arxiv.org/abs/2310.11511)
- **Guides:** [Analytics Vidhya - 13 Advanced RAG Techniques](https://www.analyticsvidhya.com/blog/2025/04/advanced-rag-techniques/)
- **Guides:** [Weaviate - Advanced RAG eBook](https://weaviate.io/ebooks/advanced-rag-techniques)
- **Guides:** [Neo4j - Advanced RAG Techniques](https://neo4j.com/blog/genai/advanced-rag-techniques/)
- **Guides:** [DataCamp - Advanced RAG](https://www.datacamp.com/blog/rag-advanced)
- **Guides:** [DeepLearning.AI - Sentence Window Retrieval](https://learn.deeplearning.ai/courses/building-evaluating-advanced-rag/)

---

**See Also:**
- [06-Advanced-RAG-Strategy.md](06-Advanced-RAG-Strategy.md) - Hardening plan and timeline
- [00-Index.md](00-Index.md) - Quick reference

