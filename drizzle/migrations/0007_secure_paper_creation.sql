create or replace function public.create_paper(
  _title text,
  _exam_name text default '',
  _subject text default '',
  _test_number text default '',
  _file_name text default null,
  _file_type text default null
)
returns public.papers
language plpgsql
security definer
set search_path = public
as $$
declare
  created_paper public.papers;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'uploader')
    or public.has_role(auth.uid(), 'admin')
  ) then
    raise exception 'Only paper creators and administrators can upload papers.';
  end if;

  if length(trim(coalesce(_title, ''))) = 0 then
    raise exception 'Paper title is required.';
  end if;

  if _file_type is not null and _file_type not in ('pdf', 'excel') then
    raise exception 'Only PDF and Excel papers are supported.';
  end if;

  insert into public.papers (
    title,
    exam_name,
    subject,
    test_number,
    uploader_id,
    file_type,
    file_name,
    status
  ) values (
    trim(_title),
    coalesce(_exam_name, ''),
    coalesce(_subject, ''),
    coalesce(_test_number, ''),
    auth.uid(),
    _file_type,
    _file_name,
    'uploaded'
  )
  returning * into created_paper;

  return created_paper;
end;
$$;

revoke all on function public.create_paper(text, text, text, text, text, text) from public;
grant execute on function public.create_paper(text, text, text, text, text, text) to authenticated;
