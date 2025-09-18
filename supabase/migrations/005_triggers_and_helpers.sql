-- Audit log trigger generic
create or replace function public.write_audit_log()
returns trigger language plpgsql as $$
begin
  insert into public.audit_log (actor_user_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((new).id, (old).id),
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else to_jsonb(old) end
  );
  return null;
end; $$;

-- Attach to key tables
drop trigger if exists trg_audit_modules on public.modules;
create trigger trg_audit_modules after insert or update or delete on public.modules
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_assignments on public.assignments;
create trigger trg_audit_assignments after insert or update or delete on public.assignments
for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_users on public.users;
create trigger trg_audit_users after insert or update or delete on public.users
for each row execute function public.write_audit_log();

-- Overdue status helper (to be run via scheduled function)
create or replace function public.mark_overdue_assignments()
returns void language sql as $$
  update public.assignments
  set status = 'overdue'
  where due_date < current_date and status <> 'completed';
$$;





