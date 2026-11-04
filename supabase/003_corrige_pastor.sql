-- 003 · Garante a confirmação automática do pastor e corrige o que já foi criado.
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
revoke execute on function public._items_pastor_auto() from public, anon, authenticated;

update public.items i set status = 'aceito', responded_at = coalesce(responded_at, now())
from public.people p where p.id = i.person_id and p.is_pastor and i.status <> 'aceito';

-- Conferência: mostra as pessoas cadastradas e se alguma está marcada como pastor.
select name as nome, is_pastor as e_pastor,
       (select count(*) from public.items i where i.person_id = p.id) as oportunidades
from public.people p order by is_pastor desc, name;
