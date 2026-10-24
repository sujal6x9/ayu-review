create type public.app_role as enum ('admin','uploader','reviewer');
create type public.paper_status as enum ('draft','uploaded','assigned','under_review','changes_requested','corrections_in_progress','resubmitted','approved','finalized');
create type public.mark_status as enum ('none','correct','incorrect','needs_improvement','corrected','approved');
create type public.comment_status as enum ('open','resolved');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by signed-in" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles readable by signed-in" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), coalesce(new.email,''));
  r := coalesce(new.raw_user_meta_data->>'role', 'uploader');
  if r not in ('uploader','reviewer') then r := 'uploader'; end if;
  insert into public.user_roles (user_id, role) values (new.id, r::public.app_role);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create sequence public.paper_code_seq start 1001;

create table public.papers (
  id uuid primary key default gen_random_uuid(),
  paper_code text not null unique default ('QP-' || nextval('public.paper_code_seq')::text),
  title text not null,
  subject text not null default '',
  exam_name text not null default '',
  test_number text not null default '',
  file_path text,
  file_name text,
  file_type text check (file_type in ('pdf','excel')),
  uploader_id uuid not null,
  reviewer_id uuid,
  status public.paper_status not null default 'uploaded',
  review_cycle int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.papers (uploader_id);
create index on public.papers (reviewer_id);
grant select, insert, update on public.papers to authenticated;
grant all on public.papers to service_role;
alter table public.papers enable row level security;

create or replace function public.can_access_paper(_paper_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.papers p where p.id = _paper_id
    and (p.uploader_id = auth.uid() or p.reviewer_id = auth.uid() or public.has_role(auth.uid(),'admin')))
$$;

create policy "papers select" on public.papers for select to authenticated
  using (uploader_id = auth.uid() or reviewer_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "papers insert" on public.papers for insert to authenticated
  with check (uploader_id = auth.uid() and (public.has_role(auth.uid(),'uploader') or public.has_role(auth.uid(),'admin')));
create policy "papers update" on public.papers for update to authenticated
  using (uploader_id = auth.uid() or reviewer_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (uploader_id = auth.uid() or reviewer_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
create trigger papers_touch before update on public.papers for each row execute function public.touch_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null,
  anchor jsonb not null default '{}'::jsonb,
  question_ref text not null default '',
  body text not null,
  suggested_correction text not null default '',
  mark public.mark_status not null default 'none',
  status public.comment_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.comments (paper_id);
grant select, insert, update on public.comments to authenticated;
grant all on public.comments to service_role;
alter table public.comments enable row level security;
create policy "comments select" on public.comments for select to authenticated using (public.can_access_paper(paper_id));
create policy "comments insert" on public.comments for insert to authenticated with check (author_id = auth.uid() and public.can_access_paper(paper_id));
create policy "comments update" on public.comments for update to authenticated using (public.can_access_paper(paper_id)) with check (public.can_access_paper(paper_id));
create trigger comments_touch before update on public.comments for each row execute function public.touch_updated_at();

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  details text not null default '',
  created_at timestamptz not null default now()
);
create index on public.activity (paper_id);
grant select, insert on public.activity to authenticated;
grant all on public.activity to service_role;
alter table public.activity enable row level security;
create policy "activity select" on public.activity for select to authenticated using (public.can_access_paper(paper_id));
create policy "activity insert" on public.activity for insert to authenticated with check (actor_id = auth.uid() and public.can_access_paper(paper_id));

alter table public.papers replica identity full;
alter table public.comments replica identity full;
alter publication supabase_realtime add table public.papers;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activity;