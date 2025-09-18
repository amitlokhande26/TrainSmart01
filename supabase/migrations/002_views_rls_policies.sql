-- Views for dashboards
create or replace view public.v_employee_progress as
select
  u.id as user_id,
  count(a.*) filter (where a.status in ('assigned','in_progress','overdue')) as assigned_count,
  count(a.*) filter (where a.status = 'completed') as completed_count,
  case when count(a.*) = 0 then 0
       else round(100.0 * count(a.*) filter (where a.status='completed') / count(a.*), 1)
  end as pct_complete
from public.users u
left join public.assignments a on a.assigned_to = u.id
group by u.id;

create or replace view public.v_module_coverage as
select
  m.id as module_id,
  count(a.*) as assigned_count,
  count(a.*) filter (where a.status = 'completed') as completed_count,
  count(a.*) filter (where a.status = 'overdue') as overdue_count
from public.modules m
left join public.assignments a on a.module_id = m.id
group by m.id;

-- Helper functions for policies
create or replace function public.current_role()
returns text language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'),
                  (auth.jwt() -> 'user_metadata' ->> 'role'))::text;
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role() in ('admin','manager');
$$;

-- Enable RLS
alter table public.users enable row level security;
alter table public.lines enable row level security;
alter table public.categories enable row level security;
alter table public.modules enable row level security;
alter table public.assignments enable row level security;
alter table public.completions enable row level security;
alter table public.signatures enable row level security;
alter table public.audit_log enable row level security;

-- Users policies
drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users for select using (
  id = auth.uid() or public.is_admin()
);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update using (
  id = auth.uid() or public.is_admin()
) with check (
  id = auth.uid() or public.is_admin()
);

drop policy if exists users_insert_admin_only on public.users;
create policy users_insert_admin_only on public.users for insert with check (
  public.is_admin()
);

-- Lines & Categories: read for all authenticated; write admin only
drop policy if exists lines_read_all on public.lines;
create policy lines_read_all on public.lines for select using (true);

drop policy if exists lines_write_admin on public.lines;
create policy lines_write_admin on public.lines for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_read_all on public.categories;
create policy categories_read_all on public.categories for select using (true);

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

-- Modules: employees can see only modules assigned to them; admins full
drop policy if exists modules_admin_all on public.modules;
create policy modules_admin_all on public.modules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists modules_employee_select on public.modules;
create policy modules_employee_select on public.modules for select using (
  public.is_admin() or exists (
    select 1 from public.assignments a where a.module_id = modules.id and a.assigned_to = auth.uid()
  )
);

-- Assignments
drop policy if exists assignments_employee_read on public.assignments;
create policy assignments_employee_read on public.assignments for select using (
  assigned_to = auth.uid() or public.is_admin()
);

drop policy if exists assignments_admin_write on public.assignments;
create policy assignments_admin_write on public.assignments for all using (public.is_admin()) with check (public.is_admin());

-- Completions
drop policy if exists completions_employee_read on public.completions;
create policy completions_employee_read on public.completions for select using (
  exists (select 1 from public.assignments a where a.id = completions.assignment_id and (a.assigned_to = auth.uid() or public.is_admin()))
);

drop policy if exists completions_employee_insert on public.completions;
create policy completions_employee_insert on public.completions for insert with check (
  exists (select 1 from public.assignments a where a.id = completions.assignment_id and a.assigned_to = auth.uid())
);

-- Signatures
drop policy if exists signatures_employee_read on public.signatures;
create policy signatures_employee_read on public.signatures for select using (
  signer_user_id = auth.uid() or public.is_admin()
);

drop policy if exists signatures_employee_insert on public.signatures;
create policy signatures_employee_insert on public.signatures for insert with check (
  signer_user_id = auth.uid() and exists (
    select 1 from public.completions c where c.id = signatures.completion_id
  )
);

-- Audit log: read admin only; insert via trigger (future)
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());





