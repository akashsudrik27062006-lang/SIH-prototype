-- LabelGuard Milestone 2A: schema, RLS, and private Storage foundation.
-- Apply only through Supabase migration tooling.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('government', 'manufacturer', 'seller', 'other')),
  registration_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  full_name text not null,
  email text not null,
  role text not null check (role in ('officer', 'manufacturer', 'seller', 'consumer')),
  organization_id uuid references public.organizations(id) on delete restrict,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_organization_required_for_organizational_roles check (
    role = 'consumer' or organization_id is not null
  )
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  name text not null,
  brand text,
  category text,
  subcategory text,
  sku text,
  manufacturer text,
  packer text,
  importer text,
  batch_number text,
  origin text,
  description text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  storage_path text not null unique,
  image_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  uploaded_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  scan_type text not null,
  status text not null check (status in ('PROCESSING', 'COMPLETED', 'FAILED')) default 'PROCESSING',
  -- Informational only; never a legal or enforcement determination.
  score numeric(5, 2) check (score is null or (score >= 0 and score <= 100)),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scans_completion_requires_completion_time check (
    status <> 'COMPLETED' or completed_at is not null
  )
);

create index products_organization_id_idx on public.products(organization_id);
create index product_images_product_id_idx on public.product_images(product_id);
create index scans_product_id_idx on public.scans(product_id);
create index scans_user_id_idx on public.scans(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger scans_set_updated_at before update on public.scans for each row execute function public.set_updated_at();

-- These helpers avoid recursive profile-policy checks and expose only booleans.
create or replace function public.is_officer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'officer');
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and organization_id = target_organization_id
  );
$$;

grant execute on function public.is_officer() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.scans enable row level security;

create policy "organization members and officers can read organizations" on public.organizations for select to authenticated
using (public.is_officer() or public.is_organization_member(id));
create policy "officers can create organizations" on public.organizations for insert to authenticated with check (public.is_officer());
create policy "officers can update organizations" on public.organizations for update to authenticated using (public.is_officer()) with check (public.is_officer());

create policy "users can read their profile and officers can read profiles" on public.profiles for select to authenticated
using (user_id = auth.uid() or public.is_officer());
create policy "users can create only their own profile" on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy "users can update their own profile and officers can update profiles" on public.profiles for update to authenticated
using (user_id = auth.uid() or public.is_officer()) with check (user_id = auth.uid() or public.is_officer());

create policy "organization members and officers can read products" on public.products for select to authenticated
using (public.is_officer() or public.is_organization_member(organization_id));
create policy "organization members can create their products" on public.products for insert to authenticated
with check (
  public.is_organization_member(organization_id)
  and created_by = (select id from public.profiles where user_id = auth.uid())
);
create policy "product creators and officers can update products" on public.products for update to authenticated
using (public.is_officer() or created_by = (select id from public.profiles where user_id = auth.uid()))
with check (
  public.is_officer() or (
    public.is_organization_member(organization_id)
    and created_by = (select id from public.profiles where user_id = auth.uid())
  )
);

create policy "product readers can read product images" on public.product_images for select to authenticated
using (public.is_officer() or exists (
  select 1 from public.products
  where products.id = product_images.product_id
    and public.is_organization_member(products.organization_id)
));
create policy "organization members can add product images" on public.product_images for insert to authenticated
with check (uploaded_by = auth.uid() and exists (
  select 1 from public.products
  where products.id = product_images.product_id
    and public.is_organization_member(products.organization_id)
));
create policy "uploaders and officers can update product image metadata" on public.product_images for update to authenticated
using (uploaded_by = auth.uid() or public.is_officer()) with check (uploaded_by = auth.uid() or public.is_officer());

create policy "scan owners, product organizations, and officers can read scans" on public.scans for select to authenticated
using (user_id = auth.uid() or public.is_officer() or exists (
  select 1 from public.products
  where products.id = scans.product_id
    and public.is_organization_member(products.organization_id)
));
create policy "users can create only their own scans" on public.scans for insert to authenticated with check (user_id = auth.uid());
create policy "officers can update scans" on public.scans for update to authenticated using (public.is_officer()) with check (public.is_officer());

-- No delete policies: a future retention policy must authorize compliance-record deletion.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false), ('evidence-images', 'evidence-images', false), ('reports', 'reports', false)
on conflict (id) do update set public = false;

-- Product object names: <organization-id>/<product-id>/... .
create policy "organization members and officers can read product storage" on storage.objects for select to authenticated
using (bucket_id = 'product-images' and (
  public.is_officer() or public.is_organization_member((storage.foldername(name))[1]::uuid)
));
create policy "organization members can upload product storage" on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_organization_member((storage.foldername(name))[1]::uuid));
create policy "officers can read evidence storage" on storage.objects for select to authenticated
using (bucket_id = 'evidence-images' and public.is_officer());
create policy "officers can upload evidence storage" on storage.objects for insert to authenticated
with check (bucket_id = 'evidence-images' and public.is_officer());
create policy "officers can read report storage" on storage.objects for select to authenticated
using (bucket_id = 'reports' and public.is_officer());
create policy "officers can upload report storage" on storage.objects for insert to authenticated
with check (bucket_id = 'reports' and public.is_officer());
