# Accessibility Guide

Accessibility considerations and features in Orchestrator AI.

## Web UI Accessibility

### Current Status

The Orchestrator AI web application is built with Vue.js and Ionic, which provide good accessibility foundations, but comprehensive accessibility auditing and improvements are ongoing.

### Keyboard Navigation

**Supported**:
- Tab navigation between interactive elements
- Enter/Space to activate buttons
- Arrow keys for navigation in lists
- Escape to close modals

**Areas for Improvement**:
- Focus indicators could be more visible
- Keyboard shortcuts documentation needed
- Complex interactions may need refinement

### Screen Reader Support

**Current State**:
- Semantic HTML used where possible
- ARIA labels on key interactive elements
- Form labels properly associated

**Known Limitations**:
- Some dynamic content may not announce changes
- Complex agent configuration forms may be challenging
- Real-time streaming responses may not be fully accessible

### Color Contrast

**Status**: Generally meets WCAG AA standards, but not fully audited.

**Recommendations**:
- Use browser dev tools to check contrast
- Report contrast issues via GitHub Issues
- Consider high contrast mode support

## Known Accessibility Issues

### High Priority

1. **Focus Management**
   - Focus may be lost in dynamic content
   - Modal focus trapping needs improvement

2. **Form Validation**
   - Error messages may not be properly announced
   - Required field indicators may not be clear

3. **Streaming Content**
   - Real-time agent responses may not be accessible
   - Progress indicators may not be announced

### Medium Priority

1. **Complex UI Components**
   - Agent configuration forms
   - Multi-step workflows
   - Data tables

2. **Mobile Accessibility**
   - Touch targets may be small
   - Gesture navigation

## Improving Accessibility

### For Developers

**Guidelines**:
- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Test with screen readers
- Check color contrast

**Resources**:
- [Vue.js Accessibility Guide](https://vuejs.org/guide/best-practices/accessibility.html)
- [Ionic Accessibility](https://ionicframework.com/docs/accessibility)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### For Contributors

**How to Help**:
1. Test with screen readers (NVDA, JAWS, VoiceOver)
2. Test keyboard-only navigation
3. Check color contrast
4. Report accessibility issues
5. Submit accessibility improvements

## Reporting Accessibility Issues

**GitHub Issue Template**: Use the [Documentation Issue Template](https://github.com/golfergeek/orchestrator-ai-v2/issues/new?template=documentation.md) and label as "accessibility"

**Include**:
- What you were trying to do
- What happened (or didn't happen)
- Screen reader used (if applicable)
- Browser and OS
- Suggested fix (if you have one)

## Future Improvements

### Planned Enhancements

1. **Comprehensive Audit**
   - Full WCAG 2.1 AA audit
   - Automated testing integration
   - Regular accessibility reviews

2. **Enhanced Keyboard Support**
   - Documented keyboard shortcuts
   - Better focus management
   - Keyboard-only workflows

3. **Screen Reader Optimization**
   - Better ARIA implementation
   - Live region announcements
   - Improved form feedback

4. **High Contrast Mode**
   - Support for system high contrast
   - Customizable themes
   - Better visual indicators

## API Accessibility

### REST API

The API follows RESTful conventions and is accessible via:
- Standard HTTP methods
- JSON responses
- Clear error messages
- Documentation

**No visual requirements** - API is inherently accessible.

### WebSocket/Streaming

Real-time updates via WebSocket may present challenges:
- Screen reader users may need alternative endpoints
- Consider polling alternatives
- Document streaming behavior

## Documentation Accessibility

### Current State

- Markdown documentation (screen reader friendly)
- Code examples with syntax highlighting
- Clear structure and headings

### Improvements Needed

- Alt text for diagrams
- Transcripts for video content (when added)
- Better navigation structure

## Getting Help

- **Accessibility Issues**: [GitHub Issues](https://github.com/golfergeek/orchestrator-ai-v2/issues) (label: accessibility)
- **Questions**: [GitHub Discussions](https://github.com/golfergeek/orchestrator-ai-v2/discussions)
- **Contributions**: See [Contributing Guide](../CONTRIBUTING.md)

---

**Note**: Accessibility is an ongoing effort. We welcome contributions and feedback to improve accessibility for all users.
