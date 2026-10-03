-- Simula o mínimo do Supabase/Lovable para testar a migração num Postgres local.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
create type public.app_role as enum ('admin', 'user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null, role app_role not null);
create function public.has_role(_user_id uuid, _role app_role) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin');
