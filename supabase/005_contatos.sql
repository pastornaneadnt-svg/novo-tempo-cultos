-- =====================================================================
-- 005 · Tela de contatos (listar todos e excluir)
-- Cole TODO o arquivo no Supabase: SQL Editor → New query → Run.
-- =====================================================================

create or replace function public.list_people(q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'sem permissão'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', p.name, 'phone', p.phone, 'note', p.note, 'is_pastor', p.is_pastor,
             'uses', (select count(*) from items i where i.person_id = p.id)
           ) order by p.is_pastor desc, lower(p.name))
    from people p
    where q is null or q = '' or p.name ilike '%' || q || '%' or p.note ilike '%' || q || '%' or p.phone ilike '%' || q || '%'
  ), '[]'::jsonb);
end $$;

create or replace function public.delete_person(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then raise exception 'sem permissão'; end if;
  if exists (select 1 from people where id = p_id and is_pastor) then raise exception 'O cadastro do pastor não pode ser excluído'; end if;
  delete from people where id = p_id;
end $$;

revoke execute on function public.list_people(text), public.delete_person(uuid) from public, anon, authenticated;
grant execute on function public.list_people(text), public.delete_person(uuid) to anon, authenticated;
