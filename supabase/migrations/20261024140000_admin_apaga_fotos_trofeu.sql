-- Modo Suporte: o admin também apaga as FOTOS das conquistas (o troféu em si continua sem poder ser apagado pelo admin).
-- Inclui o arquivo no armazenamento: sem a regra de storage, a foto enviada pelo dono sairia da conta mas o arquivo ficaria solto.
create policy "Admin apaga fotos de trofeus" on public.rede_trofeu_fotos
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::user_role));

create policy "Jornada midias - admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'jornada-midias' and public.has_role(auth.uid(), 'admin'::user_role));
