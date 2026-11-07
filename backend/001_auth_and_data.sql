-- Executar no Supabase. A base empresarial NÃO é distribuída em data.json.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table private.allowed_email_domains (domain text primary key check(domain = lower(domain)));
insert into private.allowed_email_domains values ('investepiaui.com'); -- domínio provisório
alter table private.allowed_email_domains enable row level security;
revoke all on private.allowed_email_domains from anon, authenticated;

create table public.staff_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'viewer' check(role in ('admin','analyst','viewer')),
 active boolean not null default true
);
alter table public.staff_profiles enable row level security;
revoke all on public.staff_profiles from anon, authenticated;
grant select on public.staff_profiles to authenticated;

-- Executa no servidor mesmo que o cliente ignore o formulário de cadastro.
create function private.guard_staff_domain() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.email is null or not exists (
   select 1 from private.allowed_email_domains d where d.domain=lower(split_part(new.email,'@',2))
 ) then raise exception 'Domínio de e-mail não autorizado'; end if;
 return new;
end $$;
revoke all on function private.guard_staff_domain() from public, anon, authenticated;
create trigger enforce_staff_domain before insert or update of email on auth.users for each row execute function private.guard_staff_domain();

create function private.create_staff_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.staff_profiles(id) values(new.id);
 return new;
end $$;
revoke all on function private.create_staff_profile() from public, anon, authenticated;
create trigger create_staff_profile after insert on auth.users for each row execute function private.create_staff_profile();

create function private.staff_access(required_role text default null) returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
 select 1 from auth.users u join public.staff_profiles p on p.id=u.id
 join private.allowed_email_domains d on d.domain=lower(split_part(u.email,'@',2))
 where u.id=auth.uid() and u.email_confirmed_at is not null and p.active
 and exists(select 1 from auth.sessions s where s.user_id=u.id and s.id::text=(auth.jwt()->>'session_id'))
 and (required_role is null or p.role=required_role)
 );
$$;
revoke all on function private.staff_access(text) from public, anon;
grant execute on function private.staff_access(text) to authenticated;
create policy own_profile on public.staff_profiles for select to authenticated using(id=(select auth.uid()));

create table public.asg_datasets (
 id uuid primary key default gen_random_uuid(),
 source_name text not null,
 reference_date date not null,
 created_at timestamptz not null default now(),
 created_by uuid default auth.uid(),
 payload jsonb not null check(jsonb_typeof(payload)='object')
);
alter table public.asg_datasets enable row level security;
revoke all on public.asg_datasets from anon, authenticated;
grant select, insert on public.asg_datasets to authenticated;
create policy staff_read on public.asg_datasets for select to authenticated using((select private.staff_access()));
create policy admin_import on public.asg_datasets for insert to authenticated with check((select private.staff_access('admin')) and created_by=(select auth.uid()));
create index asg_datasets_created_at_idx on public.asg_datasets(created_at desc);
create index asg_datasets_created_by_idx on public.asg_datasets(created_by);
-- Sem UPDATE/DELETE: snapshots anteriores são preservados.
commit;
