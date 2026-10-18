-- Origem da conexão com a escola: quem criou a conta pelo link de convite da escola ('convite') ou pediu para se conectar ('pedido').
-- Serve para o dono da escola saber como cada atleta chegou em "Nossos atletas".
alter table public.rede_conexoes add column if not exists origem text not null default 'pedido';
alter table public.rede_conexoes drop constraint if exists rede_conexoes_origem_check;
alter table public.rede_conexoes add constraint rede_conexoes_origem_check check (origem in ('convite', 'pedido'));

-- Conexões que já nasceram de um convite (mesma conta convidada e mesmo convidante)
update public.rede_conexoes c
set origem = 'convite'
where c.origem = 'pedido'
  and exists (
    select 1
    from public.rede_convites v
    join public.perfis_rede p on p.id = v.convidante_perfil_id
    where v.convidado_user_id = c.solicitante_id
      and p.user_id = c.destinatario_id
  );
