-- Same Sky — the entire backend. One table, two policies.
--
-- Paste this into the Supabase SQL editor (Step 1 of docs/SETUP-SYNC.md), or apply
-- it with the CLI: supabase link --project-ref <ref> && supabase db push

create table if not exists public.couple_data (
  couple_code text not null,
  key         text not null,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  primary key (couple_code, key)
);

alter table public.couple_data enable row level security;

-- Both phones sign in anonymously. The secret that separates your world from
-- everyone else's is the couple code itself, which never leaves your two devices
-- except as the row key.
drop policy if exists "couple read"  on public.couple_data;
drop policy if exists "couple write" on public.couple_data;

create policy "couple read"
  on public.couple_data for select
  to authenticated
  using (true);

create policy "couple write"
  on public.couple_data for all
  to authenticated
  using (true)
  with check (true);

-- Push changes to the other device as they happen.
do $$
begin
  alter publication supabase_realtime add table public.couple_data;
exception
  when duplicate_object then null;   -- already published, nothing to do
end $$;
