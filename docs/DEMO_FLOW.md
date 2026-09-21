# Demo Flow

The existing role-based demo is unchanged in Milestone 2A. Demo login, mock products, simulated scans, findings, dashboards, complaints, and reports still use client-side mock adapters.

The Supabase client is an opt-in service boundary only. When Vite environment variables are absent it is `null`, so no live operation is attempted. No real authentication, persistence, upload, scan, complaint, report, comparison, analytics, OCR, AI analysis, or rule-engine workflow is connected.
