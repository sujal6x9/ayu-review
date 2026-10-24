create extension if not exists pgcrypto;

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  specialization text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctors enable row level security;
grant select, insert, update, delete on public.doctors to authenticated;
grant all on public.doctors to service_role;

create policy "doctors readable by owner or admin" on public.doctors for select to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "doctors created by paper creators" on public.doctors for insert to authenticated
  with check (created_by = auth.uid() and (public.has_role(auth.uid(), 'uploader') or public.has_role(auth.uid(), 'admin')));
create policy "doctors updated by owner or admin" on public.doctors for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "doctors deleted by owner or admin" on public.doctors for delete to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create trigger doctors_touch before update on public.doctors for each row execute function public.touch_updated_at();

alter table public.papers add column doctor_id uuid references public.doctors(id) on delete set null;
create index on public.papers (doctor_id);

create table public.paper_shares (
  paper_id uuid primary key references public.papers(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  password_hash text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.paper_shares enable row level security;
grant all on public.paper_shares to service_role;
create trigger paper_shares_touch before update on public.paper_shares for each row execute function public.touch_updated_at();

create table public.paper_guest_access (
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (paper_id, user_id)
);
alter table public.paper_guest_access enable row level security;
grant all on public.paper_guest_access to service_role;

create or replace function public.can_access_paper(_paper_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.papers p
    where p.id = _paper_id and (
      p.uploader_id = auth.uid()
      or p.reviewer_id = auth.uid()
      or public.has_role(auth.uid(), 'admin')
      or exists (
        select 1 from public.paper_guest_access g
        where g.paper_id = p.id and g.user_id = auth.uid()
      )
    )
  )
$$;

drop policy if exists "papers select" on public.papers;
create policy "papers select" on public.papers for select to authenticated
  using (public.can_access_paper(id));

create or replace function public.configure_paper_share(_paper_id uuid, _doctor_id uuid, _password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  share_token uuid;
begin
  if length(_password) < 6 then
    raise exception 'The review password must be at least 6 characters.';
  end if;
  if not exists (
    select 1 from public.papers p
    where p.id = _paper_id
      and (p.uploader_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  ) then
    raise exception 'You cannot share this paper.';
  end if;
  if not exists (
    select 1 from public.doctors d
    where d.id = _doctor_id
      and (d.created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  ) then
    raise exception 'Choose a valid Dr.';
  end if;

  update public.papers
  set doctor_id = _doctor_id,
      reviewer_id = null,
      status = case when status in ('draft', 'uploaded') then 'assigned'::public.paper_status else status end
  where id = _paper_id;

  delete from public.paper_guest_access where paper_id = _paper_id;
  insert into public.paper_shares (paper_id, token, password_hash, created_by)
  values (_paper_id, gen_random_uuid(), crypt(_password, gen_salt('bf')), auth.uid())
  on conflict (paper_id) do update
    set token = excluded.token,
        password_hash = excluded.password_hash,
        created_by = excluded.created_by;

  select token into share_token from public.paper_shares where paper_id = _paper_id;
  return share_token;
end;
$$;

create or replace function public.unlock_paper_share(_token uuid, _password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  target_paper uuid;
  target_doctor uuid;
  doctor_name text;
begin
  if auth.uid() is null or not coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'Start a guest session before opening this paper.';
  end if;

  select s.paper_id, p.doctor_id, d.name
  into target_paper, target_doctor, doctor_name
  from public.paper_shares s
  join public.papers p on p.id = s.paper_id
  join public.doctors d on d.id = p.doctor_id
  where s.token = _token and s.password_hash = crypt(_password, s.password_hash);

  if target_paper is null or target_doctor is null then
    raise exception 'The review link or password is incorrect.';
  end if;

  insert into public.paper_guest_access (paper_id, user_id)
  values (target_paper, auth.uid())
  on conflict do nothing;

  update public.profiles set full_name = doctor_name where id = auth.uid();
  return target_paper;
end;
$$;

create or replace function public.update_paper_review_status(_paper_id uuid, _status public.paper_status, _review_cycle integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  current_status public.paper_status;
  is_owner boolean;
begin
  if not public.can_access_paper(_paper_id) then
    raise exception 'You cannot update this paper.';
  end if;
  select p.status, (p.uploader_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  into current_status, is_owner
  from public.papers p where p.id = _paper_id;
  if not is_owner and not (
    (current_status in ('uploaded', 'assigned', 'resubmitted') and _status = 'under_review')
    or (current_status = 'under_review' and _status in ('changes_requested', 'approved'))
  ) then
    raise exception 'That review status change is not allowed.';
  end if;
  update public.papers
  set status = _status, review_cycle = _review_cycle
  where id = _paper_id;
end;
$$;

revoke all on function public.configure_paper_share(uuid, uuid, text) from public;
revoke all on function public.unlock_paper_share(uuid, text) from public;
revoke all on function public.update_paper_review_status(uuid, public.paper_status, integer) from public;
grant execute on function public.configure_paper_share(uuid, uuid, text) to authenticated;
grant execute on function public.unlock_paper_share(uuid, text) to authenticated;
grant execute on function public.update_paper_review_status(uuid, public.paper_status, integer) to authenticated;
