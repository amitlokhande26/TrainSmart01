-- Allow employees to create signed URLs for training materials assigned to them
-- This enables storage.from('training-materials').createSignedUrl(name, ...) from the client

drop policy if exists "Employee read assigned materials" on storage.objects;
create policy "Employee read assigned materials" on storage.objects
  for select
  using (
    bucket_id = 'training-materials' and exists (
      select 1
      from public.modules m
      join public.assignments a on a.module_id = m.id
      where m.storage_path = storage.objects.name
        and a.assigned_to = auth.uid()
    )
  );


