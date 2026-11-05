-- =====================================================================
-- 004 · "Precisa de confirmação?" e correção do pastor duplicado
-- Cole TODO o arquivo no Supabase: SQL Editor → New query → Run.
-- Pode rodar de novo sem problema.
-- =====================================================================

-- 1) Oportunidades que não precisam de confirmação (ex.: oração simples)
alter table public.items add column if not exists needs_confirmation boolean not null default true;

-- 2) Confirmação automática: pastor OU oportunidade sem confirmação
create or replace function public._items_pastor_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pastor boolean := new.person_id is not null and exists (select 1 from people where id = new.person_id and is_pastor);
begin
  if new.person_id is not null and (v_pastor or not new.needs_confirmation) then
    new.status := 'aceito';
    new.responded_at := coalesce(new.responded_at, now());
  elsif tg_op = 'UPDATE' and old.needs_confirmation = false and new.needs_confirmation = true
        and new.person_id is not distinct from old.person_id then
    -- Voltou a precisar de confirmação: aguarda a resposta da pessoa.
    new.status := 'pendente';
    new.responded_at := null;
  end if;
  return new;
end $$;
drop trigger if exists items_pastor_auto on public.items;
create trigger items_pastor_auto before insert or update on public.items
for each row execute function public._items_pastor_auto();
revoke execute on function public._items_pastor_auto() from public, anon, authenticated;

-- 3) Salvar oportunidade (agora com "precisa de confirmação")
create or replace function public.save_item(p_token uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v_event uuid; v_old_person uuid; v_new_person uuid;
begin
  if v_id is null then
    v_event := (p->>'event_id')::uuid;
    if not public._can_edit(v_event, p_token) then raise exception 'sem permissão'; end if;
    insert into items(event_id, section, position, kind, title, duration_min, person_id, details, needs_confirmation)
    values (v_event, coalesce(p->>'section','programa'),
            coalesce((p->>'position')::int,
              (select coalesce(max(position),-1)+1 from items where event_id = v_event and section = coalesce(p->>'section','programa'))),
            p->>'kind', nullif(p->>'title',''), coalesce((p->>'duration_min')::int, 5),
            nullif(p->>'person_id','')::uuid, coalesce(p->'details','{}'::jsonb),
            coalesce((p->>'needs_confirmation')::boolean, true))
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
    needs_confirmation = coalesce((p->>'needs_confirmation')::boolean, needs_confirmation),
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

-- 4) "Eu (Pastor)": se já existir uma pessoa com o mesmo nome, usa ela em vez de duplicar
create or replace function public.save_person(p_token uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v_pastor boolean := coalesce((p->>'is_pastor')::boolean, false);
begin
  if not (public._is_admin() or public._is_director(p_token)) then raise exception 'sem permissão'; end if;
  if coalesce(trim(p->>'name'),'') = '' then raise exception 'nome obrigatório'; end if;
  if v_pastor and not public._is_admin() then v_pastor := false; end if;
  if v_pastor then
    select id into v_id from people where is_pastor limit 1;
    if v_id is null then
      select id into v_id from people where lower(trim(name)) = lower(trim(p->>'name')) order by created_at limit 1;
      if v_id is not null then update people set is_pastor = true where id = v_id; end if;
    end if;
  end if;
  if v_id is null then
    insert into people(name, phone, note, is_pastor)
    values (trim(p->>'name'), nullif(trim(p->>'phone'),''), nullif(trim(p->>'note'),''), v_pastor)
    returning id into v_id;
  else
    update people set name = trim(p->>'name'),
      phone = case when v_pastor then phone else nullif(trim(p->>'phone'),'') end,
      note = case when v_pastor then note else nullif(trim(p->>'note'),'') end
    where id = v_id;
  end if;
  update items set updated_at = now() where person_id = v_id; -- reaplica a confirmação automática
  return (select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'note', note, 'is_pastor', is_pastor) from people where id = v_id);
end $$;

-- 5) Corrige cadastros antigos: junta pessoas com o mesmo nome do pastor no cadastro do pastor
do $$
declare v_pastor uuid; v_name text;
begin
  select id, lower(trim(name)) into v_pastor, v_name from people where is_pastor limit 1;
  if v_pastor is null then return; end if;
  update items set person_id = v_pastor where person_id in
    (select id from people where not is_pastor and lower(trim(name)) = v_name);
  update events set director_id = v_pastor where director_id in
    (select id from people where not is_pastor and lower(trim(name)) = v_name);
  delete from people where not is_pastor and lower(trim(name)) = v_name;
end $$;

update public.items set updated_at = now()
where person_id in (select id from public.people where is_pastor) or not needs_confirmation;

-- Conferência: pessoas cadastradas (o pastor deve aparecer com e_pastor = true)
select name as nome, is_pastor as e_pastor,
       (select count(*) from public.items i where i.person_id = p.id) as oportunidades,
       (select count(*) from public.items i where i.person_id = p.id and i.status = 'pendente') as aguardando
from public.people p order by is_pastor desc, name;
