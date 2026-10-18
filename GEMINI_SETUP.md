# Gemini AI setup

The Gemini API key is used only by `netlify/functions/analyze-student.mjs`, `netlify/functions/extract-syllabus.mjs`, and `netlify/functions/generate-study-plan.mjs`; it is never read by browser code or returned in responses. These functions use Google's `gemini-3.5-flash-lite` model through the Gemini `generateContent` REST API. Syllabus extraction accepts pasted text or PDFs up to 3 MB and labels student-provided sources as unverified. The student planner checks the versioned catalogue in `netlify/functions/syllabus-catalogue.json` first. Its initial verified coverage is VTU 2025 scheme, first-year CSE stream, semesters 1-2 (including the listed calculus, physics, and chemistry subjects); other combinations show an availability message and offer PDF upload only as a fallback. Catalogue responses are cached for one day, and syllabus PDFs are not downloaded on each selection. Add further verified records to that JSON file with an official source URL and re-deploy to expand coverage.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the existing Supabase variables.
2. Set `GEMINI_API_KEY` in your local Netlify environment. Netlify CLI supports a local `.env` file; add the key there (the root `.env` file is gitignored), or run `netlify env:set GEMINI_API_KEY` for the linked site. Do not put the key in a `VITE_` variable.
3. Run `npm run dev:netlify` to serve Vite and the function together. The ordinary `npm run dev` Vite server does not serve Netlify Functions, so its fallback can return HTML for the function URL.

## Netlify deployment

In the Netlify site dashboard, open **Site configuration → Environment variables** and add `GEMINI_API_KEY` with your Gemini API key. Redeploy so the function receives it. Keep the variable server-side and do not commit its value.

The `netlify.toml` build settings run `npm run build`, publish `dist`, and deploy functions from `netlify/functions`.

## Student event discovery

The scheduled `netlify/functions/sync-events.mjs` job collects listings from Devpost and Unstop daily. Gemini classification is optional enrichment only; listings retain their source-based classification if `GEMINI_API_KEY` is missing, rate-limited, or unavailable. The event status endpoint reports sync health without returning provider errors or credentials, and the Student Events page refreshes saved listings while open.

Before deploying the updated event sync, apply `supabase/migrations/20261009_student_opportunity_discovery.sql` after the existing event and AI conversation migrations. It adds nullable event dates and source-verification fields, and updates the published-event read policy to include undated records for review. Keep RLS enabled. The migration must be applied before the sync writes its added columns.

## AI conversation history database setup

Teacher and student assistant conversation history is stored server-side in Supabase. Before using either chat endpoint, apply `supabase/migrations/20261009_ai_conversations_and_event_evidence.sql` in the Supabase SQL Editor. It creates owner-scoped conversation tables with RLS enabled and denies direct client access; the Netlify Functions use the server-side Supabase secret key for authenticated, owner-filtered reads and writes. The migration also adds optional source-reported participant counts to events.

If the migration has not been applied, the teacher assistant reports the missing table and does not spend a Gemini request generating a response that cannot be persisted.
