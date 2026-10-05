-- Permite marcar uma conta sem perfil (cadastro incompleto) como "não
-- mandar lembrete" sem precisar apagar a conta -- útil pra contas de
-- teste/automação que aparecem na fila junto com leads reais.
ALTER TABLE public.profiles
  ADD COLUMN excluir_lembretes BOOLEAN NOT NULL DEFAULT false;
