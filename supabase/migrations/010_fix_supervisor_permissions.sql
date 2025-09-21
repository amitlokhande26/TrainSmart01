-- Fix is_admin function to include supervisor role
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select public.current_role() in ('admin','manager','supervisor');
$$;

-- Update modules policy to allow supervisors to see all modules
drop policy if exists modules_employee_select on public.modules;
create policy modules_employee_select on public.modules for select using (
  public.is_admin() or exists (
    select 1 from public.assignments a where a.module_id = modules.id and a.assigned_to = auth.uid()
  )
);
