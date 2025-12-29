# Claude Code Pane for Orch-Flow App

## Overview

Port the Claude Code Panel from the Vue.js web app to the React-based orch-flow app. This will give orch-flow users (internal team using the SyncFocus productivity app) access to AI-powered task assistance, file management, and system queries directly within their workflow.

## Current Implementation (Web App - Vue.js)

### Key Files
- `apps/web/src/components/super-admin/SuperAdminCommandPanel.vue` - Main panel UI (881 lines)
- `apps/web/src/components/super-admin/SuperAdminCommandButton.vue` - Trigger button
- `apps/web/src/composables/useClaudeCodePanel.ts` - State management hook (543 lines)
- `apps/web/src/services/claudeCodeService.ts` - API client for Claude Code (253 lines)

### Features
1. **Slide-in Panel** - 480px wide panel from right side
2. **Server Status** - Real-time connection indicator
3. **Pinned Commands** - Quick access to frequently used commands
4. **Output Display** - Formatted output for user/assistant/system/error messages
5. **Streaming Support** - SSE streaming for real-time responses
6. **Auto-complete** - Command suggestions when typing `/`
7. **Session Persistence** - Multi-turn conversations with localStorage
8. **Command History** - Arrow key navigation through past commands
9. **Cost/Token Stats** - Track usage across sessions

### Backend Dependencies
- `POST /super-admin/execute` - SSE streaming endpoint
- `GET /super-admin/commands` - List available commands
- `GET /super-admin/skills` - List available skills
- `GET /super-admin/health` - Server health check

## Target Implementation (Orch-Flow - React)

### Orch-Flow Context
- **Framework**: React 18 with TypeScript and Vite
- **UI Library**: Radix UI + shadcn/ui components
- **State**: React hooks + React Query
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth (same as web app)

### Enhanced Features for Orch-Flow

Beyond porting the existing features, add orch-flow specific integrations:

1. **Task Integration**
   - Ask Claude about tasks in the system
   - AI assistance for breaking down tasks
   - Smart task suggestions based on context
   - "Ask Claude about this task" button on task cards

2. **Team File Access**
   - Claude can query files stored in orch_flow.team_files
   - Help with note editing and organization
   - Search across team notes

3. **Sprint/Timer Context**
   - Claude knows current sprint context
   - Timer-aware suggestions
   - "What should I work on next?" queries

4. **Team Presence Awareness**
   - Claude can see who's online
   - Suggest collaboration opportunities

---

## Implementation Plan

### Phase 1: Core Infrastructure (Day 1)

#### 1.1 Create Service Layer
**File**: `apps/orch-flow/src/services/claudeCodeService.ts`

Port the service with minimal changes:
- Update base URL to point to orch-flow API (or shared API)
- Use Supabase auth token instead of localStorage authToken
- Keep all type definitions

```typescript
// Key types to port
interface ClaudeCommand { name: string; description: string; }
interface ClaudeSkill { name: string; description: string; }
interface ClaudeMessage { type: string; message?: { content: string | ContentBlock[] }; ... }

// Key methods to port
- isAvailable(): Promise<boolean>
- getCommands(): Promise<ClaudeCommand[]>
- getSkills(): Promise<ClaudeSkill[]>
- execute(prompt, onMessage, onError, onComplete, sessionId?): Promise<AbortController>
- extractContent(message): string
```

#### 1.2 Create React Hook
**File**: `apps/orch-flow/src/hooks/useClaudeCodePanel.ts`

Convert Vue composable to React hook:

```typescript
// Vue reactivity -> React useState/useRef
const isServerAvailable = ref(false)  ->  const [isServerAvailable, setIsServerAvailable] = useState(false)
const output = ref<OutputEntry[]>([])  ->  const [output, setOutput] = useState<OutputEntry[]>([])

// Vue onMounted -> useEffect
onMounted(async () => { ... })  ->  useEffect(() => { ... }, [])

// Vue watch -> useEffect with dependencies
watch(prompt, () => { ... })  ->  useEffect(() => { ... }, [prompt])

// Vue computed -> useMemo
const canExecute = computed(() => ...)  ->  const canExecute = useMemo(() => ..., [deps])
```

Key state to manage:
- Server availability (isServerAvailable, isCheckingServer)
- Execution state (isExecuting, abortController)
- Session state (sessionId, output, currentAssistantMessage)
- Commands/skills lists
- Stats (totalCost, totalInputTokens, totalOutputTokens)
- History (commandHistory, historyIndex)
- Pinned commands

#### 1.3 Create Types File
**File**: `apps/orch-flow/src/types/claudeCode.ts`

```typescript
export interface OutputEntry {
  type: 'user' | 'assistant' | 'system' | 'error' | 'info';
  content: string;
  timestamp: Date;
}

export interface ClaudeCommand {
  name: string;
  description: string;
}

export interface ClaudeSkill {
  name: string;
  description: string;
}

// ... other types
```

---

### Phase 2: UI Components (Day 1-2)

#### 2.1 Main Panel Component
**File**: `apps/orch-flow/src/components/ClaudeCodePanel.tsx`

Structure (using shadcn components):
```tsx
<Sheet open={isOpen} onOpenChange={onClose}>
  <SheetContent side="right" className="w-[480px]">
    {/* Header with status */}
    <SheetHeader>
      <SheetTitle className="flex items-center gap-2">
        <Terminal className="w-5 h-5" />
        Claude Code Panel
        <StatusIndicator status={serverStatus} />
      </SheetTitle>
    </SheetHeader>

    {/* Pinned Commands */}
    <PinnedCommands commands={pinnedCommands} onSelect={insertCommand} />

    {/* Output Area */}
    <ScrollArea className="flex-1">
      <OutputArea entries={output} streaming={currentAssistantMessage} />
    </ScrollArea>

    {/* Input Area */}
    <div className="border-t p-4">
      <Textarea ... />
      <AutoCompleteDropdown ... />
      <ActionButtons ... />
    </div>

    {/* Footer Stats */}
    {totalCost > 0 && <StatsFooter ... />}
  </SheetContent>
</Sheet>
```

Components to create:
- `ClaudeCodePanel.tsx` - Main panel (port from SuperAdminCommandPanel.vue)
- `ClaudeCodeButton.tsx` - Trigger button (port from SuperAdminCommandButton.vue)
- `OutputEntry.tsx` - Individual output message
- `AutoCompleteDropdown.tsx` - Command suggestions

#### 2.2 Trigger Button Component
**File**: `apps/orch-flow/src/components/ClaudeCodeButton.tsx`

```tsx
export function ClaudeCodeButton({ onClick }: { onClick: () => void }) {
  const { user } = useAuth();
  const [hasOpened, setHasOpened] = useState(false);

  // Only show for authenticated users
  if (!user) return null;

  return (
    <Button
      onClick={() => { setHasOpened(true); onClick(); }}
      className={cn("fixed bottom-4 right-4 z-50", !hasOpened && "animate-pulse")}
    >
      <Terminal className="w-4 h-4 mr-2" />
      Claude
    </Button>
  );
}
```

---

### Phase 3: Integration with Orch-Flow Features (Day 2-3)

#### 3.1 Task Context Provider
**File**: `apps/orch-flow/src/contexts/ClaudeTaskContext.tsx`

Provide task context to Claude queries:
```typescript
// Inject current task context into prompts
function buildTaskContextPrompt(task: SharedTask | null): string {
  if (!task) return '';
  return `
Current task context:
- Title: ${task.title}
- Status: ${task.status}
- Priority: ${task.priority}
- Description: ${task.description || 'No description'}
`;
}
```

#### 3.2 Add "Ask Claude" Button to Task Cards
**File**: Modify `apps/orch-flow/src/components/KanbanCard.tsx`

Add a button that opens Claude panel with task context:
```tsx
<DropdownMenuItem onClick={() => askClaudeAboutTask(task)}>
  <MessageSquare className="w-4 h-4 mr-2" />
  Ask Claude about this task
</DropdownMenuItem>
```

#### 3.3 Team Files Integration
Extend the Claude service to query team files:
```typescript
// Custom command: /search-files <query>
// Custom command: /read-note <note-id>
// Custom command: /summarize-notes
```

#### 3.4 Sprint Context
```typescript
// Inject sprint context
function buildSprintContextPrompt(sprint: Sprint | null): string {
  if (!sprint) return '';
  return `Current sprint: ${sprint.name} (${sprint.start_date} to ${sprint.end_date})`;
}
```

---

### Phase 4: App Integration (Day 3)

#### 4.1 Add to Index Page
**File**: Modify `apps/orch-flow/src/pages/Index.tsx`

```tsx
import { ClaudeCodeButton } from '@/components/ClaudeCodeButton';
import { ClaudeCodePanel } from '@/components/ClaudeCodePanel';

export default function Index() {
  const [showClaudePanel, setShowClaudePanel] = useState(false);

  return (
    <>
      {/* Existing content */}

      {/* Claude Code Button - visible when authenticated */}
      <ClaudeCodeButton onClick={() => setShowClaudePanel(true)} />

      {/* Claude Code Panel */}
      <ClaudeCodePanel
        isOpen={showClaudePanel}
        onClose={() => setShowClaudePanel(false)}
      />
    </>
  );
}
```

#### 4.2 Optional: Global State with Context
If panel state needs to be accessed from multiple places:

**File**: `apps/orch-flow/src/contexts/ClaudeCodeContext.tsx`

```tsx
const ClaudeCodeContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
  askAboutTask: (task: SharedTask) => void;
} | null>(null);

export function ClaudeCodeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [contextTask, setContextTask] = useState<SharedTask | null>(null);

  const askAboutTask = (task: SharedTask) => {
    setContextTask(task);
    setIsOpen(true);
    // Pre-fill prompt with task context
  };

  return (
    <ClaudeCodeContext.Provider value={{ isOpen, open, close, askAboutTask }}>
      {children}
    </ClaudeCodeContext.Provider>
  );
}
```

---

### Phase 5: Backend Considerations (If Needed)

The existing backend at `/super-admin/*` endpoints should work for orch-flow, but consider:

#### 5.1 Option A: Reuse Existing Backend
- Point orch-flow to the same API (port 6100)
- Ensure orch-flow users have appropriate permissions
- May need to relax "super-admin only" restriction for orch-flow

#### 5.2 Option B: Create Dedicated Endpoints
If different access control is needed:

**File**: `apps/api/src/orch-flow/claude-code.controller.ts`

```typescript
@Controller('orch-flow/claude')
export class OrchFlowClaudeController {
  @Post('execute')
  async execute(@Body() dto: ExecuteCommandDto, @Req() req: AuthRequest) {
    // Could have different permission model
    // Could inject orch-flow specific context
  }
}
```

#### 5.3 Environment Configuration
**File**: `apps/orch-flow/.env`

```env
VITE_CLAUDE_API_URL=http://127.0.0.1:6100
# Or dedicated endpoint:
# VITE_CLAUDE_API_URL=http://127.0.0.1:6100/orch-flow
```

---

## File Structure Summary

```
apps/orch-flow/src/
├── components/
│   ├── claude/
│   │   ├── ClaudeCodePanel.tsx      # Main slide-out panel
│   │   ├── ClaudeCodeButton.tsx     # Trigger button
│   │   ├── OutputArea.tsx           # Output display
│   │   ├── OutputEntry.tsx          # Single output message
│   │   ├── PinnedCommands.tsx       # Quick command buttons
│   │   ├── AutoCompleteDropdown.tsx # Command suggestions
│   │   └── StatsFooter.tsx          # Cost/token display
│   └── ... (existing components)
├── hooks/
│   ├── useClaudeCodePanel.ts        # Main panel state hook
│   └── ... (existing hooks)
├── services/
│   ├── claudeCodeService.ts         # API client
│   └── ... (existing services)
├── contexts/
│   ├── ClaudeCodeContext.tsx        # Global state (optional)
│   └── ... (existing contexts)
└── types/
    └── claudeCode.ts                # Type definitions
```

---

## Estimated Effort

| Phase | Description | Estimate |
|-------|-------------|----------|
| Phase 1 | Core Infrastructure (service, hook, types) | 4-6 hours |
| Phase 2 | UI Components | 4-6 hours |
| Phase 3 | Orch-Flow Integrations | 4-6 hours |
| Phase 4 | App Integration | 2-3 hours |
| Phase 5 | Backend (if needed) | 2-4 hours |
| **Total** | | **16-25 hours** |

---

## Key Considerations

### 1. Auth Token Handling
Web app uses `localStorage.getItem('authToken')`, orch-flow uses Supabase session. Update service to get token from Supabase:

```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### 2. Permission Model
Decide on access control:
- **Option A**: Require super-admin role (same as web)
- **Option B**: Allow all authenticated orch-flow users
- **Option C**: Role-based (e.g., team leads only)

### 3. Styling
Web app uses Ionic CSS variables; orch-flow uses Tailwind. Port styles to Tailwind classes.

### 4. Icons
Web app uses Ionicons; orch-flow uses Lucide React icons. Map icons:
- `terminalOutline` -> `<Terminal />`
- `closeOutline` -> `<X />`
- `playOutline` -> `<Play />`
- `stopOutline` -> `<Square />`
- `trashOutline` -> `<Trash2 />`
- `star` / `starOutline` -> `<Star />` / `<StarOff />`

### 5. Sheet Component
Use shadcn `Sheet` component for the slide-out panel:
```bash
npx shadcn@latest add sheet
```

---

## Success Criteria

1. **Functional Parity**: All features from web app work in orch-flow
2. **React Patterns**: Properly uses React hooks, not Vue patterns
3. **Tailwind Styling**: Clean, consistent with orch-flow design
4. **Task Integration**: Can ask Claude about specific tasks
5. **Seamless UX**: Panel feels native to orch-flow app
6. **Persistence**: Session/history survives page refresh
7. **Performance**: Smooth streaming, no UI blocking

---

## Future Enhancements

1. **Voice Input**: Add microphone button for voice commands
2. **Task Actions**: Claude can create/update tasks directly
3. **Note Generation**: Claude can create team notes from conversations
4. **Sprint Planning**: AI-assisted sprint planning
5. **Daily Standup**: Generate standup summaries from task activity
6. **Slack/Email Integration**: Send Claude outputs to team channels
