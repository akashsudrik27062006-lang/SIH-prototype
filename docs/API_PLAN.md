# API Plan

Milestone 1 has no live API.

Future UI-facing services should expose stable operations for authentication, product/listing management, image upload, scan creation, extraction retrieval, finding review, complaint submission/status, and report retrieval. Implement them through Supabase-backed repositories and Edge Functions, preserving the same UI-facing result shapes where practical.

Sensitive credentials and Google service calls must only run in server-side Edge Functions; they must never be placed in the browser.

