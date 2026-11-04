-- =====================================================================
-- AD Novo Tempo · App de Cultos · Esquema do banco (Fase 1)
-- Cole TODO este arquivo no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tabelas ----------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'culto',
  title text not null default 'Culto',
  event_date date not null,
  start_time time not null default '19:00',
  end_time time not null default '21:00',
  theme text,
  verse text,
  main_reading text,
  notes text,
  director_id uuid references public.people(id) on delete set null,
  director_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_date_idx on public.events(event_date);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  section text not null default 'programa' check (section in ('programa','apoio')),
  position int not null default 0,
  kind text not null,
  title text,
  duration_min int not null default 5 check (duration_min >= 0 and duration_min <= 600),
  person_id uuid references public.people(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','aceito','recusado')),
  response_note text,
  responded_at timestamptz,
  invite_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);
create index if not exists items_event_idx on public.items(event_id, section, position);

-- Ninguém acessa as tabelas diretamente: tudo passa pelas funções abaixo.
alter table public.admins enable row level security;
alter table public.people enable row level security;
alter table public.events enable row level security;
alter table public.items  enable row level security;
revoke all on public.admins, public.people, public.events, public.items from anon, authenticated;

-- ---------- Funções internas -------------------------------------------

create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public._is_director(p_token uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_token is not null and exists (select 1 from events where director_token = p_token);
$$;

create or replace function public._can_edit(p_event uuid, p_token uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public._is_admin()
      or (p_token is not null and exists (select 1 from events where id = p_event and director_token = p_token));
$$;

create or replace function public._person_json(p_id uuid, p_with_phone boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p.id is null then null else
    jsonb_build_object('id', p.id, 'name', p.name, 'note', p.note)
    || case when p_with_phone then jsonb_build_object('phone', p.phone) else '{}'::jsonb end
  end
  from (select 1) x left join people p on p.id = p_id;
$$;

-- ---------- Administração ----------------------------------------------

create or replace function public.has_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public._is_admin();
$$;

-- O primeiro usuário que entrar vira o administrador (o pastor).
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  lock table admins in exclusive mode;
  if not exists (select 1 from admins) then
    insert into admins(user_id) values (auth.uid());
  end if;
  return public._is_admin();
end $$;

-- ---------- Eventos ----------------------------------------------------

create or replace function public.list_events(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'sem permissão'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.event_date, t.start_time)
    from (
      select e.id, e.kind, e.title, e.event_date, e.start_time, e.end_time, e.theme,
             (select name from people where id = e.director_id) as director_name,
             (select coalesce(sum(duration_min),0) from items i where i.event_id = e.id and i.section='programa') as filled_min,
             (select count(*) from items i where i.event_id = e.id and i.person_id is not null) as invited,
             (select count(*) from items i where i.event_id = e.id and i.person_id is not null and i.status='aceito') as accepted,
             (select count(*) from items i where i.event_id = e.id and i.person_id is not null and i.status='recusado') as declined
      from events e
      where e.event_date between p_from and p_to
    ) t), '[]'::jsonb);
end $$;

create or replace function public.director_event(p_token uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from events where director_token = p_token;
$$;

create or replace function public.get_event(p_event uuid, p_token uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean := public._is_admin(); r jsonb;
begin
  if not public._can_edit(p_event, p_token) then raise exception 'sem permissão'; end if;
  select jsonb_build_object(
    'is_admin', v_admin,
    'event', (to_jsonb(e) - case when v_admin then 'x' else 'director_token' end)
             || jsonb_build_object('director', public._person_json(e.director_id, true)),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) || jsonb_build_object('person', public._person_json(i.person_id, true))
                       order by i.section, i.position)
      from items i where i.event_id = e.id), '[]'::jsonb)
  ) into r
  from events e where e.id = p_event;
  return r;
end $$;

create or replace function public.save_event(p_token uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if v_id is null then
    if not public._is_admin() then raise exception 'sem permissão'; end if;
    insert into events(kind, title, event_date, start_time, end_time, theme, verse, main_reading, notes, director_id)
    values (coalesce(p->>'kind','culto'), coalesce(nullif(p->>'title',''),'Culto'), (p->>'event_date')::date,
            coalesce((p->>'start_time')::time,'19:00'), coalesce((p->>'end_time')::time,'21:00'),
            p->>'theme', p->>'verse', p->>'main_reading', p->>'notes', nullif(p->>'director_id','')::uuid)
    returning id into v_id;
    return v_id;
  end if;
  if not public._can_edit(v_id, p_token) then raise exception 'sem permissão'; end if;
  update events set
    title = coalesce(nullif(p->>'title',''), title),
    event_date = coalesce((p->>'event_date')::date, event_date),
    start_time = coalesce((p->>'start_time')::time, start_time),
    end_time = coalesce((p->>'end_time')::time, end_time),
    theme = case when p ? 'theme' then p->>'theme' else theme end,
    verse = case when p ? 'verse' then p->>'verse' else verse end,
    main_reading = case when p ? 'main_reading' then p->>'main_reading' else main_reading end,
    notes = case when p ? 'notes' then p->>'notes' else notes end,
    director_id = case when p ? 'director_id' and public._is_admin() then nullif(p->>'director_id','')::uuid else director_id end,
    updated_at = now()
  where id = v_id;
  return v_id;
end $$;

create or replace function public.delete_event(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'sem permissão'; end if;
  delete from events where id = p_id;
end $$;

create or replace function public.regen_director_token(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid := gen_random_uuid();
begin
  if not public._is_admin() then raise exception 'sem permissão'; end if;
  update events set director_token = t where id = p_id;
  return t;
end $$;

-- ---------- Oportunidades / equipe de apoio ----------------------------

create or replace function public.save_item(p_token uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v_event uuid; v_old_person uuid; v_new_person uuid;
begin
  if v_id is null then
    v_event := (p->>'event_id')::uuid;
    if not public._can_edit(v_event, p_token) then raise exception 'sem permissão'; end if;
    insert into items(event_id, section, position, kind, title, duration_min, person_id, details)
    values (v_event, coalesce(p->>'section','programa'),
            coalesce((p->>'position')::int,
              (select coalesce(max(position),-1)+1 from items where event_id = v_event and section = coalesce(p->>'section','programa'))),
            p->>'kind', nullif(p->>'title',''), coalesce((p->>'duration_min')::int, 5),
            nullif(p->>'person_id','')::uuid, coalesce(p->'details','{}'::jsonb))
    returning id into v_id;
    return v_id;
  end if;
  select event_id, person_id into v_event, v_old_person from items where id = v_id;
  if v_event is null or not public._can_edit(v_event, p_token) then raise exception 'sem permissão'; end if;
  v_new_person := case when p ? 'person_id' then nullif(p->>'person_id','')::uuid else v_old_person end;
  update items set
    kind = coalesce(p->>'kind', kind),
    title = case when p ? 'title' then nullif(p->>'title','') else title end,
    duration_min = coalesce((p->>'duration_min')::int, duration_min),
    details = case when p ? 'details' then p->'details' else details end,
    person_id = v_new_person,
    status = case when v_new_person is distinct from v_old_person then 'pendente'
                  when p ? 'status' then p->>'status' else status end,
    response_note = case when v_new_person is distinct from v_old_person then null else response_note end,
    responded_at = case when v_new_person is distinct from v_old_person then null else responded_at end,
    invite_token = case when v_new_person is distinct from v_old_person then gen_random_uuid() else invite_token end,
    updated_at = now()
  where id = v_id;
  return v_id;
end $$;

create or replace function public.delete_item(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_event uuid;
begin
  select event_id into v_event from items where id = p_id;
  if v_event is null or not public._can_edit(v_event, p_token) then raise exception 'sem permissão'; end if;
  delete from items where id = p_id;
end $$;

create or replace function public.reorder_items(p_token uuid, p_event uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._can_edit(p_event, p_token) then raise exception 'sem permissão'; end if;
  update items i set position = x.ord - 1, updated_at = now()
  from unnest(p_ids) with ordinality as x(id, ord)
  where i.id = x.id and i.event_id = p_event;
end $$;

create or replace function public.regen_item_token(p_token uuid, p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_event uuid; t uuid := gen_random_uuid();
begin
  select event_id into v_event from items where id = p_id;
  if v_event is null or not public._can_edit(v_event, p_token) then raise exception 'sem permissão'; end if;
  update items set invite_token = t where id = p_id;
  return t;
end $$;

-- ---------- Pessoas ----------------------------------------------------

create or replace function public.search_people(p_token uuid, q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public._is_admin() or public._is_director(p_token)) then raise exception 'sem permissão'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'phone', phone, 'note', note) order by name)
    from (select * from people
          where q is null or q = '' or name ilike '%' || q || '%' or note ilike '%' || q || '%' or phone ilike '%' || q || '%'
          order by name limit 30) s), '[]'::jsonb);
end $$;

create or replace function public.save_person(p_token uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid;
begin
  if not (public._is_admin() or public._is_director(p_token)) then raise exception 'sem permissão'; end if;
  if coalesce(trim(p->>'name'),'') = '' then raise exception 'nome obrigatório'; end if;
  if v_id is null then
    insert into people(name, phone, note) values (trim(p->>'name'), nullif(trim(p->>'phone'),''), nullif(trim(p->>'note'),''))
    returning id into v_id;
  else
    update people set name = trim(p->>'name'), phone = nullif(trim(p->>'phone'),''), note = nullif(trim(p->>'note'),'')
    where id = v_id;
  end if;
  return (select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'note', note) from people where id = v_id);
end $$;

-- ---------- Convites (link de quem tem oportunidade) -------------------

create or replace function public.get_invite(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_item items; r jsonb;
begin
  select * into v_item from items where invite_token = p_token;
  if v_item.id is null then return null; end if;
  select jsonb_build_object(
    'item', (to_jsonb(v_item) - 'invite_token') || jsonb_build_object('person', public._person_json(v_item.person_id, false)),
    'event', (to_jsonb(e) - 'director_token') || jsonb_build_object('director', public._person_json(e.director_id, false)),
    'items', coalesce((
      select jsonb_agg((to_jsonb(i) - 'invite_token' - 'response_note') || jsonb_build_object('person', public._person_json(i.person_id, false))
                       order by i.section, i.position)
      from items i where i.event_id = e.id), '[]'::jsonb)
  ) into r
  from events e where e.id = v_item.event_id;
  return r;
end $$;

create or replace function public.respond_invite(p_token uuid, p_status text, p_details jsonb, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('aceito','recusado') then raise exception 'status inválido'; end if;
  update items set
    status = p_status,
    details = details || coalesce(p_details, '{}'::jsonb),
    response_note = nullif(trim(p_note),''),
    responded_at = now(),
    updated_at = now()
  where invite_token = p_token;
  if not found then raise exception 'convite não encontrado'; end if;
end $$;

-- ---------- Permissões das funções -------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.has_admin(), public.is_admin(), public.claim_admin(),
  public.list_events(date, date), public.director_event(uuid), public.get_event(uuid, uuid),
  public.save_event(uuid, jsonb), public.delete_event(uuid), public.regen_director_token(uuid),
  public.save_item(uuid, jsonb), public.delete_item(uuid, uuid), public.reorder_items(uuid, uuid, uuid[]),
  public.regen_item_token(uuid, uuid), public.search_people(uuid, text), public.save_person(uuid, jsonb),
  public.get_invite(uuid), public.respond_invite(uuid, text, jsonb, text)
to anon, authenticated;
