-- Seed Lines
insert into public.lines (name) values
  ('Canning Line 1'),
  ('Canning Line 2'),
  ('Kegging Line'),
  ('Bottling Line 1'),
  ('Bottling Line 2'),
  ('General Training')
on conflict (name) do nothing;

-- Seed Categories for first 5 lines
with base as (
  select id, name from public.lines where name in ('Canning Line 1','Canning Line 2','Kegging Line','Bottling Line 1','Bottling Line 2')
), cats as (
  select 'QA Training' as cat
  union all select 'PLW Training'
  union all select 'Supervisor Training'
)
insert into public.categories (line_id, name)
select b.id, c.cat from base b cross join cats c
on conflict (line_id, name) do nothing;





