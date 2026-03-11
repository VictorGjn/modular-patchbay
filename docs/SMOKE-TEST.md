# Smoke Test Checklist

This manual checklist should be completed before every release to ensure basic functionality works correctly. Each test should be performed in a browser with fresh state (cleared cache/localStorage).

## Pre-Test Setup
- [ ] Clear browser cache and localStorage
- [ ] Open browser developer tools (F12)
- [ ] Navigate to the application (dev or production build)

## Basic Application Flow

### 1. Initial Application State
- [ ] **Open app (fresh state)** — Application loads without errors
- [ ] **Console check** — No JavaScript errors in browser console
- [ ] **UI renders** — All main UI elements are visible and properly styled

### 2. Settings & Provider Configuration
- [ ] **Settings → Providers** — Settings page opens without errors
- [ ] **Connect provider** — Able to configure and connect at least one LLM provider
- [ ] **Verify connection** — Provider shows "Connected" status or similar positive indicator
- [ ] **No provider errors** — No error messages related to provider configuration

### 3. MCP Tab Functionality
- [ ] **Settings → MCP tab** — MCP settings tab renders without crash
- [ ] **No infinite loops** — Page remains stable, no excessive re-rendering
- [ ] **MCP servers display** — Any configured MCP servers are shown correctly
- [ ] **No React errors** — Console shows no React error boundaries triggered

### 4. Basic Chat Functionality
- [ ] **Chat interface** — Chat panel is accessible and renders properly
- [ ] **Send message** — Can type and send a basic message (e.g., "Hello")
- [ ] **Receive response** — Assistant responds within reasonable time (< 30 seconds)
- [ ] **Response quality** — Response is coherent and appropriate
- [ ] **No chat errors** — No error messages in chat interface

### 5. Conversation Continuity
- [ ] **Send follow-up** — Send a second message referencing the first
- [ ] **Context maintained** — Assistant's response demonstrates understanding of conversation history
- [ ] **Message history** — Previous messages remain visible in chat
- [ ] **Conversation flow** — Chat behaves like a continuous conversation

### 6. Message Rendering
- [ ] **Markdown rendering** — Assistant messages with **bold**, *italics*, `code`, and links render correctly
- [ ] **Code blocks** — Multi-line code blocks render with proper formatting and syntax highlighting
- [ ] **Lists and structure** — Bulleted/numbered lists and headers render properly
- [ ] **No raw markdown** — No raw markdown syntax visible (e.g., `**bold**` should show as **bold**)

### 7. Pipeline Traces
- [ ] **Pipeline traces appear** — After assistant response, pipeline trace information is visible
- [ ] **Trace data accuracy** — Traces show reasonable token counts, timing, and source information
- [ ] **Collapsible interface** — Can expand/collapse trace details
- [ ] **Trace styling** — Traces are visually distinct and properly styled

### 8. Knowledge & Retrieval
- [ ] **Knowledge section** — Knowledge/RAG interface is accessible
- [ ] **Add file** — Can successfully upload/add a knowledge file
- [ ] **File processing** — File appears as indexed/processed (no error state)
- [ ] **Query knowledge** — Can send a question about uploaded content
- [ ] **Retrieval works** — Assistant response demonstrates knowledge of uploaded content
- [ ] **Source attribution** — Pipeline traces show sources were consulted

### 9. Console & Error Monitoring
- [ ] **No 404 errors** — Browser network tab shows no 404 responses from API calls
- [ ] **No 400 errors** — No client errors (400-499) in API responses
- [ ] **No 500 errors** — No server errors (500-599) in API responses  
- [ ] **No React errors** — No React error boundaries triggered or unhandled exceptions
- [ ] **No console warnings** — Minimal console warnings (minor warnings acceptable)

### 10. Export Functionality
- [ ] **Export interface** — Export/download functionality is accessible
- [ ] **Export agent** — Can trigger agent export process
- [ ] **ZIP downloads** — Export generates and downloads a ZIP file successfully
- [ ] **ZIP contents** — Downloaded ZIP contains expected agent configuration files
- [ ] **No export errors** — No error messages during export process

## Pass Criteria

**All items must pass** for the smoke test to be considered successful. If any item fails:

1. **Document the failure** — Note which test failed and how
2. **Investigate the root cause** — Check console errors, network requests, etc.
3. **Fix the issue** — Address the problem before release
4. **Re-run full checklist** — Start from the beginning after fixes

## Notes

- **Test in multiple browsers** — Chrome/Firefox at minimum for important releases
- **Test both dev and production builds** — Ensure build process doesn't break functionality
- **Fresh state is critical** — Cached state can hide real user experience issues
- **Document any workarounds** — If manual steps are needed, consider if users will discover them
- **Performance matters** — Note any significantly slow responses or UI lag

## Quick Red Flags

Stop testing and investigate immediately if you see:
- ❌ App doesn't load or shows blank screen
- ❌ JavaScript errors on initial page load
- ❌ Settings page crashes or doesn't respond
- ❌ Chat sends message but gets no response
- ❌ Assistant responds with error messages instead of helpful content
- ❌ Console fills with error messages
- ❌ Any UI element completely broken or missing

---

**Remember:** This checklist represents the minimum viable user experience. If a user can't complete these basic flows, the app isn't ready for release.