import { describe, it, expect } from 'vitest';
import { useEventEmojis } from '../useEventEmojis';

describe('useEventEmojis', () => {
  const { getEmojiForEventType, formatEventTypeLabel } = useEventEmojis();

  describe('getEmojiForEventType', () => {
    it('should return correct emoji for PreToolUse', () => {
      expect(getEmojiForEventType('PreToolUse')).toBe('🔧');
    });

    it('should return correct emoji for PostToolUse', () => {
      expect(getEmojiForEventType('PostToolUse')).toBe('✅');
    });

    it('should return correct emoji for Notification', () => {
      expect(getEmojiForEventType('Notification')).toBe('🔔');
    });

    it('should return correct emoji for Stop', () => {
      expect(getEmojiForEventType('Stop')).toBe('🛑');
    });

    it('should return correct emoji for SubagentStop', () => {
      expect(getEmojiForEventType('SubagentStop')).toBe('👥');
    });

    it('should return correct emoji for SessionStart', () => {
      expect(getEmojiForEventType('SessionStart')).toBe('🚀');
    });

    it('should return correct emoji for SessionEnd', () => {
      expect(getEmojiForEventType('SessionEnd')).toBe('🏁');
    });

    it('should return default emoji for unknown event types', () => {
      expect(getEmojiForEventType('UnknownEvent')).toBe('❓');
    });
  });

  describe('formatEventTypeLabel', () => {
    it('should return empty string for empty object', () => {
      expect(formatEventTypeLabel({})).toBe('');
    });

    it('should format single event type without count when count is 1', () => {
      const result = formatEventTypeLabel({ PreToolUse: 1 });
      expect(result).toBe('🔧');
    });

    it('should format single event type with count when count > 1', () => {
      const result = formatEventTypeLabel({ PreToolUse: 3 });
      expect(result).toBe('🔧×3');
    });

    it('should format multiple event types sorted by count', () => {
      const result = formatEventTypeLabel({
        PreToolUse: 2,
        PostToolUse: 5,
        Notification: 1,
      });
      // Should be sorted by count descending: PostToolUse(5), PreToolUse(2), Notification(1)
      expect(result).toBe('✅×5🔧×2🔔');
    });

    it('should show max 3 event types', () => {
      const result = formatEventTypeLabel({
        PreToolUse: 4,
        PostToolUse: 3,
        Notification: 2,
        Stop: 1,
        SessionStart: 1,
      });
      // Should only show top 3
      expect(result).toBe('🔧×4✅×3🔔×2');
    });
  });
});
