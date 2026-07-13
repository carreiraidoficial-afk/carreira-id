
## Objetivo
Permitir que o admin **edite** e **exclua** perfis (atletas e rede profissional) e **assinaturas** direto das telas de admin, para limpar contas de teste.

## O que será adicionado

### 1) Página de Perfis Admin (`CarreiraAdminPerfisPage.tsx`)
Adicionar coluna "Ações" também na aba **Rede Profissional** (hoje só existe em Atletas) e, em ambas as abas, dois botões novos por linha:

- **Editar** (ícone `Pencil`) → abre um `Dialog` simples para alterar campos essenciais:
  - Atletas: `nome`, `slug`, `modalidade`, `cidade`, `estado`, `is_public`, `status_conta`
  - Rede: `nome`, `slug`, `tipo`, `status_conta`
  - Salva via `supabase.from('perfil_atleta' | 'perfis_rede').update(...)`
- **Excluir** (ícone `Trash2`, vermelho) → abre `AlertDialog` de confirmação ("Isso apagará o usuário e TODOS os dados relacionados. Ação irreversível.") e chama uma nova **edge function `admin-delete-user`**.

### 2) Nova edge function `admin-delete-user`
Baseada em `delete-account/index.ts`, mas:
- Aceita `{ user_id: string }` no body
- Valida via `Authorization` header que o chamador é admin (email `carreiraidoficial@gmail.com` OU tem `has_role(uid, 'admin')`)
- Executa exatamente o mesmo backup + cascata de deletes de `delete-account`, mas para o `user_id` alvo (não o do requisitante)
- Adicionar em `supabase/config.toml` com `verify_jwt = true`

### 3) Página de Assinaturas Admin (`CarreiraAdminAssinaturasPage.tsx`)
Adicionar coluna "Ações" ao final da tabela com dois botões:

- **Editar** (`Pencil`) → `Dialog` com campos: `status` (`ativa | trial | pendente | cancelada | expirada`), `plano`, `expira_em` (date), `valor`, `metodo_pagamento`, `observacoes`. Salva com `update` direto na tabela `carreira_assinaturas`.
- **Excluir** (`Trash2`) → `AlertDialog` de confirmação. Deleta a linha:
  ```ts
  supabase.from('carreira_assinaturas').delete().eq('id', ass.id)
  ```
  Nota: não cancela a assinatura no Asaas automaticamente (para cancelar de fato no gateway é necessário fluxo diferente). O aviso do modal deixará isso explícito: "Isso remove apenas do banco. Cancele também no Asaas se necessário."

## Segurança
- Todas as operações passam por RLS existente + verificação no edge function (`admin-delete-user`).
- Botões só aparecem em `CarreiraAdminLayout` (que já é protegido por admin).

## Deploy manual (Supabase)
Depois que os arquivos forem gerados:
1. Copiar o código de `supabase/functions/admin-delete-user/index.ts` para o Dashboard → Edge Functions → **New function** `admin-delete-user` (verify JWT = ON) → Deploy.
2. Nenhum SQL necessário.

## Arquivos a alterar/criar
- `src/pages/carreira/admin/CarreiraAdminPerfisPage.tsx` — botões Editar/Excluir + dialogs
- `src/pages/carreira/admin/CarreiraAdminAssinaturasPage.tsx` — botões Editar/Excluir + dialogs
- `supabase/functions/admin-delete-user/index.ts` — nova função
- `supabase/config.toml` — registrar a função
