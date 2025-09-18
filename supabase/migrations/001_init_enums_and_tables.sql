-- Enable extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type user_role as enum ('admin','manager','employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type module_type as enum ('doc','ppt','video','scorm','xapi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum ('assigned','in_progress','completed','overdue');
exception when duplicate_object then null; end $$;

-- Users sidecar table mapping to auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  role user_role not null default 'employee',
  created_at timestamptz not null default now()
);

-- Lines (e.g., Canning Line 1, ...)
create table if not exists public.lines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Categories within each line
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(line_id, name)
);

-- Training modules
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  line_id uuid not null references public.lines(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  type module_type not null,
  storage_path text not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_modules_line on public.modules(line_id);
create index if not exists idx_modules_category on public.modules(category_id);
create index if not exists idx_modules_type on public.modules(type);

-- Assignments of modules to users
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  assigned_to uuid not null references public.users(id) on delete cascade,
  assigned_by uuid not null references public.users(id) on delete set null,
  due_date date,
  status assignment_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  unique(module_id, assigned_to)
);
create index if not exists idx_assignments_to on public.assignments(assigned_to);
create index if not exists idx_assignments_module on public.assignments(module_id);

-- Completions
create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  completed_at timestamptz not null default now(),
  score numeric,
  notes text,
  unique(assignment_id)
);

-- Signatures (immutable)
create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.completions(id) on delete cascade,
  signer_user_id uuid not null references public.users(id) on delete restrict,
  signed_name_snapshot text not null,
  signed_email_snapshot text not null,
  signed_at timestamptz not null default now(),
  ip_addr inet,
  user_agent text,
  unique(completion_id)
);

-- Audit log (immutable append-only)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);





