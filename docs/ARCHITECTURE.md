# Architecture

## Current milestone

The frontend is React + Vite + JavaScript/JSX with the existing custom CSS. UI pages consume a mock adapter layer, so later services can replace it without rebuilding visual flows.

## Planned architecture

- Frontend: React, Vite, JavaScript, existing custom CSS.
- Backend: Supabase PostgreSQL, Auth, Storage, Edge Functions, and Row Level Security.
- Analysis pipeline: Google Cloud Vision OCR, Gemini multimodal extraction, then a deterministic JavaScript compliance rule engine.
- Deployment: Vercel + Supabase.

Supabase and the AI pipeline are deliberately not implemented in Milestone 1.

