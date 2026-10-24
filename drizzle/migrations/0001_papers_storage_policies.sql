create policy "paper files read" on storage.objects for select to authenticated
  using (bucket_id = 'papers' and public.can_access_paper(((storage.foldername(name))[1])::uuid));
create policy "paper files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'papers' and exists (select 1 from public.papers p where p.id::text = (storage.foldername(name))[1] and p.uploader_id = auth.uid()));