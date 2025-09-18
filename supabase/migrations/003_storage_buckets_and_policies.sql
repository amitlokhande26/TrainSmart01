-- Create storage buckets
insert into storage.buckets (id, name, public) values
  ('training-materials','training-materials', false),
  ('scorm-packages','scorm-packages', false),
  ('xapi-exports','xapi-exports', false)
on conflict (id) do nothing;

-- Storage policies align with RLS: allow admins full, employees read only for assigned modules via signed URLs
-- For simplicity, deny direct anon access and serve via signed urls through Edge Function
drop policy if exists "Admin full access" on storage.objects;
create policy "Admin full access" on storage.objects for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "No direct anon read" on storage.objects;
create policy "No direct anon read" on storage.objects for select
  using (false);





