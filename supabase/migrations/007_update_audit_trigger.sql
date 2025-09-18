-- Make audit trigger tolerant when sidecar user row is missing
create or replace function public.write_audit_log()
returns trigger language plpgsql as $$
declare
  v_uid uuid := auth.uid();
  v_actor uuid;
begin
  -- Only set actor_user_id if a matching sidecar user exists
  select id into v_actor from public.users where id = v_uid;

  insert into public.audit_log (actor_user_id, action, entity, entity_id, payload)
  values (
    v_actor,
    tg_op,
    tg_table_name,
    coalesce((new).id, (old).id),
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else to_jsonb(old) end
  );
  return null;
end; $$;


