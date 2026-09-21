# Security

## Environment and secrets

The browser client reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `.env` and `.env.local` are ignored; `.env.example` contains placeholders. Never commit a service-role key, database password, or third-party API credential, and never put such secrets in frontend code.

## RLS boundary

Every application table enables Row Level Security. RLS, not routes or localStorage, is the security boundary. Policies scope organization data to members, permit users to access their own profile and scans, and give officers narrowly defined access. There is no broad authenticated read/write or application-table delete policy.

## Storage

`product-images`, `evidence-images`, and `reports` are private buckets. Product paths use `<organization-id>/<product-id>/...` and are available to organization members or officers. Evidence and future reports are officer-managed. Signed URL workflows are deferred.

## Authentication plan

Authentication wiring is deferred. Demo credentials are mock-only and do not authorize database access. Later work must provision profiles from verified Supabase Auth identities and must not silently replace failed live operations with mock results.
