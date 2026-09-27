# DECISIONS.md

## Groq client consolidation (Session 7)
**Decision:** standardize on `services/ai/groq.service.js` (axios-based) as
the single Groq client; delete `config/groq.js` (groq-sdk-based).
**Why:** groq.service.js already had 5 callers vs. config/groq.js's 2, and
already had the Session 2 429-retry/backoff fix. Same `chat()`/`parseJSON()`
signatures made this a safe drop-in swap for both remaining callers.
**Alternative considered:** keep both, just add retry logic to config/groq.js
too. Rejected — perpetuates duplicate code that will drift again.

## Resume parser/optimizer consolidation (Session 7)
**Decision:** make `resume.routes.js` call the previously-dead
`resumeParser.service.js` / `resumeOptimizer.service.js` instead of its own
inline duplicate prompts.
**Why:** the service version already had correct mimetype-based text
extraction (PDF/DOCX/TXT); the inline route version didn't, and silently
broke DOCX uploads. Consolidating fixed a real bug, not just cleaned up code.
**Risk accepted:** prompt wording changed slightly (now using the service's
richer JSON schema/prompt instead of the route's condensed one) — this is a
behavior change to the AI output shape, though the Resume model schema is
unaffected. Flagging in case Asendra notices different parsed-field
formatting in testing.

## Not yet decided (needs Asendra's input)
- Whether to tackle Phases 2–12 of the "FINAL MASTER PROMPT" (backend
  polish, full UI redesign, security audit, performance, DevOps, docs, code
  quality, final polish) in a specific order, or let Claude prioritize.
- Frontend E2E tool choice (Playwright vs Cypress) — not yet chosen.
