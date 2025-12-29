Book Writer Agent System - Product Requirements Document
Version: 1.1
Date: 2025-12-23
Status: Design Phase
Changelog: Added Global Narrative Voice Anchor, Canon Governance, Resume Strategy, Review Presets
Executive Summary
The Book Writer Agent System is a multi-agent LangGraph application that autonomously generates full-length books (novels, children's books, etc.) through orchestrated collaboration of specialized AI agents. The system takes user input about genre, characters, plot preferences, and other parameters, then produces a complete, coherent, professionally-structured manuscript through a series of planning, writing, and editing phases. Core Philosophy: This is not a "book generator" - it's a structured authorship engine where humans define intent, AI executes it faithfully, and missing intent is filled only by consent.
Table of Contents
Overview
User Input Schema
Agent Architecture (24 Agents)
Execution Flow & Dependencies
Database Schema
UI/UX Design
Quality Assurance & Revision Strategy
Canon Governance & Consistency Management ⭐ NEW
Resume & Checkpoint Strategy ⭐ NEW
Technical Architecture
Cost & Performance Estimates
Future Agent Expansion
Success Metrics
1. Overview
1.1 Goals
Primary Goal: Generate complete, coherent books (30K-80K words) that are readable, entertaining, and structurally sound
Quality Target: Professional first-draft quality suitable for human editing and publication
User Control: Balance between comprehensive user control and AI autonomy
Voice Consistency: Maintain authorial voice throughout the book across all agents and editing passes
Reusability: Patterns applicable to other long-form content generation tasks
1.2 Scope
MVP Scope (Phase 1):
Children's books (5K-15K words)
Middle-grade novels (30K-40K words)
Young adult novels (50K-70K words)
Simple genre fiction (fantasy, sci-fi, adventure, mystery)
Out of Scope for MVP:
Complex literary fiction with experimental structures
Non-fiction books
Technical/educational books
Books requiring research or factual accuracy
Multiple POV characters (limit to 1-2 for MVP)
1.3 Key Patterns from Marketing Swarm
Reusable Patterns:
LangGraph orchestration with sequential and parallel agent execution
Database-driven state machine (custom schema for book_writer)
SSE streaming for real-time progress updates
Custom UI component for complex workflow visualization
ExecutionContext flow through all agents
Observability integration for debugging
Checkpointing for long-running processes
Key Differences:
Much longer execution time (2-4 hours vs 10-30 minutes)
Deeper interdependencies (chapters build on each other)
More complex context management (80K words vs 10 pieces)
Iterative approval gates (structure approval before writing)
Higher state complexity (characters, world rules, plot threads, voice anchoring)
Chapter-level checkpointing for resume capability
2. User Input Schema
### 2.1 Required Fields (Hard Gate)
User MUST provide these to proceed:

{
  primaryGenre: 'fantasy' | 'sci-fi' | 'mystery' | 'adventure' | 'contemporary' | 'romance' | 'horror' | 'historical',
  targetAudience: 'children' | 'middle-grade' | 'young-adult' | 'adult',
  povType: 'first-person' | 'third-person-limited' | 'third-person-omniscient',
  toneRange: string[], // e.g., ['hopeful', 'adventurous', 'humorous']
  targetLength: {
    min: number, // word count
    max: number  // word count
  },
  creativityAllowance: 'strict' | 'balanced' | 'flexible'
  // strict = follow user input exactly
  // balanced = fill gaps with approval
  // flexible = AI can make creative decisions within boundaries
}
### 2.2 Optional Fields (AI Can Suggest)

{
  // Project metadata
  workingTitle?: string,
  finalTitle?: string,
  seriesInfo?: {
    isSeriesBook: boolean,
    bookNumber?: number,
    seriesName?: string
  },
  
  // Content boundaries
  contentRatings?: {
    violence: 'none' | 'mild' | 'moderate' | 'intense',
    language: 'none' | 'mild' | 'moderate' | 'strong',
    romance: 'none' | 'sweet' | 'steamy' | 'explicit',
    scariness: 'none' | 'mild' | 'moderate' | 'intense'
  },
  
  // Genre specifics
  genreFlags?: {
    fantasyMagicSystem?: 'hard' | 'soft' | 'none',
    sciFiTechLevel?: 'near-future' | 'far-future' | 'space-opera',
    mysteryStyle?: 'cozy' | 'hard-boiled' | 'psychological',
    romanceHEA?: boolean // Happily Ever After required?
  },
  
  // Character info
  protagonistCount?: number, // 1-3
  protagonistIdeas?: string[], // Names, traits, roles
  antagonistPresent?: boolean,
  antagonistIdea?: string,
  
  // Plot info
  plotConcept?: string, // High-level idea
  plotRequirements?: string[], // Must-have scenes/events
  plotForbidden?: string[], // Things that CANNOT happen
  endingType?: 'happy' | 'tragic' | 'bittersweet' | 'open',
  
  // World/setting
  settingType?: 'real-world' | 'fictional' | 'alternate-history',
  settingLocation?: string,
  timePeriod?: string,
  
  // Writing style & voice
  pacing?: 'slow-burn' | 'moderate' | 'fast-paced',
  dialogueDensity?: 'minimal' | 'balanced' | 'heavy',
  descriptionDensity?: 'sparse' | 'balanced' | 'lush',
  proseStyle?: 'plain' | 'lyrical' | 'cinematic',
  humorLevel?: 'none' | 'subtle' | 'moderate' | 'heavy',
  voiceInspirations?: string[], // e.g., ["Neil Gaiman", "Terry Pratchett"]
  
  // Quality controls
  chapterLengthPreference?: {
    min: number,
    max: number,
    target: number
  },
  
  // Locked elements (cannot be changed by AI)
  lockedElements?: {
    characterNames?: string[],
    plotPoints?: string[],
    worldRules?: string[],
    thematicElements?: string[]
  },
  
  // Quality settings
  qualitySettings?: {
    sceneRetryAttempts: 1 | 2 | 3,
    chapterQualityGate: 'strict' | 'balanced' | 'permissive',
    prosePolishPasses: 1 | 2 | 3,
    autoFixMinorIssues: boolean,
    requestApprovalForMajorFixes: boolean,
    deliverIfFailsFinal: boolean
  },
  
  // Review preferences ⭐ NEW
  reviewPreset?: 'hands-off' | 'structural-only' | 'collaborative' | 'author-mode'
  // hands-off: only final delivery
  // structural-only: approve outline, then auto-run
  // collaborative (default): structure + major edits
  // author-mode: frequent check-ins every 3 chapters
}
### 2.3 Review Presets Explained ⭐ NEW
Review presets control how much user involvement is required during generation:
| Preset | Structure Approval | Mid-Generation Reviews | Major Edit Approval | Final Delivery |
|--------|-------------------|------------------------|---------------------|----------------|
| Hands-Off | ✅ Yes | ❌ No | ❌ No (auto-apply) | ✅ Yes |
| Structural-Only | ✅ Yes | ❌ No | ❌ No (auto-apply) | ✅ Yes |
| Collaborative (default) | ✅ Yes | ⚠️ Optional (every 5 ch) | ✅ Yes | ✅ Yes |
| Author-Mode | ✅ Yes | ✅ Yes (every 3 ch) | ✅ Yes | ✅ Yes |
User Time Commitment:
Hands-Off: ~5 min (initial setup + final review)
Structural-Only: ~10 min (setup + structure approval + final review)
Collaborative: ~15 min (setup + structure + major edits + final)
Author-Mode: ~25 min (setup + structure + chapter reviews + edits + final)
### 2.4 AI Suggestion Workflow
When `creativityAllowance` is 'balanced' or 'flexible':
1. Parameter Gap Filler Agent identifies missing parameters
2. Infers values based on genre conventions and provided context
3. Presents suggestions to user with confidence scores
4. User can approve, reject, or modify suggestions
5. Approved suggestions become locked parameters
3. Agent Architecture (24 Agents)
Note: We've added 1 new agent (1G: Narrative Voice Architect) for a total of 24 agents.
Phase 0: Input Processing (2 Agents)
**Agent 0A: User Input Compiler**
- **Type**: Synchronous
- **Dependencies**: None
- **Input**: Raw user form data
- **Output**: Structured narrative PRD
- **Responsibilities**:
  - Parse and validate all user inputs
  - Organize into narrative-focused PRD format
  - Identify gaps in required vs optional fields
  - Create success criteria based on user goals
  - Generate technical spec for downstream agents
- **Complexity**: LOW (mostly formatting/organization)
- **Output Structure**:

{
  narrativePRD: {
    coreVision: string,
    mustHaves: string[],
    niceToHaves: string[],
    forbiddenElements: string[],
    targetExperience: string,
    successCriteria: string[]
  },
  technicalSpec: { /* all validated params */ },
  gaps: string[]
}
Agent 0B: Parameter Gap Filler
Type: Synchronous (with async approval gate if needed)
Dependencies: Agent 0A
Input: Narrative PRD with gaps
Output: Complete parameter set Responsibilities:
Analyze gaps against genre conventions
Infer missing parameters with reasoning
Generate confidence scores for inferences
Create approval requests for low-confidence items
Wait for user approval before proceeding
Complexity: LOW-MEDIUM Logic:
High confidence (>0.8): Auto-fill, notify user
Medium confidence (0.5-0.8): Suggest with approval
Low confidence (<0.5): Ask user directly
Phase 1: Story Architecture (7 Agents)
Agent 1A: Master Plot Architect
Type: Synchronous
Dependencies: Agent 0B
Input: Complete parameter set
Output: High-level plot structure Responsibilities:
Design 3-act structure with clear beats
Identify major plot points (inciting incident, midpoint, climax, resolution)
Define overarching conflict (external + internal)
Establish thematic elements
Create premise statement
Map genre conventions to structure
Complexity: MEDIUM Output Structure:

{
  premise: string,
  threeActStructure: {
    act1: {
      summary: string,
      percentageOfBook: number,
      endEvent: string
    },
    act2: {
      summary: string,
      percentageOfBook: number,
      midpoint: string,
      endEvent: string
    },
    act3: {
      summary: string,
      percentageOfBook: number,
      climax: string,
      resolution: string
    }
  },
  majorPlotPoints: Array<{
    name: string,
    estimatedChapter: number,
    description: string,
    impact: string,
    category: 'inciting' | 'turning-point' | 'midpoint' | 'climax' | 'resolution'
  }>,
  thematicElements: string[],
  overallConflict: {
    external: string,
    internal: string
  },
  endingType: string
}
Agent 1B: Plot-to-Chapter Distributor
Type: Synchronous
Dependencies: Agent 1A
Input: Plot structure + target word count
Output: Chapter-by-chapter plot distribution Responsibilities:
Calculate optimal chapter count based on word count
Distribute plot events across chapters
Create pacing curve (tension levels per chapter)
Assign act sections to chapter ranges
Define purpose and emotional arc for each chapter
Ensure proper pacing rhythm (escalation, peaks, valleys)
Complexity: LOW-MEDIUM Output Structure:

{
  totalChapters: number,
  averageChapterLength: number,
  chapterDistribution: Array<{
    chapterNumber: number,
    actSection: string,
    plotEvents: string[],
    purpose: string,
    pacingNotes: string,
    tensionLevel: number, // 1-10
    chapterArc: string, // e.g., "hope → despair"
  }>,
  pacingCurve: number[], // Tension per chapter for visualization
  rationale: string
}
Agent 1C: Character Blueprint Agent
Type: Synchronous
Dependencies: Agent 1A
Input: Plot structure + user character ideas
Output: Detailed character profiles Responsibilities:
Create protagonist profile(s) with full development
Create antagonist profile if applicable
Design supporting characters as needed
Define character relationships
Establish character arcs tied to plot
Assign voice traits and speech patterns
Map character importance to POV access
Complexity: MEDIUM Output Structure (per character):

{
  name: string,
  role: 'protagonist' | 'antagonist' | 'supporting',
  demographics: {
    age: number,
    gender: string,
    background: string,
    occupation?: string
  },
  personality: {
    coreTrait: string,
    secondaryTraits: string[],
    voice: string,
    speechPatterns: string[],
    internalConflict: string,
    fears: string[],
    desires: string[]
  },
  arc: {
    startingState: string,
    transformation: string,
    endingState: string,
    arcType: 'growth' | 'fall' | 'flat' | 'corruption'
  },
  relationships: Record<string, string>,
  keyMoments: Array<{
    chapter: number,
    event: string,
    impact: string
  }>
}
Agent 1D: Character Arc Mapper
Type: Synchronous
Dependencies: Agent 1B, Agent 1C
Input: Chapter distribution + character blueprints
Output: Character development timeline Responsibilities:
Map character arcs to specific chapters
Identify transformation moments per character
Track voice evolution across story
Ensure character growth feels earned (not sudden)
Align character moments with plot events
Complexity: LOW Output Structure:

{
  characterArcs: Array<{
    characterName: string,
    arcMilestones: Array<{
      chapter: number,
      state: string,
      triggerEvent: string,
      internalShift: string,
      visibleChange: string
    }>,
    voiceEvolution: {
      earlyChapters: string,
      middleChapters: string,
      lateChapters: string
    }
  }>
}
Agent 1E: World & Setting Designer
Type: Synchronous
Dependencies: Agent 1A, Agent 1B
Input: Plot structure + chapter distribution + genre
Output: World bible and setting details Responsibilities:
Design primary settings with sensory details
Establish world rules (magic, tech, physics)
Define cultural norms and social structures
Create atmosphere guidelines per setting
Map settings to chapters
Ensure consistency in world-building
Complexity: LOW-MEDIUM Output Structure:

{
  primarySettings: Array<{
    name: string,
    description: string,
    mood: string,
    sensoryDetails: string[],
    rules: string[],
    symbolism?: string,
    firstAppearance: number // chapter number
  }>,
  worldRules: string[],
  culturalNorms: string[],
  technologyLevel: string,
  magicSystem?: {
    type: 'hard' | 'soft',
    rules: string[],
    costs: string[],
    limitations: string[]
  },
  settingsByChapter: Record<number, string> // chapter → setting name
}
Agent 1F: Chapter Blueprint Agent
Type: Synchronous
Dependencies: Agent 1B, Agent 1D, Agent 1E
Input: All architecture outputs
Output: Detailed scene-by-scene blueprints for ALL chapters Responsibilities:
Create comprehensive blueprint for every chapter
Break chapters into scenes (3-5 scenes per chapter)
Define opening and closing beats with explicit transitions
Assign POV character per chapter
Map plot events, character moments, and settings to scenes
Establish conflict and outcome for each scene
Create transition hooks between chapters
Complexity: MEDIUM Output Structure (per chapter):

{
  chapterNumber: number,
  title: string,
  purpose: string,
  povCharacter: string,
  setting: {
    location: string,
    timeOfDay: string,
    mood: string,
    weather?: string
  },
  
  openingBeat: {
    transitionFromPrevious: string,
    openingLine: string, // Suggested first sentence
    initialTension: string,
    hook: string
  },
  
  scenes: Array<{
    sceneNumber: number,
    purpose: string,
    characters: string[],
    setting: string,
    conflict: string,
    outcome: string,
    emotionalBeat: string,
    plotAdvancement: string,
    characterDevelopment: string,
    estimatedWordCount: number
  }>,
  
  closingBeat: {
    chapterCliffhanger: string,
    emotionalNote: string,
    setupForNext: string,
    transitionHook: string
  },
  
  plotAdvancement: string,
  characterDevelopment: string,
  thematicElements: string[]
}
Agent 1G: Narrative Voice Architect ⭐ NEW
Type: Synchronous
Dependencies: Agent 1C (character profiles), Agent 1A (plot), user config
Input: Character profiles, plot structure, user style preferences
Output: Global Narrative Voice Anchor (immutable) Responsibilities:
Define the global narrative voice that persists throughout the book
Derive voice from genre, audience, POV, and user preferences
Create explicit stylistic guidelines for all prose-generating agents
Establish "do not smooth" flags for intentional stylistic choices
Generate voice reference examples
Complexity: MEDIUM Why This Agent Is Critical: Without a global voice anchor, the system suffers from:
Voice drift - Later chapters sound different from earlier ones
Polish homogenization - Editing agents smooth away character
Retry regression - Rewrites become safer and more generic
Multi-agent inconsistency - Each agent interprets "voice" differently
This agent creates a shared contract that all prose-modifying agents must honor. Output Structure:

{
  narrativeVoiceAnchor: {
    // Core voice parameters
    tense: 'past' | 'present',
    narrativeDistance: 'close' | 'medium' | 'distant',
    // close = deep POV, character thoughts
    // medium = balanced narrative and interiority
    // distant = observer, less internal access
    
    proseTexture: 'plain' | 'lyrical' | 'cinematic',
    // plain = straightforward, minimal flourish
    // lyrical = poetic, rich language
    // cinematic = visual, action-focused
    
    sentenceCadence: 'short' | 'mixed' | 'long',
    // short = punchy, staccato
    // mixed = varied for rhythm
    // long = flowing, complex
    
    metaphorDensity: 'low' | 'medium' | 'high',
    humorBaseline: 'none' | 'dry' | 'playful' | 'absurd',
    emotionalOpacity: 'internalized' | 'externalized',
    // internalized = character processes internally
    // externalized = emotions shown through action
    
    allowedStylization: 'low' | 'medium' | 'high',
    // low = minimal flourish, utilitarian
    // medium = genre-appropriate style
    // high = artistic, experimental
    
    // Optional stylistic anchors
    inspirationReferences?: string[], // e.g., ["Neil Gaiman", "Terry Pratchett"]
    explicitDontSmoothFlags?: string[], // e.g., ["run-on sentences for breathlessness", "sentence fragments for impact"]
    
    // Voice compliance rules
    voiceComplianceRules: {
      preserveFragments: boolean, // Allow sentence fragments if intentional
      preserveRepetition: boolean, // Allow repetition for effect
      preserveDialect: boolean, // Don't "correct" character dialect
      allowAbstractLanguage: boolean, // Allow vague/abstract descriptions
      allowNeologisms: boolean // Allow made-up words
    },
    
    // Reference examples (generated)
    voiceExamples: {
      narrativeSample: string, // 200-word sample in target voice
      dialogueSample: string, // Sample of how this voice handles dialogue
      actionSample: string, // Sample of action scene in this voice
      introspectionSample: string // Sample of character thinking
    }
  }
}
Usage Across Agents: Every prose-modifying agent receives the narrativeVoiceAnchor and MUST:
Generate/edit prose that matches the voice parameters
Flag any deviation instead of correcting implicitly
Preserve explicit "do not smooth" elements
Use voice examples as reference for ambiguous decisions
Agents that consume this anchor:
Agent 2A: Scene Writer
Agent 2B: Dialogue Enhancer
Agent 2C: Sensory Detail Injector
Agent 4B: Prose Polish Agent
Agent 4D: Final Consistency Validator (checks voice compliance)
Voice Compliance Check (in Agent 4D):

voiceComplianceCheck: {
  earlyChaptersScore: number, // 0-10
  lateChaptersScore: number, // 0-10
  driftDetected: boolean,
  driftLocations: string[], // Where voice deviated
  overallConsistency: number // 0-1 score
}
Example Voice Anchor (Middle-Grade Fantasy):

{
  tense: 'past',
  narrativeDistance: 'close',
  proseTexture: 'cinematic',
  sentenceCadence: 'mixed',
  metaphorDensity: 'medium',
  humorBaseline: 'playful',
  emotionalOpacity: 'externalized',
  allowedStylization: 'medium',
  
  voiceComplianceRules: {
    preserveFragments: true, // Elena's voice uses fragments for excitement
    preserveRepetition: true, // Intentional for emphasis
    preserveDialect: false, // Standard English
    allowAbstractLanguage: false, // Concrete for MG audience
    allowNeologisms: true // Magic-related terms
  },
  
  explicitDontSmoothFlags: [
    "Short punchy sentences during action",
    "Exclamations in Elena's internal monologue",
    "Made-up magic terminology"
  ],
  
  voiceExamples: {
    narrativeSample: "Elena pressed her ear against the door. Nothing. Just the old house settling, probably. Probably. She reached for the knob—cold against her palm—and twisted. The hinges groaned. Of course they did. Because sneaking around was so much easier when everything decided to announce your presence...",
    
    dialogueSample: "\"You can't just—\" Mr. Ashford started.\n\"Watch me,\" Elena shot back. Her hands shook, but she kept her voice steady. Mostly steady.",
    
    actionSample: "The shadow lunged. Elena dove left—hit the floor hard—rolled. Her staff clattered across the marble. No no no. She scrambled after it...",
    
    introspectionSample: "She should tell someone. Should definitely tell someone. Except who would believe her? 'Hey, I found a glowing book and now shadows are trying to kill me.' Yeah. That would go great."
  }
}
Phase 2: Prose Generation (5 Agents)
Agent 2A: Scene Writer
Type: Asynchronous (can parallelize scenes within a chapter)
Dependencies: Agent 1F (chapter blueprints), Agent 1G (voice anchor) ⭐ NEW
Input: Scene blueprint + context + Narrative Voice Anchor
Output: Scene prose (500-1500 words) Responsibilities:
Generate prose for individual scenes
Follow blueprint specifications exactly
Maintain character voice from profiles
Adhere to Global Narrative Voice Anchor ⭐ NEW
Include sensory details per setting guidelines
Implement conflict and outcome as specified
Create natural scene transitions
Stay within estimated word count
Complexity: HIGH (core writing agent) Context Provided:
Full scene blueprint
Previous scene's ending (for continuity)
Character voice profiles
Global Narrative Voice Anchor ⭐ NEW
World rules and setting details
Current chapter's emotional arc
Canon facts database (to prevent contradictions)
Voice Adherence Strategy: The Scene Writer receives explicit instructions:

Your prose MUST match the Narrative Voice Anchor:
- Tense: [past]
- Distance: [close - deep POV with character's internal voice]
- Texture: [cinematic - visual, action-focused]
- Cadence: [mixed - vary sentence length]
- Humor: [playful - light touches, character-driven]

Voice Examples:
[Insert voice samples from 1G]

Do NOT:
- Smooth intentional fragments
- Remove repetition used for emphasis
- "Correct" stylistic choices marked in compliance rules

DO:
- Match the cadence and texture of the examples
- Preserve the humor baseline
- Maintain narrative distance consistently
Quality Requirements:
Prose matches target audience reading level
Dialogue sounds natural and character-specific
Show-don't-tell balance appropriate for genre
Pacing matches scene purpose (action vs reflection)
No contradictions with established facts
Voice matches anchor parameters ⭐ NEW
Retry Logic: See Section 7 for quality threshold and retry strategy
Agent 2B: Dialogue Enhancer
Type: Synchronous (runs after Scene Writer)
Dependencies: Agent 2A, Agent 1G (voice anchor) ⭐ NEW
Input: Scene prose + character voice profiles + Narrative Voice Anchor
Output: Scene with enhanced dialogue Responsibilities:
Review all dialogue in scene
Ensure character voice consistency
Add subtext where appropriate
Check for "as you know, Bob" exposition
Verify character-specific speech patterns
Add dialogue tags and beats
Ensure dialogue advances plot or reveals character
Preserve voice anchor's humor and cadence ⭐ NEW
Complexity: LOW-MEDIUM Voice Preservation: The Dialogue Enhancer must respect:
Voice anchor's humor baseline (don't remove jokes if voice is playful)
Sentence cadence in dialogue tags (match the narrative rhythm)
Emotional opacity setting (internalized vs externalized reactions)
Enhancements:
Replace generic dialogue with character-specific phrasing
Add action beats during conversations
Vary dialogue tags (not all "said")
Ensure distinct voices (no characters sound the same)
Remove unnecessary exposition
Add natural interruptions, pauses, subtext
Maintain voice texture in dialogue framing ⭐ NEW
Agent 2C: Sensory Detail Injector
Type: Synchronous (runs after Dialogue Enhancer)
Dependencies: Agent 2B, Agent 1G (voice anchor) ⭐ NEW
Input: Scene prose + setting atmosphere guide + Narrative Voice Anchor
Output: Scene with rich sensory details Responsibilities:
Add sight, sound, smell, touch, taste details
Include weather and time-of-day ambiance
Add character's physical sensations
Incorporate environmental storytelling
Ensure details match setting guidelines
Avoid purple prose (balance is key)
Match metaphor density from voice anchor ⭐ NEW
Complexity: LOW Voice-Aware Detail Injection: The level and style of sensory detail must match:
Metaphor density (low = literal descriptions, high = figurative language)
Prose texture (plain = functional details, lyrical = poetic details)
Allowed stylization (low = straightforward, high = creative)
Example Transformation:

BEFORE: "She walked into the forest."

WITH VOICE ANCHOR (cinematic, medium metaphor, playful humor):
"Branches clawed at her jacket as she pushed deeper into the forest. 
The air hung thick with the scent of damp earth and rotting leaves—
nature's way of saying 'welcome, you're probably going to regret this.' 
Above, wind hissed through the canopy, but down here? Nothing moved."
Agent 2D: Chapter Assembler
Type: Synchronous
Dependencies: Agent 2C (all scenes complete)
Input: All scenes for a chapter
Output: Complete assembled chapter Responsibilities:
Combine all scenes into cohesive chapter
Smooth transitions between scenes
Add scene breaks or white space as needed
Implement opening beat (from blueprint)
Implement closing beat (from blueprint)
Ensure unified tone and pacing throughout
Verify chapter meets word count targets
Complexity: LOW-MEDIUM Assembling Logic:
Opening beat → Scene 1 → Scene 2 → ... → Scene N → Closing beat
Add transition paragraphs between scenes if needed
Ensure time transitions are clear
Maintain narrative momentum
Check for pacing issues (too fast/slow)
Agent 2E: Transition Specialist
Type: Synchronous
Dependencies: Agent 2D (current + previous chapter)
Input: Chapter N-1 and Chapter N
Output: Revised opening of Chapter N Responsibilities:
Review how Chapter N picks up from Chapter N-1
Revise opening paragraph if needed for smooth flow
Ensure time gap is clear (if any)
Maintain emotional continuity or intentional shift
Verify cliffhanger resolution (if applicable)
Check for jarring transitions
Complexity: LOW Evaluation Criteria:
Does the opening acknowledge where we left off?
Is time passage clear?
Does it honor the previous chapter's ending tone?
Does it pull reader forward naturally?
Phase 3: Quality Control (5 Agents)
Agent 3A: Continuity Guardian
Type: Synchronous (runs after each chapter)
Dependencies: Agent 2E
Input: Newly written chapter + all previous chapters + canon database
Output: Continuity report + updated canon database Responsibilities:
Check for factual contradictions with previous chapters
Verify character consistency (traits, voice, appearance)
Ensure world rule adherence
Track established facts (canon database)
Flag inconsistencies with severity rating
Suggest fixes for issues found
Update canon database with new facts (write access) ⭐ See Section 8
Complexity: MEDIUM Canon Database:

{
  characters: Record<string, {
    appearance: string[],
    traits: string[],
    relationships: Record<string, string>,
    facts: string[]
  }>,
  worldFacts: string[],
  plotEvents: string[],
  locations: Record<string, string[]>,
  timeline: Array<{ chapter: number, event: string, timestamp: string }>
}
Issue Detection:
Character eye color changed
Magic system rule violated
Timeline inconsistency
Character knows something they shouldn't
Setting detail contradicts earlier description
Canon Mutation Authority: See Section 8 for governance rules ⭐ NEW Quality Gate Logic: See Section 7 for blocking thresholds
Agent 3B: Pacing Analyzer
Type: Synchronous
Dependencies: Agent 2D
Input: Complete chapter + target pacing from 1B
Output: Pacing analysis + recommendations Responsibilities:
Analyze chapter pacing against target tension level
Check sentence rhythm variety
Identify sections that drag or rush
Verify action/reflection balance
Ensure cliffhanger effectiveness (if applicable)
Recommend cuts or expansions
Complexity: MEDIUM Analysis Metrics:
Actual tension level (1-10)
Sentence length variance
Action vs reflection ratio
Dialogue vs narration ratio
Paragraph length patterns
Climax placement within chapter
Output:

{
  actualTensionLevel: number,
  targetTensionLevel: number,
  variance: number,
  pacingIssues: Array<{
    location: string, // paragraph range
    issue: string,
    severity: 'minor' | 'moderate' | 'major',
    recommendation: string
  }>,
  sentenceRhythmScore: number,
  overallAssessment: string
}
Quality Gate Logic: See Section 7 for blocking thresholds
Agent 3C: Foreshadowing Tracker
Type: Asynchronous (runs on full manuscript)
Dependencies: All chapters written
Input: Complete manuscript + plot structure
Output: Foreshadowing report Responsibilities:
Identify planted seeds and hints
Verify payoffs exist for setups
Track Chekhov's guns
Ensure mystery clues are present
Flag orphaned setups (no payoff)
Recommend additions for better foreshadowing
Complexity: MEDIUM Tracking:

{
  plantedSeeds: Array<{
    element: string,
    plantedInChapter: number,
    shouldPayOffBy: number,
    actualPayoff?: { chapter: number, quality: 'weak' | 'good' | 'strong' },
    status: 'GOOD' | 'MISSING' | 'WEAK'
  }>,
  chekhovsGuns: Array<{
    item: string,
    introducedChapter: number,
    used: boolean,
    usedInChapter?: number,
    status: 'SATISFIED' | 'UNFIRED'
  }>,
  recommendations: string[]
}
Agent 3D: Subplot Weaver
Type: Asynchronous (runs on full manuscript)
Dependencies: All chapters written
Input: Complete manuscript + character arcs
Output: Subplot continuity report Responsibilities:
Track subplot threads throughout book
Ensure subplots don't disappear for too long
Verify subplot resolution
Check subplot-to-main-plot connections
Identify neglected threads
Recommend additions to maintain subplot presence
Complexity: LOW Tracking:

{
  subplots: Array<{
    name: string,
    chapters: number[], // Where it appears
    maxGap: number, // Longest absence
    resolved: boolean,
    resolutionChapter?: number,
    status: 'ACTIVE' | 'NEGLECTED' | 'RESOLVED' | 'DROPPED'
  }>,
  issues: Array<{
    subplot: string,
    issue: string,
    recommendation: string
  }>
}
Agent 3E: Opening Hook Specialist
Type: Synchronous
Dependencies: Chapter 1 complete
Input: Chapter 1
Output: Revised opening paragraph/page Responsibilities:
Ensure Chapter 1 opens with compelling hook
Check for immediate engagement (first paragraph)
Verify inciting incident timing (within first chapter)
Remove unnecessary throat-clearing
Ensure voice is established immediately
Optimize first sentence for impact
Complexity: LOW Hook Types (genre-specific):
Action: Drop into exciting scene
Mystery: Present intriguing question
Character: Show unique voice/perspective
Atmosphere: Establish vivid world
Dialogue: Start with compelling conversation
Phase 4: Final Editing (4 Agents)
Agent 4A: Developmental Editor
Type: Asynchronous (full manuscript pass)
Dependencies: All chapters + QC agents
Input: Complete manuscript + all reports
Output: Structural edit recommendations Responsibilities:
Big-picture structural assessment
Plot hole detection
Character arc consistency check
Pacing issues across full book
Theme reinforcement suggestions
Scene ordering recommendations
Chapter break optimization
Complexity: HIGH Assessment Areas:
Overall story structure (3-act adherence)
Character development arcs (satisfying progression?)
Plot coherence (all threads resolved?)
Pacing curve (proper escalation?)
Thematic consistency (themes reinforced?)
Emotional payoff (cathartic moments?)
Output:

{
  structuralIssues: Array<{
    type: 'plot-hole' | 'pacing' | 'character' | 'theme',
    severity: 'minor' | 'moderate' | 'major',
    location: string,
    description: string,
    recommendation: string
  }>,
  overallAssessment: string,
  strengths: string[],
  revisionPriorities: string[]
}
Revision Logic: See Section 7 for iteration strategy
Agent 4B: Prose Polish Agent
Type: Asynchronous (can parallelize by chapter)
Dependencies: Agent 4A, Agent 1G (voice anchor) ⭐ NEW
Input: Individual chapters + Narrative Voice Anchor
Output: Polished prose Responsibilities:
Line-level prose improvements
Sentence variety enhancement
Word choice optimization
Redundancy removal
Show-don't-tell improvements
Reading level verification
Flow optimization
CRITICAL: Preserve voice anchor at all times ⭐ NEW
Complexity: MEDIUM Voice Preservation Priority: This agent is the most likely to accidentally homogenize voice. It MUST:
Check every edit against voice anchor before applying
Never smooth intentional stylistic choices
Preserve cadence, texture, and humor baseline
Flag conflicts instead of "correcting" them
Improvements:
Replace weak verbs with strong verbs
Vary sentence structure (short, medium, long)
Remove filter words ("saw", "felt", "heard")
Eliminate redundant phrases
Strengthen descriptions
Tighten dialogue
Remove unnecessary adverbs
BUT: Only if changes maintain voice ⭐ NEW
Example of Voice-Aware Polish:

ORIGINAL (matches voice anchor - playful, fragments, mixed cadence):
"The door opened. Slowly. Too slowly. Elena held her breath."

BAD POLISH (smooths away voice):
"The door opened slowly while Elena held her breath."

GOOD POLISH (preserves voice, improves word choice):
"The door creaked open. Slowly. Painfully slowly. Elena held her breath."
Multi-Pass Logic: See Section 7 for iteration strategy
Agent 4C: Cliffhanger Optimizer
Type: Asynchronous (can parallelize by chapter)
Dependencies: Agent 4B
Input: Chapter endings
Output: Optimized chapter endings Responsibilities:
Review all chapter endings
Strengthen cliffhangers where appropriate
Ensure momentum carries to next chapter
Vary cliffhanger types (not all action-based)
Balance tension and release
Optimize final sentences
Complexity: LOW Cliffhanger Types:
Revelation: "She opened the door and gasped."
Decision: "He had to choose—now."
Danger: "The footsteps were getting closer."
Emotional: "Everything she believed was a lie."
Question: "But why would he lie about something like that?"
Agent 4D: Final Consistency Validator
Type: Synchronous (final pass)
Dependencies: Agent 4C, Agent 1G (voice anchor) ⭐ NEW
Input: Complete polished manuscript + Narrative Voice Anchor
Output: Final quality report Responsibilities:
Last-pass consistency check
Grammar and typo detection
Formatting verification
Canon database final check
Genre compliance verification
User requirements adherence check
Voice compliance verification ⭐ NEW
Quality score generation
Complexity: LOW-MEDIUM Final Checklist:
✅ All plot threads resolved
✅ Character arcs complete
✅ No contradictions
✅ Word count within range
✅ Genre conventions met
✅ Tone consistent
✅ User requirements satisfied
✅ Reading level appropriate
✅ Voice consistent across all chapters ⭐ NEW
Voice Compliance Check (NEW):

voiceComplianceReport: {
  earlyChaptersScore: number, // 0-10 - how well Ch 1-3 match anchor
  midChaptersScore: number, // 0-10 - how well Ch 4-7 match anchor
  lateChaptersScore: number, // 0-10 - how well Ch 8+ match anchor
  
  driftDetected: boolean,
  driftAmount: number, // 0-1 (0 = no drift, 1 = severe drift)
  driftLocations: Array<{
    chapter: number,
    issue: string,
    example: string
  }>,
  
  overallVoiceConsistency: number, // 0-1 score
  
  specificViolations: Array<{
    parameter: string, // e.g., "sentenceCadence"
    expected: string, // e.g., "mixed"
    actual: string, // e.g., "all long sentences"
    chapters: number[]
  }>
}
Pass Criteria:
Voice consistency score ≥ 0.85 = PASS
Voice consistency score 0.70-0.84 = PASS WITH WARNING
Voice consistency score < 0.70 = FLAG FOR REVIEW
Output:

{
  qualityScore: number, // 0-100
  voiceConsistencyScore: number, // 0-1 ⭐ NEW
  issuesFound: Array<{
    type: string,
    severity: string,
    location: string,
    description: string
  }>,
  metricsReport: {
    finalWordCount: number,
    chapterCount: number,
    averageChapterLength: number,
    uniqueCharacters: number,
    settingCount: number
  },
  requirementsCheck: {
    genre: 'MET' | 'PARTIAL' | 'FAILED',
    audience: 'MET' | 'PARTIAL' | 'FAILED',
    tone: 'MET' | 'PARTIAL' | 'FAILED',
    length: 'MET' | 'PARTIAL' | 'FAILED',
    voice: 'MET' | 'PARTIAL' | 'FAILED', // ⭐ NEW
    userMustHaves: Array<{ requirement: string, status: boolean }>
  },
  readyForDelivery: boolean
}
4. Execution Flow & Dependencies
### 4.1 Phase Diagram

USER INPUT
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 0: INPUT PROCESSING (Sequential)                     │
├─────────────────────────────────────────────────────────────┤
│ 0A. User Input Compiler                                    │
│     ↓                                                       │
│ 0B. Parameter Gap Filler                                   │
│     ↓                                                       │
│ [USER APPROVAL GATE if gaps detected]                      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: STORY ARCHITECTURE (Partially Parallel)           │
├─────────────────────────────────────────────────────────────┤
│ 1A. Master Plot Architect                                  │
│     ↓                                                       │
│     ├──→ 1B. Plot-to-Chapter Distributor                  │
│     │                                                       │
│     └──→ 1C. Character Blueprint Agent                    │
│               ↓                                             │
│          1D. Character Arc Mapper ←────┐                  │
│               ↓                         │                  │
│          1E. World & Setting Designer ──┘                  │
│               ↓                                             │
│          1F. Chapter Blueprint Agent (uses 1B,1D,1E)       │
│               ↓                                             │
│          1G. Narrative Voice Architect (uses 1A,1C) ⭐ NEW │
│               ↓                                             │
│     [USER APPROVAL GATE - review complete structure]      │
│     (Structure includes voice anchor preview)              │
└─────────────────────────────────────────────────────────────┘
    ↓
    [CHECKPOINT: Structure Approved] ⭐ See Section 9
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: PROSE GENERATION (Sequential by chapter,          │
│          Parallel within chapter) + QC PER CHAPTER          │
├─────────────────────────────────────────────────────────────┤
│ FOR EACH CHAPTER (Chapter 1 → Chapter N):                 │
│                                                             │
│   [CHECKPOINT: Chapter N Start] ⭐ See Section 9           │
│                                                             │
│   2A. Scene Writer (parallel for scenes 1-N)              │
│       ↓ (receives voice anchor)                            │
│       ↓ [Quality check → Retry if needed]                 │
│   2B. Dialogue Enhancer (receives voice anchor)           │
│       ↓                                                     │
│   2C. Sensory Detail Injector (receives voice anchor)     │
│       ↓                                                     │
│   2D. Chapter Assembler                                    │
│       ↓                                                     │
│   2E. Transition Specialist (needs previous chapter)       │
│       ↓                                                     │
│   3A. Continuity Guardian                                  │
│       ↓ [Quality gate → Block if critical issues]         │
│       ↓ [Updates canon database - WRITE ACCESS]           │
│   3B. Pacing Analyzer                                      │
│       ↓ [Quality gate → Block if critical issues]         │
│       ↓                                                     │
│   IF BLOCKED: Rewrite chapter with feedback               │
│   IF PASSED: Save chapter → Next Chapter                  │
│                                                             │
│   [CHECKPOINT: Chapter N Complete] ⭐ See Section 9        │
│                                                             │
│ [Mid-Generation Review Gate - based on review preset]     │
│   - Author-Mode: Every 3 chapters                          │
│   - Collaborative: Every 5 chapters (optional)             │
│   - Others: Skip                                           │
└─────────────────────────────────────────────────────────────┘
    ↓
    [CHECKPOINT: All Chapters Written] ⭐ See Section 9
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: QUALITY CONTROL (Full Manuscript)                 │
├─────────────────────────────────────────────────────────────┤
│ (Parallel execution)                                        │
│ ├─→ 3C. Foreshadowing Tracker                             │
│ ├─→ 3D. Subplot Weaver                                    │
│ └─→ 3E. Opening Hook Specialist                           │
│     ↓ (all complete)                                        │
│ 4A. Developmental Editor (uses QC reports)                 │
│     ↓ [Apply fixes → Iterate if needed]                   │
│     ↓ [Request approval for major fixes if preset allows] │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: FINAL EDITING (Parallel by chapter)               │
├─────────────────────────────────────────────────────────────┤
│ 4B. Prose Polish Agent (parallel, receives voice anchor)  │
│     ↓ [Multi-pass until quality threshold]                │
│     ↓ [MUST preserve voice anchor]                        │
│ 4C. Cliffhanger Optimizer (parallel on all chapters)      │
│     ↓                                                       │
│ 4D. Final Consistency Validator (full manuscript)          │
│     ↓ [Includes voice compliance check]                    │
│     ↓ [Pass/Fail with delivery option]                    │
└─────────────────────────────────────────────────────────────┘
    ↓
    [CHECKPOINT: Final] ⭐ See Section 9
    ↓
COMPLETE BOOK DELIVERED
### 4.2 Dependency Matrix
Agent	Depends On	Can Run in Parallel With	Blocks	Quality Gate	Voice Access
0A	None	None	0B	No	-
0B	0A	None	Phase 1	No	-
1A	0B	None	1B, 1C	No	-
1B	1A	1C	1F	No	-
1C	1A	1B	1D, 1G	No	-
1D	1B, 1C	1E	1F	No	-
1E	1A, 1B	1D	1F	No	-
1F	1B, 1D, 1E	1G	Phase 2	No	-
1G ⭐	1A, 1C	1F	Phase 2	No	Creates
2A	1F, 1G, prev scene	Other scenes	2B	Retry	Read
2B	2A, 1G	None	2C	No	Read
2C	2B, 1G	None	2D	No	Read
2D	2C	None	2E	No	-
2E	2D, prev ch	None	3A, 3B	No	-
3A	2E	3B	Gate	Block	-
3B	2E	3A	Gate	Block	-
3C	All chapters	3D, 3E	4A	No	-
3D	All chapters	3C, 3E	4A	No	-
3E	Chapter 1	3C, 3D	4A	No	-
4A	3C, 3D, 3E	None	4B, 4C	Iterate	-
4B	4A, 1G	Other chs	4D	Multi-pass	Read
4C	4B	Other chs	4D	No	-
4D	4C, 1G	None	Complete	Pass/Fail	Validate
### 4.3 Execution Time Estimates (30K-word book)
Phase	Agents	Sequential Time	Parallel Time	With Quality Gates
Phase 0	0A-0B	~3 min	~3 min	~3 min
Phase 1	1A-1G	~17 min	~12 min	~12 min (+voice architect)
Phase 2	2A-3B × 10 ch	~60 min	~45 min	~50 min (+10% retries)
Phase 3	3C-4A	~8 min	~5 min	~6 min
Phase 4	4B-4D	~12 min	~8 min	~13 min (+multi-pass)
TOTAL		~100 min	~73 min	~84 min
5. Database Schema
### 5.1 New Tables (book_writer schema)

-- Core project tracking
CREATE TABLE book_writer.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  org_slug TEXT NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id),
  
  -- Project metadata
  title TEXT,
  working_title TEXT,
  status TEXT NOT NULL DEFAULT 'initializing', 
    -- 'initializing', 'planning', 'writing', 'editing', 'completed', 'failed', 'paused' ⭐ NEW
  
  -- User input (stored as JSON)
  user_config JSONB NOT NULL,
  narrative_prd JSONB,
  
  -- Voice anchor ⭐ NEW
  narrative_voice_anchor JSONB,
  
  -- Review preset ⭐ NEW
  review_preset TEXT DEFAULT 'collaborative',
  
  -- Progress tracking
  current_phase TEXT,
  current_chapter INTEGER,
  total_chapters INTEGER,
  
  -- Resume metadata ⭐ NEW (See Section 9)
  last_checkpoint TEXT,
  last_checkpoint_at TIMESTAMPTZ,
  can_resume BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ, -- ⭐ NEW
  
  -- Execution context
  execution_context JSONB
);

-- Story structure storage
CREATE TABLE book_writer.story_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  structure_type TEXT NOT NULL, -- 'plot', 'chapter_distribution', 'voice_anchor' ⭐ NEW
  structure_data JSONB NOT NULL,
  
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chapter storage
CREATE TABLE book_writer.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  chapter_number INTEGER NOT NULL,
  title TEXT,
  summary TEXT,
  
  -- Blueprint (plan)
  blueprint JSONB,
  
  -- Content
  content TEXT,
  word_count INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', 
    -- 'pending', 'planning', 'writing', 'editing', 'completed'
  
  -- Voice compliance tracking ⭐ NEW
  voice_compliance_score NUMERIC(3,2), -- 0.00 to 1.00
  
  -- Checkpoint tracking ⭐ NEW
  checkpoint_version INTEGER DEFAULT 1,
  last_checkpoint_at TIMESTAMPTZ,
  
  -- Metadata
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  UNIQUE(project_id, chapter_number)
);

-- Scene storage (granular)
CREATE TABLE book_writer.scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES book_writer.chapters(id) ON DELETE CASCADE,
  
  scene_number INTEGER NOT NULL,
  content TEXT,
  word_count INTEGER,
  
  -- Context
  pov_character TEXT,
  location TEXT,
  purpose TEXT,
  
  -- Quality tracking
  quality_score NUMERIC(3,1), -- 0.0 to 10.0
  retry_attempts INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(chapter_id, scene_number)
);

-- Character management
CREATE TABLE book_writer.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'protagonist', 'antagonist', 'supporting'
  
  -- Profile data
  traits_json JSONB,
  arc_json JSONB,
  voice_notes TEXT,
  
  -- Consistency rules
  consistency_rules JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, name)
);

-- World facts (canon database)
CREATE TABLE book_writer.world_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  category TEXT NOT NULL, -- 'setting', 'magic', 'culture', 'timeline', 'misc'
  fact_key TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  
  -- Metadata
  locked BOOLEAN DEFAULT FALSE, -- Cannot be changed
  source_agent TEXT, -- Which agent created this
  source_chapter INTEGER, -- When it was established
  
  -- Canon governance ⭐ NEW (See Section 8)
  mutation_log JSONB, -- History of changes
  last_mutated_by TEXT,
  last_mutated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, fact_key)
);

-- Character relationships
CREATE TABLE book_writer.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  character_a_id UUID NOT NULL REFERENCES book_writer.characters(id) ON DELETE CASCADE,
  character_b_id UUID NOT NULL REFERENCES book_writer.characters(id) ON DELETE CASCADE,
  
  relationship_type TEXT NOT NULL, -- 'family', 'friend', 'enemy', 'romantic', etc.
  dynamics_json JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, character_a_id, character_b_id)
);

-- Agent execution tracking
CREATE TABLE book_writer.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  agent_type TEXT NOT NULL, -- '0A', '1B', '2A', '1G', etc.
  agent_name TEXT NOT NULL,
  
  -- Input/output
  input_state JSONB,
  output_state JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  error TEXT,
  
  -- Performance
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent outputs (versioning)
CREATE TABLE book_writer.agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES book_writer.agent_executions(id) ON DELETE CASCADE,
  
  output_type TEXT NOT NULL, -- 'plot_structure', 'character_profile', 'scene_prose', 'voice_anchor', etc.
  content JSONB,
  
  version INTEGER NOT NULL DEFAULT 1,
  approved BOOLEAN DEFAULT FALSE,
  feedback TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User approvals
CREATE TABLE book_writer.user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  approval_type TEXT NOT NULL, -- 'parameter_gap', 'structure', 'chapter', 'voice_anchor', etc.
  content_id UUID, -- Reference to what needs approval
  
  approved BOOLEAN,
  feedback TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Locked elements (cannot be changed)
CREATE TABLE book_writer.locked_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  element_type TEXT NOT NULL, -- 'character_name', 'plot_point', 'world_rule', 'voice_parameter', etc.
  element_id TEXT NOT NULL,
  
  lock_reason TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quality control reports
CREATE TABLE book_writer.qc_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  report_type TEXT NOT NULL, -- 'continuity', 'pacing', 'foreshadowing', 'voice_compliance', etc.
  agent_type TEXT NOT NULL,
  
  report_data JSONB NOT NULL,
  issues_found INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checkpoints ⭐ NEW (See Section 9)
CREATE TABLE book_writer.checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  
  checkpoint_name TEXT NOT NULL, -- 'structure_approved', 'chapter_3_complete', etc.
  checkpoint_phase TEXT NOT NULL, -- 'phase_1', 'phase_2', etc.
  
  -- State snapshot
  state_snapshot JSONB NOT NULL,
  completed_chapters INTEGER,
  
  -- LangGraph checkpoint reference
  langgraph_checkpoint_id TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, checkpoint_name)
);

-- Canon mutation audit log ⭐ NEW (See Section 8)
CREATE TABLE book_writer.canon_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  world_fact_id UUID REFERENCES book_writer.world_facts(id) ON DELETE SET NULL,
  
  mutation_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  agent_type TEXT NOT NULL, -- Which agent made the change
  
  old_value TEXT,
  new_value TEXT,
  
  chapter_number INTEGER, -- When this mutation occurred
  
  reversible BOOLEAN DEFAULT TRUE,
  reversed BOOLEAN DEFAULT FALSE,
  reversed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user ON book_writer.projects(user_id);
CREATE INDEX idx_projects_conversation ON book_writer.projects(conversation_id);
CREATE INDEX idx_projects_status ON book_writer.projects(status);
CREATE INDEX idx_chapters_project ON book_writer.chapters(project_id);
CREATE INDEX idx_chapters_status ON book_writer.chapters(status);
CREATE INDEX idx_scenes_chapter ON book_writer.scenes(chapter_id);
CREATE INDEX idx_characters_project ON book_writer.characters(project_id);
CREATE INDEX idx_world_facts_project ON book_writer.world_facts(project_id);
CREATE INDEX idx_world_facts_category ON book_writer.world_facts(category);
CREATE INDEX idx_agent_executions_project ON book_writer.agent_executions(project_id);
CREATE INDEX idx_qc_reports_project ON book_writer.qc_reports(project_id);
CREATE INDEX idx_checkpoints_project ON book_writer.checkpoints(project_id);
CREATE INDEX idx_canon_mutations_project ON book_writer.canon_mutations(project_id);
CREATE INDEX idx_canon_mutations_fact ON book_writer.canon_mutations(world_fact_id);
### 5.2 Integration with Existing Tables

-- Conversations (already exists)
-- book_writer.projects references this via conversation_id

-- Tasks (already exists in public schema)
CREATE TABLE book_writer.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES book_writer.projects(id) ON DELETE CASCADE,
  public_task_id UUID REFERENCES public.tasks(id),
  
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deliverables (final output)
-- When book is complete, create deliverable in public.deliverables
-- Content type: 'book'
-- Content format: 'markdown' or 'docx'
6. UI/UX Design
[UI section remains largely the same, with these additions:]
### 6.2 Tab 2: Structure (StructureReviewView.vue)
Updated to include Voice Anchor preview:

┌────────────────────────────────────────────────────────┐
│  Story Structure - Ready for Your Approval             │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📖 "The Last Guardian" (Working Title)                │
│                                                        │
│  ... (plot, characters, world as before) ...          │
│                                                        │
│  ─────────────────────────────────────────────────────│
│                                                        │
│  ✨ Narrative Voice Preview ⭐ NEW                     │
│                                                        │
│  Your book will be written in this voice:             │
│                                                        │
│  📝 Style: Cinematic, playful                          │
│  🎭 Distance: Close (deep into character's head)       │
│  💬 Cadence: Mixed (variety for rhythm)                │
│  😄 Humor: Playful touches                             │
│                                                        │
│  Sample passage in your book's voice:                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Elena pressed her ear against the door. Nothing. │ │
│  │ Just the old house settling, probably. Probably. │ │
│  │ She reached for the knob—cold against her palm— │ │
│  │ and twisted. The hinges groaned. Of course they  │ │
│  │ did. Because sneaking around was so much easier  │ │
│  │ when everything decided to announce your         │ │
│  │ presence...                                      │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  [Preview More Examples]                               │
│                                                        │
│  ─────────────────────────────────────────────────────│
│                                                        │
│  Does this structure match your vision?                │
│                                                        │
│  [Request Changes]         [Approve & Start Writing →]│
│                                                        │
└────────────────────────────────────────────────────────┘
### 6.3 Tab 3: Writing (WritingProgressView.vue)
Updated to show voice compliance:

┌────────────────────────────────────────────────────────┐
│  Writing in Progress... (Chapter 5 of 12)              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ... (progress bars as before) ...                     │
│                                                        │
│  ─────────────────────────────────────────────────────│
│                                                        │
│  📊 Voice Consistency: ✅ 94% ⭐ NEW                    │
│                                                        │
│  Recently Completed:                                   │
│                                                        │
│  ✅ Chapter 4 "The Betrayal" (3,421 words)             │
│     Voice match: 96% ✅                                │
│     [Preview] [Edit]                                   │
│                                                        │
│  ✅ Chapter 3 "First Lesson" (3,112 words)             │
│     Voice match: 92% ✅                                │
│     [Preview] [Edit]                                   │
│                                                        │
│  ─────────────────────────────────────────────────────│
│                                                        │
│  [Pause] [Cancel] [Save Checkpoint] ⭐ NEW             │
│                                                        │
└────────────────────────────────────────────────────────┘
### 6.4 Tab 4: Quality (QualityReportsView.vue)
Updated to include voice compliance report:

┌────────────────────────────────────────────────────────┐
│  Quality Control Reports                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ✅ Continuity Check: PASSED                           │
│  ⚠️  Pacing Analysis: 2 ISSUES                          │
│  ✅ Foreshadowing: GOOD                                │
│  ⚠️  Subplot Tracking: 1 ISSUE                          │
│  ✅ Opening Hook: STRONG                               │
│                                                        │
│  ✅ Voice Consistency: 91% ⭐ NEW                       │
│     All chapters maintain the narrative voice.         │
│     Minor deviation in Ch 8 (corrected in polish).     │
│                                                        │
│  ─────────────────────────────────────────────────────│
│                                                        │
│  Overall Quality Score: 89/100                         │
│  Status: Good - Minor improvements recommended         │
│                                                        │
│  [Apply Auto-Fixes]  [Manual Review]  [Proceed to Edit]│
│                                                        │
└────────────────────────────────────────────────────────┘
### 6.8 Resume Functionality ⭐ NEW (See Section 9)
Project list view shows resumable projects:

┌────────────────────────────────────────────────────────┐
│  Your Book Projects                                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📖 "The Last Guardian" (Middle-Grade Fantasy)         │
│     Status: In Progress - Chapter 7 of 12              │
│     Last worked on: 2 hours ago                        │
│     [Resume Writing →]                                 │
│                                                        │
│  📖 "Starship Exile" (YA Sci-Fi)                       │
│     Status: Paused - Awaiting Structure Approval       │
│     Last worked on: Yesterday                          │
│     [Review Structure →]                               │
│                                                        │
│  📖 "Mystery Manor" (Children's Mystery)               │
│     Status: Complete                                   │
│     Completed: 3 days ago                              │
│     [View Book] [Export]                               │
│                                                        │
└────────────────────────────────────────────────────────┘
7. Quality Assurance & Revision Strategy
[This section remains the same as the previous version, no changes needed]
8. Canon Governance & Consistency Management ⭐ NEW
### 8.1 Overview
The canon database is the single source of truth for all established facts in the book. Without strict governance, multiple agents could introduce contradictions or drift. This section defines who can mutate canon, when, and how.
### 8.2 Canon Governance Philosophy
Core Principles:
Single Writer - Only one agent (3A: Continuity Guardian) can write to canon
Many Readers - All prose agents read canon, none mutate it
Deterministic Changes - Canon mutations are logged and reversible
Explicit Conflicts - Agents flag conflicts, don't resolve them implicitly
User Override - Users can manually lock/unlock canon elements
### 8.3 Canon Write Access Rules
Only Agent 3A (Continuity Guardian) Can Write Canon
Why this agent?
Runs after each chapter (early detection)
Has context of all previous chapters
Explicitly designed for consistency checking
Already detecting conflicts - natural to also resolve them
What other agents DO instead:
Agent	Canon Access	What They Do If Conflict Detected
2A (Scene Writer)	Read-only	Generate prose based on current canon; don't mutate
2B (Dialogue Enhancer)	Read-only	Flag conflict if dialogue contradicts canon
2C (Sensory Detail Injector)	Read-only	Check setting details against canon
2D (Chapter Assembler)	Read-only	Verify assembled chapter matches canon
3A (Continuity Guardian)	Read-Write	Detect conflicts, update canon, log changes
4B (Prose Polish Agent)	Read-only	Never mutate facts during polish
4D (Final Validator)	Read-only	Verify final consistency against canon
### 8.4 Canon Mutation Workflow
Step 1: Detection (During Chapter Writing)
When Agent 2A (Scene Writer) generates a scene:
It reads current canon
It generates prose
If prose introduces NEW facts → flags them for canon review
If prose contradicts EXISTING canon → retry or flag error
Example:

// Chapter 3, Scene Writer generates:
"Elena's eyes were green, just like her mother's."

// Canon database currently says:
{ "Elena.eyeColor": "blue" }

// Scene Writer detects mismatch
// DOES NOT mutate canon
// Instead: Flags issue for Agent 3A
Step 2: Continuity Guardian Reviews (Agent 3A)
After the chapter is assembled:
Agent 3A runs continuity check
Compares new chapter against canon database
Detects conflicts and new facts
For conflicts:

conflictDetected: {
  fact: "Elena.eyeColor",
  canonValue: "blue",
  newValue: "green",
  chapter: 3,
  severity: "critical"
}
Resolution logic:
If severity is critical → Block chapter, request rewrite
If severity is moderate → Log conflict, optionally auto-correct prose
If severity is minor → Log warning, allow to proceed
For new facts:

newFactDetected: {
  fact: "Mr. Ashford.occupation",
  value: "retired librarian",
  chapter: 3,
  confidence: "high"
}
Addition logic:
If confidence is high → Add to canon automatically
If confidence is medium → Log for review
If confidence is low → Flag for user approval
Step 3: Canon Mutation (Agent 3A Only)
When Agent 3A decides to update canon:

async function updateCanon(
  projectId: string,
  factKey: string,
  newValue: string,
  chapter: number,
  reason: string
): Promise<void> {
  
  // Read current value
  const currentFact = await db.getWorldFact(projectId, factKey);
  
  // Log mutation
  await db.insertCanonMutation({
    projectId,
    worldFactId: currentFact?.id,
    mutationType: currentFact ? 'update' : 'create',
    agentType: '3A',
    oldValue: currentFact?.fact_value,
    newValue,
    chapter,
    reversible: true
  });
  
  // Update canon
  await db.upsertWorldFact({
    projectId,
    factKey,
    factValue: newValue,
    sourceAgent: '3A',
    sourceChapter: chapter,
    lastMutatedBy: '3A',
    lastMutatedAt: new Date()
  });
  
  // Emit observability event
  await observability.emitProgress(ctx, taskId, `Canon updated: ${factKey}`, {
    metadata: {
      type: 'canon_updated',
      factKey,
      oldValue: currentFact?.fact_value,
      newValue,
      chapter
    }
  });
}
### 8.5 Canon Mutation Audit Trail
Every canon change is logged in book_writer.canon_mutations:

SELECT 
  mutation_type,
  agent_type,
  old_value,
  new_value,
  chapter_number,
  created_at
FROM book_writer.canon_mutations
WHERE project_id = :projectId
ORDER BY created_at DESC;
Example audit trail:

| Type   | Agent | Old Value | New Value | Chapter | Time |
|--------|-------|-----------|-----------|---------|------|
| create | 3A    | NULL      | "retired librarian" | 3 | 10:23:15 |
| update | 3A    | "blue"    | "green"   | 5 | 10:45:32 |
| delete | 3A    | "ancient relic" | NULL | 7 | 11:02:11 |
### 8.6 Canon Reversal (Undo)
If a canon mutation causes downstream issues:

async function reverseCanonMutation(mutationId: string): Promise<void> {
  const mutation = await db.getCanonMutation(mutationId);
  
  if (!mutation.reversible) {
    throw new Error('Mutation is not reversible');
  }
  
  if (mutation.mutationType === 'create') {
    // Delete the fact
    await db.deleteWorldFact(mutation.worldFactId);
  } else if (mutation.mutationType === 'update') {
    // Restore old value
    await db.updateWorldFact(mutation.worldFactId, mutation.oldValue);
  } else if (mutation.mutationType === 'delete') {
    // Recreate the fact
    await db.createWorldFact({
      projectId: mutation.projectId,
      factKey: mutation.factKey,
      factValue: mutation.oldValue
    });
  }
  
  // Mark as reversed
  await db.updateCanonMutation(mutationId, { 
    reversed: true, 
    reversedAt: new Date() 
  });
}
### 8.7 User Canon Overrides
Users can manually lock canon elements to prevent AI changes: UI for Canon Management:

┌────────────────────────────────────────────────────────┐
│  Canon Database (Established Facts)                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  🔒 LOCKED (Cannot be changed by AI)                   │
│  • Elena's eye color: blue                             │
│  • Magic requires sacrifice                            │
│  • Mr. Ashford's true identity                         │
│                                                        │
│  🔓 UNLOCKED (AI can update if needed)                 │
│  • School mascot: Eagles                               │
│  • Elena's favorite food: pizza                        │
│  • Library founded: 1887                               │
│                                                        │
│  [Lock Selected] [Unlock Selected] [Add Manual Entry]  │
│                                                        │
└────────────────────────────────────────────────────────┘
Locked elements are stored in book_writer.locked_elements:

INSERT INTO book_writer.locked_elements (
  project_id, 
  element_type, 
  element_id, 
  lock_reason
) VALUES (
  :projectId,
  'world_rule',
  'Elena.eyeColor',
  'User explicitly set'
);
Agent 3A checks locks before mutation:

async function canMutateCanon(projectId: string, factKey: string): Promise<boolean> {
  const isLocked = await db.isElementLocked(projectId, 'world_rule', factKey);
  return !isLocked;
}
### 8.8 Consistency Budget ⭐ NEW (Optional Enhancement)
Track consistency as a score instead of binary pass/fail:

interface ConsistencyBudget {
  startingPoints: 100,
  currentPoints: number,
  
  deductions: Array<{
    chapter: number,
    issue: string,
    severity: 'minor' | 'moderate' | 'critical',
    pointsDeducted: number
  }>,
  
  threshold: {
    critical: 50, // Below this = block
    warning: 75, // Below this = flag
  }
}
How it works:
Each chapter starts with 100 consistency points
Minor violations deduct 5 points
Moderate violations deduct 15 points
Critical violations deduct 30 points
Below threshold → trigger quality gate
Benefits:
Quantifies consistency drift
Allows small issues without blocking
Provides user-facing metric
Helps debug regressions
Implementation:

async function evaluateChapterConsistency(
  chapter: ChapterContent,
  canon: CanonDatabase,
  budget: ConsistencyBudget
): Promise<ConsistencyBudget> {
  
  const issues = await detectConsistencyIssues(chapter, canon);
  
  for (const issue of issues) {
    const points = {
      minor: 5,
      moderate: 15,
      critical: 30
    }[issue.severity];
    
    budget.currentPoints -= points;
    budget.deductions.push({
      chapter: chapter.chapterNumber,
      issue: issue.description,
      severity: issue.severity,
      pointsDeducted: points
    });
  }
  
  if (budget.currentPoints < budget.threshold.critical) {
    throw new BlockingError('Consistency budget exhausted');
  }
  
  if (budget.currentPoints < budget.threshold.warning) {
    await emitWarning('Consistency budget low', budget);
  }
  
  return budget;
}
### 8.9 Canon Governance Summary
Key Rules:
Only Agent 3A writes canon - All other agents read-only
All mutations are logged - Full audit trail
Mutations are reversible - Can undo if needed
Users can lock elements - Prevent AI changes
Consistency is scored - Quantifiable metric (optional)
Agent Responsibilities:
Prose Agents (2A, 2B, 2C): Flag conflicts, don't fix them
Continuity Guardian (3A): Detect conflicts, update canon, log changes
Other Agents: Read canon, trust it as source of truth
Benefits:
No canon drift from competing agents
Clear ownership and responsibility
Full traceability of all changes
User control through locking
Debuggable when issues arise
9. Resume & Checkpoint Strategy ⭐ NEW
### 9.1 Overview
Book generation takes 1-4 hours. Users will:
Close browser tabs
Lose internet connection
Want to pause and resume later
Experience system crashes
Without explicit resume support, users lose progress and incur wasted costs. This section defines checkpointing, abort handling, and resume behavior.
### 9.2 Checkpoint Philosophy
Core Principles:
Chapter Granularity - Save state after each completed chapter
Phase Boundaries - Save state at phase transitions
User Control - Allow manual "Save & Pause"
Automatic Recovery - System auto-resumes from last checkpoint
No Duplicate Work - Never regenerate completed chapters
### 9.3 Checkpoint Types
Checkpoint Name	When Created	What's Saved	Can Resume From?
structure_approved	After Phase 1 approval	Plot, characters, blueprints, voice anchor	✅ Yes
chapter_N_complete	After each chapter	Completed chapters, canon DB, state	✅ Yes
all_chapters_written	After Phase 2	Full draft, canon DB	✅ Yes
qc_complete	After Phase 3	QC reports, identified issues	✅ Yes
editing_complete	After Phase 4	Polished manuscript	✅ Yes
final	After delivery	Complete book	❌ No (already done)
### 9.4 State Snapshot Contents
Each checkpoint saves:

interface CheckpointState {
  // Project metadata
  projectId: string,
  phase: string,
  completedChapters: number,
  totalChapters: number,
  
  // Progress tracking
  currentPhase: string,
  currentChapter: number,
  
  // Architecture artifacts
  plotStructure?: PlotStructure,
  chapterBlueprints?: ChapterBlueprint[],
  characters?: CharacterProfile[],
  worldRules?: WorldRules,
  narrativeVoiceAnchor?: NarrativeVoiceAnchor,
  
  // Completed work
  completedChapterIds: string[], // References to DB rows
  
  // Canon database
  canonSnapshot: CanonDatabase,
  
  // Quality reports
  qcReports?: QCReport[],
  
  // LangGraph state
  langraphCheckpointId?: string, // Reference to LangGraph's internal checkpoint
  
  // Metadata
  createdAt: Date,
  canResumeFrom: boolean
}
### 9.5 Checkpoint Creation Logic
Automatic Checkpoints

async function createCheckpoint(
  projectId: string,
  checkpointName: string,
  phase: string,
  state: BookWriterState
): Promise<void> {
  
  // Save to database
  const checkpoint = await db.insertCheckpoint({
    projectId,
    checkpointName,
    checkpointPhase: phase,
    stateSnapshot: {
      phase: state.phase,
      completedChapters: state.completedChapters.length,
      totalChapters: state.chapterDistribution.totalChapters,
      currentChapter: state.currentChapter,
      plotStructure: state.plotStructure,
      chapterBlueprints: state.chapterBlueprints,
      characters: state.characters,
      worldRules: state.worldRules,
      narrativeVoiceAnchor: state.narrativeVoiceAnchor,
      completedChapterIds: state.completedChapters.map(ch => ch.id),
      canonSnapshot: state.canonFacts,
      qcReports: state.qcReports
    },
    completedChapters: state.completedChapters.length,
    langraphCheckpointId: await getLangGraphCheckpointId(state)
  });
  
  // Update project
  await db.updateProject(projectId, {
    lastCheckpoint: checkpointName,
    lastCheckpointAt: new Date(),
    canResume: true
  });
  
  // Emit observability event
  await observability.emitProgress(ctx, taskId, `Checkpoint saved: ${checkpointName}`, {
    metadata: {
      type: 'checkpoint_saved',
      checkpointName,
      completedChapters: state.completedChapters.length,
      phase
    }
  });
}
Manual Pause
User clicks "Save & Pause" button:

async function handleUserPause(projectId: string): Promise<void> {
  const currentState = await getCurrentExecutionState(projectId);
  
  // Create checkpoint
  await createCheckpoint(
    projectId,
    `manual_pause_ch${currentState.currentChapter}`,
    currentState.phase,
    currentState
  );
  
  // Update project status
  await db.updateProject(projectId, {
    status: 'paused',
    pausedAt: new Date()
  });
  
  // Notify LangGraph to pause gracefully
  await pauseLangGraphExecution(projectId);
  
  return {
    message: 'Project paused. You can resume anytime.',
    lastChapterCompleted: currentState.currentChapter - 1,
    canResume: true
  };
}
### 9.6 Resume Logic
Resume Entry Point
User clicks "Resume Writing" from project list:

async function resumeProject(projectId: string): Promise<ResumeResult> {
  
  // Get project
  const project = await db.getProject(projectId);
  
  if (!project.canResume) {
    throw new Error('Project cannot be resumed (possibly completed or failed)');
  }
  
  // Get last checkpoint
  const checkpoint = await db.getLatestCheckpoint(projectId);
  
  if (!checkpoint) {
    throw new Error('No checkpoint found for resume');
  }
  
  // Restore state from checkpoint
  const restoredState = await restoreStateFromCheckpoint(checkpoint);
  
  // Determine resume strategy
  const resumeStrategy = determineResumeStrategy(checkpoint, restoredState);
  
  // Resume execution
  const result = await resumeExecution(projectId, restoredState, resumeStrategy);
  
  return {
    resumedFrom: checkpoint.checkpointName,
    resumedPhase: checkpoint.checkpointPhase,
    chaptersAlreadyComplete: restoredState.completedChapters,
    nextStep: resumeStrategy.nextStep,
    estimatedTimeRemaining: calculateRemainingTime(restoredState)
  };
}
Resume Strategies
Checkpoint	Resume Strategy
structure_approved	Start Phase 2 (writing) from Chapter 1
chapter_N_complete	Continue Phase 2 from Chapter N+1
all_chapters_written	Start Phase 3 (QC)
qc_complete	Start Phase 4 (editing)
editing_complete	Run final validation only

function determineResumeStrategy(
  checkpoint: Checkpoint,
  state: BookWriterState
): ResumeStrategy {
  
  if (checkpoint.checkpointName === 'structure_approved') {
    return {
      nextStep: 'start_chapter_writing',
      startFromChapter: 1,
      skipPhases: []
    };
  }
  
  if (checkpoint.checkpointName.startsWith('chapter_')) {
    const lastCompletedChapter = state.completedChapters;
    return {
      nextStep: 'continue_chapter_writing',
      startFromChapter: lastCompletedChapter + 1,
      skipPhases: ['phase_1'] // Architecture already done
    };
  }
  
  if (checkpoint.checkpointName === 'all_chapters_written') {
    return {
      nextStep: 'start_qc',
      skipPhases: ['phase_1', 'phase_2']
    };
  }
  
  if (checkpoint.checkpointName === 'qc_complete') {
    return {
      nextStep: 'start_editing',
      skipPhases: ['phase_1', 'phase_2', 'phase_3']
    };
  }
  
  throw new Error(`Unknown checkpoint: ${checkpoint.checkpointName}`);
}
### 9.7 State Restoration

async function restoreStateFromCheckpoint(
  checkpoint: Checkpoint
): Promise<BookWriterState> {
  
  const snapshot = checkpoint.stateSnapshot;
  
  // Restore core state
  const state: BookWriterState = {
    projectId: checkpoint.projectId,
    phase: snapshot.phase,
    currentChapter: snapshot.currentChapter,
    
    // Restore architecture
    plotStructure: snapshot.plotStructure,
    chapterBlueprints: snapshot.chapterBlueprints,
    characters: snapshot.characters,
    worldRules: snapshot.worldRules,
    narrativeVoiceAnchor: snapshot.narrativeVoiceAnchor,
    
    // Restore completed chapters (from DB, not snapshot)
    completedChapters: await db.getChapters(
      checkpoint.projectId, 
      snapshot.completedChapterIds
    ),
    
    // Restore canon
    canonFacts: snapshot.canonSnapshot,
    
    // Restore QC reports
    qcReports: snapshot.qcReports || [],
    
    // Reset runtime state
    sceneRetryAttempts: {},
    chapterRewrites: {},
    qualityGateBlocks: 0,
    flaggedIssues: [],
    
    // Timestamps
    startedAt: checkpoint.createdAt.getTime(),
    completedAt: undefined
  };
  
  return state;
}
### 9.8 LangGraph Checkpoint Integration
LangGraph has built-in checkpointing (via PostgresCheckpointer). We integrate with it:

async function getLangGraphCheckpointId(
  state: BookWriterState
): Promise<string> {
  // LangGraph automatically creates checkpoints
  // We just need to reference them
  return state.executionContext.taskId + '_' + state.currentChapter;
}

async function resumeLangGraphFromCheckpoint(
  checkpointId: string
): Promise<void> {
  // LangGraph's compile includes checkpointer
  const graph = createBookWriterGraph(llmClient, observability, checkpointer, dbService);
  
  // Resume from checkpoint
  await graph.invoke(
    initialState,
    {
      configurable: {
        thread_id: checkpointId
      }
    }
  );
}
### 9.9 Handling Interruptions
Browser Tab Closed
SSE connection drops
Server detects disconnect
Does NOT abort execution (keeps running)
User can reconnect and see progress

// Server-side SSE handler
sseClient.on('disconnect', async (connectionId) => {
  const projectId = getProjectIdFromConnection(connectionId);
  
  // Don't abort - just log disconnect
  await observability.emitProgress(ctx, taskId, 'Client disconnected', {
    metadata: { type: 'client_disconnected', connectionId }
  });
  
  // Execution continues in background
  // User can reconnect later
});
System Crash
LangGraph checkpoint exists in DB
Next run detects incomplete project
Auto-resume or prompt user

async function detectIncompleteProjects(): Promise<Project[]> {
  return await db.query(`
    SELECT * FROM book_writer.projects
    WHERE status IN ('writing', 'editing')
    AND updated_at < NOW() - INTERVAL '2 hours'
  `);
}

async function offerResume(project: Project): Promise<void> {
  // Notify user via email or in-app notification
  await notificationService.send({
    userId: project.user_id,
    type: 'project_resumable',
    message: `Your book "${project.title}" can be resumed from Chapter ${project.current_chapter}`,
    action: {
      label: 'Resume Now',
      url: `/book-writer/${project.id}`
    }
  });
}
9.10 UI for Resume
Project List Shows Resume Option:

┌────────────────────────────────────────────────────────┐
│  📖 "The Last Guardian"                                │
│     Status: In Progress - Chapter 7 of 12              │
│     Last checkpoint: 2 hours ago                        │
│     [Resume from Chapter 7 →]                          │
│                                                        │
│     💾 Available checkpoints:                           │
│     • Structure approved (2 hours ago)                  │
│     • Chapter 6 complete (2 hours ago)                  │
│     • Chapter 7 complete (2 hours ago) ← Current       │
│                                                        │
│     [Resume from Different Checkpoint]                 │
└────────────────────────────────────────────────────────┘
Resume Confirmation:

┌────────────────────────────────────────────────────────┐
│  Resume "The Last Guardian"                            │
├────────────────────────────────────────────────────────┤
│                                                        │
│  You'll resume from:                                   │
│  ✅ Chapter 7 complete                                 │
│                                                        │
│  Already completed:                                    │
│  • 7 out of 12 chapters written                        │
│  • All architecture (plot, characters, voice)          │
│                                                        │
│  Remaining work:                                       │
│  • 5 chapters to write                                 │
│  • Quality control pass                                │
│  • Final editing and polish                            │
│                                                        │
│  Estimated time: ~30 minutes                           │
│  Estimated cost: ~$0.80                                │
│                                                        │
│  [Cancel]                    [Resume Writing →]        │
│                                                        │
└────────────────────────────────────────────────────────┘
9.11 Resume Strategy Summary
Key Mechanisms:
Chapter-level checkpoints - After each chapter
Phase-boundary checkpoints - At major transitions
Manual pause - User can save and come back
Auto-detection - System finds incomplete projects
State restoration - Full state from checkpoint
LangGraph integration - Uses built-in checkpointing
No duplicate work - Skip completed chapters
Benefits:
Users can pause anytime without losing progress
System recovers from crashes gracefully
Long-running processes are safe
Clear cost/time estimates for remaining work
Multiple resume points for flexibility
Result: Reliable, user-friendly experience for 1-4 hour processes
10. Technical Architecture
### 10.1 LangGraph State Definition

// apps/langgraph/src/agents/book-writer/book-writer.state.ts

import { Annotation } from "@langchain/langgraph";
import { ExecutionContext } from "@orchestrator-ai/transport-types";

export interface UserConfig {
  // Required
  primaryGenre: string;
  targetAudience: string;
  povType: string;
  toneRange: string[];
  targetLength: { min: number; max: number };
  creativityAllowance: 'strict' | 'balanced' | 'flexible';
  
  // Optional
  reviewPreset?: 'hands-off' | 'structural-only' | 'collaborative' | 'author-mode';
  qualitySettings?: QualitySettings;
  // ... many more fields
}

export interface NarrativePRD {
  coreVision: string;
  mustHaves: string[];
  niceToHaves: string[];
  forbiddenElements: string[];
  targetExperience: string;
  successCriteria: string[];
}

export interface NarrativeVoiceAnchor {
  tense: 'past' | 'present';
  narrativeDistance: 'close' | 'medium' | 'distant';
  proseTexture: 'plain' | 'lyrical' | 'cinematic';
  sentenceCadence: 'short' | 'mixed' | 'long';
  metaphorDensity: 'low' | 'medium' | 'high';
  humorBaseline: 'none' | 'dry' | 'playful' | 'absurd';
  emotionalOpacity: 'internalized' | 'externalized';
  allowedStylization: 'low' | 'medium' | 'high';
  inspirationReferences?: string[];
  explicitDontSmoothFlags?: string[];
  voiceComplianceRules: {
    preserveFragments: boolean;
    preserveRepetition: boolean;
    preserveDialect: boolean;
    allowAbstractLanguage: boolean;
    allowNeologisms: boolean;
  };
  voiceExamples: {
    narrativeSample: string;
    dialogueSample: string;
    actionSample: string;
    introspectionSample: string;
  };
}

export interface PlotStructure {
  premise: string;
  threeActStructure: {
    act1: { summary: string; endEvent: string };
    act2: { summary: string; midpoint: string; endEvent: string };
    act3: { summary: string; climax: string; resolution: string };
  };
  majorPlotPoints: Array<{
    name: string;
    chapter: number;
    description: string;
    impact: string;
  }>;
  thematicElements: string[];
}

export interface ChapterDistribution {
  totalChapters: number;
  chapterDistribution: Array<{
    chapterNumber: number;
    actSection: string;
    plotEvents: string[];
    purpose: string;
    tensionLevel: number;
  }>;
  pacingCurve: number[];
}

export interface CharacterProfile {
  name: string;
  role: string;
  personality: {
    coreTrait: string;
    voice: string;
    speechPatterns: string[];
  };
  arc: {
    startingState: string;
    transformation: string;
    endingState: string;
  };
}

export interface ChapterBlueprint {
  chapterNumber: number;
  title: string;
  purpose: string;
  openingBeat: {
    transitionFromPrevious: string;
    openingLine: string;
  };
  scenes: Array<{
    sceneNumber: number;
    purpose: string;
    characters: string[];
    conflict: string;
    outcome: string;
  }>;
  closingBeat: {
    chapterCliffhanger: string;
    setupForNext: string;
  };
}

export interface ChapterContent {
  chapterNumber: number;
  content: string;
  wordCount: number;
  status: 'pending' | 'writing' | 'editing' | 'completed';
  voiceComplianceScore?: number; // ⭐ NEW
}

export interface QCReport {
  reportType: string;
  issues: Array<{
    severity: string;
    description: string;
    recommendation: string;
  }>;
}

export const BookWriterStateAnnotation = Annotation.Root({
  // ExecutionContext
  executionContext: Annotation<ExecutionContext>({
    reducer: (_, next) => next,
    default: () => ({
      orgSlug: "",
      userId: "",
      conversationId: "",
      taskId: "",
      planId: "",
      deliverableId: "",
      agentSlug: "book-writer",
      agentType: "api",
      provider: "",
      model: "",
    }),
  }),
  
  // Project metadata
  projectId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "",
  }),
  
  // Phase 0: Input
  userConfig: Annotation<UserConfig>({
    reducer: (_, next) => next,
    default: () => ({} as UserConfig),
  }),
  
  narrativePRD: Annotation<NarrativePRD | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  
  missingParameters: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  
  // Phase 1: Architecture
  plotStructure: Annotation<PlotStructure | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  
  chapterDistribution: Annotation<ChapterDistribution | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  
  characters: Annotation<CharacterProfile[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  
  worldRules: Annotation<any>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),
  
  chapterBlueprints: Annotation<ChapterBlueprint[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  
  // ⭐ NEW: Narrative Voice Anchor
  narrativeVoiceAnchor: Annotation<NarrativeVoiceAnchor | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  
  structureApproved: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  
  // Phase 2: Writing
  currentChapter: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 1,
  }),
  
  completedChapters: Annotation<ChapterContent[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  
  // Phase 3: Quality Control
  qcReports: Annotation<QCReport[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  
  // Canon database (consistency tracking)
  canonFacts: Annotation<Record<string, any>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  
  // ⭐ NEW: Canon mutation tracking
  canonMutationLog: Annotation<Array<{
    factKey: string;
    oldValue: any;
    newValue: any;
    chapter: number;
    agentType: string;
  }>>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  
  // Quality tracking
  sceneRetryAttempts: Annotation<Record<string, number>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  
  chapterRewrites: Annotation<Record<number, number>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  
  qualityGateBlocks: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  
  flaggedIssues: Annotation<Issue[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  
  // ⭐ NEW: Consistency budget (optional)
  consistencyBudget: Annotation<{
    currentPoints: number;
    deductions: Array<{
      chapter: number;
      issue: string;
      severity: string;
      pointsDeducted: number;
    }>;
  }>({
    reducer: (_, next) => next,
    default: () => ({ currentPoints: 100, deductions: [] }),
  }),
  
  // ⭐ NEW: Resume tracking
  lastCheckpoint: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  
  canResume: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => true,
  }),
  
  // Overall state
  phase: Annotation<
    | 'input_processing'
    | 'architecture'
    | 'approval_pending'
    | 'writing'
    | 'quality_control'
    | 'editing'
    | 'completed'
    | 'failed'
    | 'paused' // ⭐ NEW
  >({
    reducer: (_, next) => next,
    default: () => 'input_processing',
  }),
  
  error: Annotation<string | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
  
  startedAt: Annotation<number>({
    reducer: (_, next) => next,
    default: () => Date.now(),
  }),
  
  completedAt: Annotation<number | undefined>({
    reducer: (_, next) => next,
    default: () => undefined,
  }),
});

export type BookWriterState = typeof BookWriterStateAnnotation.State;
### 10.2 LangGraph Orchestration
[Similar structure to previous version, with these key additions:]

// Add Agent 1G node
async function narrativeVoiceArchitectNode(state: BookWriterState) {
  // Agent 1G logic
  const voiceAnchor = await createNarrativeVoiceAnchor(
    state.characters,
    state.plotStructure,
    state.userConfig
  );
  
  return { 
    narrativeVoiceAnchor: voiceAnchor,
    phase: 'approval_pending' 
  };
}

// Update scene writer to receive voice anchor
async function sceneWriterNode(state: BookWriterState, sceneBlueprint: SceneBlueprint) {
  const scene = await generateScene(
    sceneBlueprint,
    state.narrativeVoiceAnchor, // ⭐ Pass voice anchor
    state.canonFacts
  );
  
  return { scene };
}

// Add checkpoint creation after each chapter
async function writeChapterNode(state: BookWriterState) {
  // ... write chapter logic ...
  
  // Create checkpoint
  await createCheckpoint(
    state.projectId,
    `chapter_${state.currentChapter}_complete`,
    'phase_2',
    state
  );
  
  return { ...updatedState };
}

// Update graph to include Agent 1G
const graph = new StateGraph(BookWriterStateAnnotation)
  // ... existing nodes ...
  .addNode("narrative_voice_architect", narrativeVoiceArchitectNode)
  // ... rest of nodes ...
  
  // Add edges
  .addEdge("chapter_blueprint", "narrative_voice_architect")
  .addEdge("narrative_voice_architect", "wait_approval")
  // ... rest of edges ...
### 10.3 Real-Time SSE Updates
[Similar to previous version, with new event types:]

// Voice anchor created
await observability.emitProgress(ctx, taskId, 'Narrative voice defined', {
  metadata: {
    type: 'voice_anchor_created',
    voiceAnchor: {
      texture: voiceAnchor.proseTexture,
      cadence: voiceAnchor.sentenceCadence,
      humor: voiceAnchor.humorBaseline
    }
  }
});

// Canon mutation
await observability.emitProgress(ctx, taskId, 'Canon updated', {
  metadata: {
    type: 'canon_mutated',
    factKey: 'Elena.eyeColor',
    oldValue: 'blue',
    newValue: 'green',
    chapter: 5
  }
});

// Checkpoint saved
await observability.emitProgress(ctx, taskId, 'Progress saved', {
  metadata: {
    type: 'checkpoint_saved',
    checkpointName: 'chapter_5_complete',
    canResume: true
  }
});

// Voice compliance score
await observability.emitProgress(ctx, taskId, 'Chapter voice check', {
  metadata: {
    type: 'voice_compliance_checked',
    chapter: 5,
    score: 0.94
  }
});
11. Cost & Performance Estimates
### 11.1 Cost Breakdown (30K-word middle-grade novel)
Updated with all new agents and features:

| Phase | Agent(s) | Input Tokens | Output Tokens | Retries/QA | Total Cost |
|-------|----------|--------------|---------------|------------|------------|
| Phase 0 | 0A-0B | 5K | 3K | - | $0.04 |
| Phase 1 | 1A-1G (includes voice architect) | 60K | 35K | - | $0.52 |
| Phase 2 (per ch) | 2A-3B | 12K | 4K | +10% retries | $0.08 |
| Phase 2 (10 ch) | | 120K | 40K | +12K/4K | $0.77 |
| Phase 3 | 3C-3E | 60K | 10K | - | $0.25 |
| Phase 4 | 4A-4D (includes voice validation) | 110K | 35K | +20% polish | $0.68 |
| **TOTAL** | | **~367K** | **~127K** | | **~$2.26** |
With Haiku optimization for simple agents: ~$1.75 Different Quality Presets:
Fast: $1.60 (~73 min)
Balanced: $2.10 (~84 min) ← Recommended
Premium: $2.60 (~97 min)
Note: Costs now include:
Voice anchor creation (+$0.09)
Voice compliance checking (+$0.08)
Canon mutation logging (minimal cost)
Checkpoint overhead (negligible)
### 11.2 Performance Estimates
30K-word book (10 chapters):

| Phase | Parallel Time | With Quality Gates | With All Features |
|-------|---------------|-------------------|-------------------|
| Phase 0 | 3 min | 3 min | 3 min |
| Phase 1 | 10 min | 10 min | 12 min (+voice architect) |
| Approval | Variable | Variable | Variable |
| Phase 2 | 45 min | 50 min | 50 min |
| Phase 3 | 5 min | 6 min | 6 min |
| Phase 4 | 8 min | 13 min | 13 min (includes voice check) |
| **TOTAL** | **71 min** | **82 min** | **84 min** |
80K-word novel (25 chapters):

| Phase | Parallel Time | Notes |
|-------|---------------|-------|
| Phase 0-1 | ~15 min | Includes voice architect |
| Phase 2 | ~115 min | +2 min per chapter for voice checks |
| Phase 3-4 | ~20 min | Voice validation in Phase 4 |
| **TOTAL** | **~150 min (~2.5 hours)** | |	
12. Future Agent Expansion
[Same as previous version - no changes]
13. Success Metrics
13.1 MVP Success Criteria
Technical Metrics:
✅ Generates complete 30K-word book in <90 minutes
✅ Cost per book <$3
✅ Zero critical contradictions in canon facts
✅ All plot threads resolved
✅ Character arcs complete
✅ Passes genre compliance checks
✅ <5% of scenes require human intervention after max retries
✅ <3% of chapters blocked by quality gates
✅ Voice consistency score >0.85 across all chapters ⭐ NEW
✅ Resume success rate >95% ⭐ NEW
✅ Canon mutations are 100% traceable ⭐ NEW
Quality Metrics:
✅ Readability score appropriate for target audience
✅ Character voices distinct and consistent (evaluated by blind test)
✅ Pacing matches genre conventions (within ±1.5 tension points)
✅ Opening chapter hooks reader (tested with sample readers)
✅ Ending provides satisfying resolution (survey score >4/5)
✅ Overall quality score >85/100 (balanced settings)
✅ Prose quality score >8/10 after polish passes
✅ Voice drift <15% from early to late chapters ⭐ NEW
✅ User can identify consistent authorial voice in blind test ⭐ NEW
User Satisfaction:
✅ User approves structure before writing begins
✅ <15 minutes spent on approvals/input (including quality reviews)
✅ User feels in control of creative direction
✅ 85% of users would use again
✅ 70% of users rate output as "ready to publish with minor edits"
✅ <5% of users report "voice changed halfway through" ⭐ NEW
✅ Resume feature used by >40% of users ⭐ NEW
✅ No data loss from interruptions ⭐ NEW
Appendix A: Agent Quick Reference
ID	Agent Name	Phase	Type	Complexity	Key Output	Quality Role	Voice Access
0A	User Input Compiler	0	Sync	LOW	Narrative PRD	-	-
0B	Parameter Gap Filler	0	Sync	LOW-MED	Complete config	-	-
1A	Master Plot Architect	1	Sync	MEDIUM	3-act structure	-	-
1B	Plot-to-Chapter Distributor	1	Sync	LOW-MED	Chapter distribution	-	-
1C	Character Blueprint Agent	1	Sync	MEDIUM	Character profiles	-	-
1D	Character Arc Mapper	1	Sync	LOW	Arc milestones	-	-
1E	World & Setting Designer	1	Sync	LOW-MED	World bible	-	-
1F	Chapter Blueprint Agent	1	Sync	MEDIUM	Scene-by-scene plans	-	-
1G ⭐	Narrative Voice Architect	1	Sync	MEDIUM	Voice anchor	-	Creates
2A	Scene Writer	2	Async	HIGH	Scene prose	Retry logic	Read
2B	Dialogue Enhancer	2	Sync	LOW-MED	Enhanced dialogue	-	Read
2C	Sensory Detail Injector	2	Sync	LOW	Vivid details	-	Read
2D	Chapter Assembler	2	Sync	LOW-MED	Complete chapter	-	-
2E	Transition Specialist	2	Sync	LOW	Smooth transitions	-	-
3A	Continuity Guardian	3	Sync	MEDIUM	Continuity report	Quality gate	-
3B	Pacing Analyzer	3	Sync	MEDIUM	Pacing analysis	Quality gate	-
3C	Foreshadowing Tracker	3	Async	MEDIUM	Payoff tracking	Report	-
3D	Subplot Weaver	3	Async	LOW	Subplot continuity	Report	-
3E	Opening Hook Specialist	3	Sync	LOW	Compelling opening	Report	-
4A	Developmental Editor	4	Async	HIGH	Structural edits	Iteration	-
4B	Prose Polish Agent	4	Async	MEDIUM	Polished prose	Multi-pass	Read
4C	Cliffhanger Optimizer	4	Async	LOW	Strong endings	-	-
4D	Final Consistency Validator	4	Sync	LOW-MED	Final report	Pass/Fail	Validate
Appendix B: Key Improvements from v1.0 to v1.1
Feature	Why Added	Impact
Agent 1G: Narrative Voice Architect	Prevents voice drift across chapters	HIGH - Ensures consistent authorial voice
Canon Governance Rules	Prevents contradictory mutations	HIGH - No more "who changed this?" bugs
Resume & Checkpoint System	Handles 1-4 hour generation times	HIGH - Essential for production reliability
Review Presets	Reduces user fatigue	MEDIUM - Better UX
Voice Compliance Checking	Quantifies voice consistency	MEDIUM - Debuggable quality metric
Consistency Budget (optional)	Scores consistency numerically	LOW - Nice-to-have enhancement
END OF PRD v1.1
