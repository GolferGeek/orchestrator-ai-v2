/**
 * Output Entry Component
 *
 * Renders a single output entry in the Claude Code panel.
 */

import { cn } from '@/lib/utils';
import type { OutputEntry as OutputEntryType } from '@/types/claudeCode';

interface OutputEntryProps {
  entry: OutputEntryType;
}

function getEntryPrefix(type: OutputEntryType['type']): string {
  switch (type) {
    case 'user':
      return 'You:';
    case 'assistant':
      return 'Claude:';
    case 'system':
      return 'System:';
    case 'error':
      return 'Error:';
    case 'info':
      return '';
    default:
      return '';
  }
}

export function OutputEntry({ entry }: OutputEntryProps) {
  const prefix = getEntryPrefix(entry.type);

  return (
    <div
      className={cn(
        'p-3 rounded-lg text-sm',
        entry.type === 'user' && 'bg-primary/10 border-l-4 border-primary',
        entry.type === 'assistant' && 'bg-muted border-l-4 border-green-500',
        entry.type === 'system' && 'bg-muted/50 border-l-4 border-muted-foreground text-xs',
        entry.type === 'error' && 'bg-destructive/10 border-l-4 border-destructive text-destructive',
        entry.type === 'info' && 'bg-transparent text-muted-foreground text-xs text-center py-1'
      )}
    >
      {prefix && (
        <span className="font-semibold block mb-1">{prefix}</span>
      )}
      <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed m-0">
        {entry.content}
      </pre>
    </div>
  );
}
