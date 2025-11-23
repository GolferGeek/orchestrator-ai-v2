const eventTypeToEmoji: Record<string, string> = {
  // Task events
  'task.created': '📝',
  'task.started': '▶️',
  'task.progress': '⚡',
  'task.completed': '✅',
  'task.failed': '❌',
  'task.cancelled': '🚫',
  'task.message': '💬',
  
  // Agent events
  'agent.started': '🚀',
  'agent.progress': '🔄',
  'agent.completed': '🏁',
  'agent.failed': '💥',
  'agent.stream.start': '📡',
  'agent.stream.chunk': '📊',
  'agent.stream.complete': '✨',
  'agent.stream.error': '⚠️',
  
  // Workflow events
  'workflow.step.progress': '🔀',
  'workflow.status.update': '📋',
  
  // HITL events
  'human_input.required': '🙋',
  'human_input.response': '💭',
  'human_input.timeout': '⏱️',
  
  // Tool events (from Claude Code observability)
  'PreToolUse': '🔧',
  'PostToolUse': '✅',
  'Notification': '🔔',
  'Stop': '🛑',
  'SubagentStop': '👥',
  'PreCompact': '📦',
  'UserPromptSubmit': '💬',
  'SessionStart': '🚀',
  'SessionEnd': '🏁',
  
  // Default
  'default': '❓'
};

export function useEventEmojis() {
  const getEmojiForEventType = (eventType: string): string => {
    return eventTypeToEmoji[eventType] || eventTypeToEmoji.default;
  };
  
  const formatEventTypeLabel = (eventTypes: Record<string, number>): string => {
    const entries = Object.entries(eventTypes)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
    
    if (entries.length === 0) return '';
    
    // Show up to 3 most frequent event types
    const topEntries = entries.slice(0, 3);
    
    return topEntries
      .map(([type, count]) => {
        const emoji = getEmojiForEventType(type);
        return count > 1 ? `${emoji}×${count}` : emoji;
      })
      .join('');
  };
  
  return {
    getEmojiForEventType,
    formatEventTypeLabel
  };
}

