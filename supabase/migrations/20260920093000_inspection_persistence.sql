-- LabelGuard: persistent officer inspections, analysis records, findings, and evidence metadata.
-- This migration is additive and preserves all existing data.

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_number text not null unique default ('INSP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  officer_user_id uuid not null references auth.users(id) on delete restrict,
  officer_profile_id uuid not null references public.profiles(id) on delete restrict,
  product_name text,
  brand_name text,
  responsible_party text,
  batch_number text,
  inspection_location text,
  inspection_type text,
  officer_remarks text,
  inspected_at timestamptz not null default now(),
  scan_status text not null check (scan_status in ('PENDING', 'COMPLETED', 'FAILED')) default 'PENDING',
  preliminary_compliance_score numeric(5, 2) check (preliminary_compliance_score is null or (preliminary_compliance_score >= 0 and preliminary_compliance_score <= 100)),
  score_label text not null default 'Preliminary Compliance Score',
  overall_status text not null default 'WARNING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scans add column inspection_id uuid references public.inspections(id) on delete restrict;
alter table public.scans add column extracted_declarations jsonb;
alter table public.scans add column evidence_source text;
alter table public.scans add column provider text;
alter table public.scans add column model text;
alter table public.scans add column scanned_at timestamptz;

create table public.inspection_images (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  image_type text not null,
  storage_path text not null unique,
  original_filename text not null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete restrict,
  rule_code text not null,
  rule_number text not null,
  rule_name text not null,
  requirement text not null,
  detected_value text,
  expected_value text,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric,
  severity text,
  status text not null check (status in ('POTENTIAL', 'VERIFIED', 'REJECTED', 'MODIFIED', 'REVIEW_REQUIRED')),
  recommendation text,
  source_url text,
  officer_observation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inspections_officer_user_id_idx on public.inspections(officer_user_id);
create index inspections_inspected_at_idx on public.inspections(inspected_at desc);
create index scans_inspection_id_idx on public.scans(inspection_id);
create index inspection_images_inspection_id_idx on public.inspection_images(inspection_id);
create index inspection_findings_inspection_id_idx on public.inspection_findings(inspection_id);

create trigger inspections_set_updated_at before update on public.inspections for each row execute function public.set_updated_at();
create trigger inspection_findings_set_updated_at before update on public.inspection_findings for each row execute function public.set_updated_at();

alter table public.inspections enable row level security;
alter table public.inspection_images enable row level security;
alter table public.inspection_findings enable row level security;

create policy "officers can read inspections" on public.inspections for select to authenticated using (public.is_officer());
create policy "officers can create their inspections" on public.inspections for insert to authenticated with check (public.is_officer() and officer_user_id = auth.uid());
create policy "officers can update inspections" on public.inspections for update to authenticated using (public.is_officer()) with check (public.is_officer());

create policy "officers can read inspection images" on public.inspection_images for select to authenticated using (public.is_officer());
create policy "officers can add inspection images" on public.inspection_images for insert to authenticated with check (public.is_officer() and uploaded_by = auth.uid());

create policy "officers can read inspection findings" on public.inspection_findings for select to authenticated using (public.is_officer());
create policy "officers can add inspection findings" on public.inspection_findings for insert to authenticated with check (public.is_officer());
create policy "officers can update inspection findings" on public.inspection_findings for update to authenticated using (public.is_officer()) with check (public.is_officer());

-- Evidence object names: <inspection-id>/<timestamp>-<filename>.
create policy "officers can upload inspection evidence storage" on storage.objects for insert to authenticated
with check (bucket_id = 'evidence-images' and public.is_officer());
