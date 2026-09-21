# Database Schema

Milestone 2A introduces a version-controlled Supabase PostgreSQL foundation in `supabase/migrations/`. The migration has not been applied to a remote project.

## Tables and relationships

| Table | Purpose | Relationships |
| --- | --- | --- |
| `organizations` | Government and business records | Referenced by profiles and products. |
| `profiles` | Application identity, role, and membership | `user_id` references `auth.users`; `organization_id` references organizations. |
| `products` | Packaged-product metadata | `organization_id` references organizations; `created_by` references profiles. |
| `product_images` | Metadata for privately stored package images | `product_id` references products; `uploaded_by` references `auth.users`. |
| `scans` | Scan lifecycle metadata | `product_id` and `user_id` reference products and `auth.users`. Score is informational, not legal. |

All identifiers are UUIDs. Foreign keys use `RESTRICT`, preventing accidental removal of products, scans, or evidence when a related identity or organization is removed. Application-table delete policies are intentionally omitted.

## Roles and organization model

Profiles use `officer`, `manufacturer`, `seller`, or `consumer`. Manufacturer and seller profiles require an organization; consumers may have none. Officers require a government organization. Organization types are `government`, `manufacturer`, `seller`, and `other`.

## Migration strategy

Introduce every schema change as a new, ordered file in `supabase/migrations/`; never rewrite an applied migration. Applying migrations remotely is a separate authenticated deployment step.
