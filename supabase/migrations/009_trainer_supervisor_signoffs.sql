-- Add supervisor role to user_role enum if missing
do $$ begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'supervisor'
  ) then
    alter type user_role add value 'supervisor';
  end if;
exception when duplicate_object then null; end $$;

-- Add trainer_user_id to assignments
alter table if exists public.assignments
  add column if not exists trainer_user_id uuid references public.users(id) on delete set null;
create index if not exists idx_assignments_trainer on public.assignments(trainer_user_id);

-- Trainer sign-offs table
create table if not exists public.trainer_signoffs (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.completions(id) on delete cascade,
  trainer_user_id uuid not null references public.users(id) on delete restrict,
  signed_name_snapshot text not null,
  signed_email_snapshot text not null,
  signed_at timestamptz not null default now(),
  ip_addr inet,
  user_agent text,
  unique(completion_id)
);

-- Enable RLS
alter table public.trainer_signoffs enable row level security;

-- Update policies: assignments readable by trainer
drop policy if exists assignments_employee_read on public.assignments;
create policy assignments_employee_read on public.assignments for select using (
  assigned_to = auth.uid() or trainer_user_id = auth.uid() or public.is_admin()
);

-- Update completions read to allow trainer
drop policy if exists completions_employee_read on public.completions;
create policy completions_employee_read on public.completions for select using (
  exists (
    select 1 from public.assignments a
    where a.id = completions.assignment_id
      and (a.assigned_to = auth.uid() or a.trainer_user_id = auth.uid() or public.is_admin())
  )
);

-- Trainer signoffs policies
drop policy if exists trainer_signoffs_read on public.trainer_signoffs;
create policy trainer_signoffs_read on public.trainer_signoffs for select using (
  trainer_user_id = auth.uid() or public.is_admin()
);

drop policy if exists trainer_signoffs_insert on public.trainer_signoffs;
create policy trainer_signoffs_insert on public.trainer_signoffs for insert with check (
  trainer_user_id = auth.uid()
);


