-- 일별 방문자 수 카운터. Supabase 프로젝트의 SQL Editor에서 한 번만 실행하면 됩니다.
create table if not exists visit_counts (
  date date primary key,
  count integer not null default 0
);

-- upsert + 증가를 단일 SQL 문으로 처리해 동시 방문에도 카운트가 원자적으로 늘어난다.
create or replace function increment_visit(p_date date)
returns integer
language sql
as $$
  insert into visit_counts (date, count) values (p_date, 1)
  on conflict (date) do update set count = visit_counts.count + 1
  returning count;
$$;
