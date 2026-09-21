# API Plan

Milestone 2A has no live UI-facing API. The Supabase client and database migrations establish a future repository boundary without changing the mock adapter.

Future UI-facing services should expose stable operations for authentication, product/listing management, image upload, scan creation, extraction retrieval, finding review, complaint submission/status, and report retrieval. Implement them through Supabase-backed repositories and Edge Functions, preserving the same UI-facing result shapes where practical.

Sensitive credentials and Google service calls must only run in server-side Edge Functions; they must never be placed in the browser.

The browser may use only the Supabase URL and anon key, with RLS enforcing access. Service-role credentials belong only in trusted server-side execution.
