-- Allow admins/managers to insert into audit_log (used by triggers)
do $$ begin
  create policy audit_admin_insert on public.audit_log
  for insert
  with check (public.is_admin());
exception when duplicate_object then null; end $$;


