# HITL Manual Testing Checklist

## Prerequisites
- [ ] API server running on port 6100
- [ ] LangGraph server running on port 6200
- [ ] Web frontend running on port 6101
- [ ] Logged in as test user

## Test Cases

### 1. Basic APPROVE Flow
- [ ] Start new conversation with extended-post-writer
- [ ] Send message: "Write a blog post about AI in healthcare"
- [ ] Verify HITL Review Modal auto-opens
- [ ] Verify blog post content is displayed
- [ ] Click "Approve" button
- [ ] Verify workflow completes
- [ ] Verify Deliverables Modal auto-opens
- [ ] Verify DeliverableCard appears in conversation

### 2. REGENERATE Flow
- [ ] Start new conversation
- [ ] Trigger HITL
- [ ] Enter feedback: "Make it shorter and more engaging"
- [ ] Click "Regenerate" button
- [ ] Verify new content is generated
- [ ] Verify HITL Modal updates with new content
- [ ] Verify version history shows 2 versions
- [ ] Approve and complete

### 3. REPLACE Flow
- [ ] Start new conversation
- [ ] Trigger HITL
- [ ] Switch to "Edit" mode
- [ ] Edit the content manually
- [ ] Click "Use My Edits" button
- [ ] Verify workflow completes with user content
- [ ] Verify version history shows MANUAL_EDIT type

### 4. HITL Pending List (Sidebar)
- [ ] Start 2-3 tasks but don't complete them
- [ ] Verify sidebar shows "HITL Reviews (N)"
- [ ] Expand the list
- [ ] Verify all pending items are shown
- [ ] Click an item
- [ ] Verify conversation loads and HITL Modal opens
- [ ] Complete the review
- [ ] Verify item removed from sidebar list

### 5. Version History in Modal
- [ ] After multiple regenerations, versions appear in modal
- [ ] Version selector shows all versions with type labels
- [ ] Clicking a version switches the displayed content
- [ ] Current version is highlighted

### 6. Cards in Conversation
- [ ] HitlPendingCard appears when HITL is waiting
- [ ] Clicking card opens HITL Modal
- [ ] DeliverableCard replaces HitlPendingCard after completion
- [ ] Clicking DeliverableCard opens Deliverables Modal

### 7. Error Handling
- [ ] Try to regenerate without feedback
- [ ] Verify validation error appears
- [ ] Try to replace without making edits
- [ ] Verify appropriate error

### 8. Session Persistence
- [ ] Start HITL workflow
- [ ] Refresh the page
- [ ] Verify HITL Pending List still shows the item
- [ ] Click item and verify modal opens with correct content
- [ ] Complete the workflow
