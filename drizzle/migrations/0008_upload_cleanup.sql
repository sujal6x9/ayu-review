create or replace function public.delete_unattached_paper(_paper_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.papers
  where id = _paper_id
    and file_path is null
    and (
      uploader_id = auth.uid()
      or public.has_role(auth.uid(), 'admin')
    );
end;
$$;

revoke all on function public.delete_unattached_paper(uuid) from public;
grant execute on function public.delete_unattached_paper(uuid) to authenticated;

drop policy if exists "paper files delete by uploader" on storage.objects;
create policy "paper files delete by uploader" on storage.objects for delete to authenticated
  using (
    bucket_id = 'papers'
    and exists (
      select 1
      from public.papers p
      where p.id::text = (storage.foldername(name))[1]
        and (p.uploader_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );
