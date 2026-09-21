# Decisions

- Preserve the visual design and custom CSS; do not introduce Tailwind.
- Keep mock data behind a replaceable adapter layer until backend work is authorized.
- Convert to JavaScript/JSX as requested, while keeping the current React/Vite behavior.
- Treat AI output as potential findings only; deterministic rules and officer review remain authoritative.
- Keep the Supabase client nullable so the existing mock demo runs without local environment configuration.
- Treat RLS, not frontend route guards or localStorage, as the security boundary; keep Storage buckets private by default.
- Use restrictive foreign keys and omit delete policies until a compliance-record retention policy is authorized.
