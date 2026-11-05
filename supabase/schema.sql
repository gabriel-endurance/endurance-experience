-- Endurance experience: access log.
-- Run once in Supabase → SQL Editor.

create table if not exists public.accesses (
  id             text primary key,               -- access ID shown in the admin panel (e.g. AKKD-SFAX)
  token_hash     text unique not null,           -- sha256 of the browser session token
  code           text not null,                  -- invite code used (ENDR-0001 … ENDR-1000)
  name           text,
  ip             text,
  started_at     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  active_seconds double precision not null default 0
);

create index if not exists accesses_started_at_idx on public.accesses (started_at desc);

-- RLS on with no policies: only the server (service role / secret key) can read or write.
alter table public.accesses enable row level security;

-- Heartbeat: adds the time since the last ping when the gap is short (page open and visible).
create or replace function public.touch_access(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update accesses
     set active_seconds = active_seconds + case
           when extract(epoch from now() - last_seen) between 0 and 75 then extract(epoch from now() - last_seen)
           else 0 end,
         last_seen = now()
   where token_hash = p_token_hash;
  return found;
end;
$$;

revoke execute on function public.touch_access(text) from public, anon, authenticated;
