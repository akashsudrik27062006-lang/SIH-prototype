# Architecture

## Current milestone

The frontend is React + Vite + JavaScript/JSX with the existing custom CSS. UI pages still consume a mock adapter layer. A nullable Supabase browser client now sits behind `src/services/supabase/client.js`; it is constructed only when both public Vite variables are configured.

## Planned architecture

- Frontend: React, Vite, JavaScript, existing custom CSS.
- Backend: Supabase PostgreSQL, Auth, Storage, Edge Functions, and Row Level Security.
- Analysis pipeline: Google Cloud Vision OCR, Gemini multimodal extraction, then a deterministic JavaScript compliance rule engine.
- Deployment: Vercel + Supabase.

Milestone 2A establishes PostgreSQL schema, RLS, and private Storage bucket definitions as migrations. It does not connect Supabase Auth or replace mock UI operations. The AI pipeline remains deliberately unimplemented.
