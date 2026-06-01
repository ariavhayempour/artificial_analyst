-- Quant AI trading terminal — initial schema, RLS, and invite-only allowlist.
--
-- Apply with the Supabase CLI (`supabase db push`) against your linked project,
-- or paste into the SQL editor. RLS is the real security boundary: every data
-- operation must run under the signed-in user's JWT.

-- ---------------------------------------------------------------------------
-- allowlist: only these emails may create an account (enforced server-side).
-- ---------------------------------------------------------------------------
create table if not exists public.allowlist (
    email     text primary key,
    added_at  timestamptz not null default now()
);

-- Lock the allowlist down: RLS on with NO policies => deny all to anon/authed.
-- It is read only by the SECURITY DEFINER trigger below and managed via SQL /
-- the service role.
alter table public.allowlist enable row level security;

-- ---------------------------------------------------------------------------
-- transactions: the ledger. Holdings and realized P&L are derived from this.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users (id) on delete cascade
                         default auth.uid(),
    ticker           text not null,
    side             text not null check (side in ('buy', 'sell')),
    quantity         numeric not null check (quantity > 0),
    price_per_share  numeric not null check (price_per_share >= 0),
    traded_at        date not null default current_date,
    created_at       timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);

-- Owner-only access: a user can touch only rows where user_id = auth.uid().
alter table public.transactions enable row level security;

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
    for select using (auth.uid() = user_id);

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions
    for insert with check (auth.uid() = user_id);

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own on public.transactions
    for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Invite-only enforcement: block sign-ups whose email is not on the allowlist.
-- Runs as SECURITY DEFINER so it can read the locked-down allowlist table, and
-- fires before a new auth.users row is created. Client-side checks are UX only;
-- this is the real gate.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_allowlist()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as $$
begin
    if not exists (
        select 1 from public.allowlist
        where lower(email) = lower(new.email)
    ) then
        raise exception 'Email % is not authorized to sign up', new.email
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists enforce_allowlist_before_insert on auth.users;
create trigger enforce_allowlist_before_insert
    before insert on auth.users
    for each row execute function public.enforce_allowlist();

-- enforce_allowlist() is trigger-only — don't expose it via the PostgREST RPC
-- endpoint. Triggers still fire regardless of these EXECUTE grants.
revoke execute on function public.enforce_allowlist() from public, anon, authenticated;

-- Seed your authorized users here, e.g.:
--   insert into public.allowlist (email) values ('ariavhayempour@gmail.com');
