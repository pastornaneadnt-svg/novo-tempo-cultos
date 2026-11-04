-- =====================================================================
-- 002 · O pastor como pessoa da programação
-- Quando o pastor é o dirigente ou o responsável por uma oportunidade,
-- aparece só ele e fica confirmado automaticamente (sem convite).
-- Cole no Supabase: SQL Editor → New query → Run. Pode rodar de novo.
-- =====================================================================

alter table public.people add column if not exists is_pastor boolean not null default false;
create unique index if not exists people_one_pastor on public.people ((true)) where is_pastor;

create or replace function public._person_json(p_id uuid, p_with_phone boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p.id is null then null else
    jsonb_build_object('id', p.id, 'name', p.name, 'note', p.note, 'is_pastor', p.is_pastor)
    || case when p_with_phone then jsonb_build_object('phone', p.phone) else '{}'::jsonb end
  end
  from (select 1) x left join people p on p.id = p_id;
$$;

-- O pastor (para o botão "Eu (Pastor)" ao escolher pessoas)
create or replace function public.get_pastor(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public._is_admin() or public._is_director(p_token)) then raise exception 'sem permissão'; end if;
  return (select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'note', note, 'is_pastor', true)
          from people where is_pastor limit 1);
end $$;

create or replace function public.search_people(p_token uuid, q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public._is_admin() or public._is_director(p_token)) then raise exception 'sem permissão'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'phone', phone, 'note', note, 'is_pastor', is_pastor)
                     order by is_pastor desc, name)
    from (select * from people
          where q is null or q = '' or name ilike '%' || q || '%' or note ilike '%' || q || '%' or phone ilike '%' || q || '%'
          order by is_pastor desc, name limit 30) s), '[]'::jsonb);
end $$;

create or replace function public.save_person(p_token uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v_pastor boolean := coalesce((p->>'is_pastor')::boolean, false);
begin
  if not (public._is_admin() or public._is_director(p_token)) then raise exception 'sem permissão'; end if;
  if coalesce(trim(p->>'name'),'') = '' then raise exception 'nome obrigatório'; end if;
  -- Só o pastor (administrador) pode se marcar como pastor.
  if v_pastor and not public._is_admin() then v_pastor := false; end if;
  if v_pastor then
    select id into v_id from people where is_pastor limit 1;
  end if;
  if v_id is null then
    insert into people(name, phone, note, is_pastor)
    values (trim(p->>'name'), nullif(trim(p->>'phone'),''), nullif(trim(p->>'note'),''), v_pastor)
    returning id into v_id;
  else
    update people set name = trim(p->>'name'), phone = nullif(trim(p->>'phone'),''), note = nullif(trim(p->>'note'),'')
    where id = v_id;
  end if;
  return (select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'note', note, 'is_pastor', is_pastor) from people where id = v_id);
end $$;

-- Oportunidade do pastor = confirmada automaticamente
create or replace function public._items_pastor_auto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null and exists (select 1 from people where id = new.person_id and is_pastor) then
    new.status := 'aceito';
    new.responded_at := coalesce(new.responded_at, now());
  end if;
  return new;
end $$;

drop trigger if exists items_pastor_auto on public.items;
create trigger items_pastor_auto before insert or update on public.items
for each row execute function public._items_pastor_auto();

revoke execute on function public.get_pastor(uuid), public._items_pastor_auto() from public, anon, authenticated;
grant execute on function public.get_pastor(uuid) to anon, authenticated;
