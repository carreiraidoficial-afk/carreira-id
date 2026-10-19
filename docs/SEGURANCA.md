# Segurança do Carreira ID

Documento vivo. Leia antes de mexer em banco, funções de servidor, armazenamento ou em qualquer tela que leia perfis.
O repositório é público: por isso este arquivo registra as **regras, a rotina de revisão e o que já foi corrigido**, e
não lista falhas ainda abertas. O acompanhamento das pendências fica no checklist privado do mantenedor.

## 1. Como o app se protege (camadas)

| Camada | Regra |
|---|---|
| **Linhas (RLS)** | Toda tabela do schema `public` tem RLS ligado. Tabela nova nasce com RLS e política explícita. |
| **Colunas** | `perfil_atleta` e `perfis_rede` não dão `SELECT` da tabela inteira a `anon`/`authenticated`: só de colunas listadas. CPF/CNPJ, tipo de documento, telefone e código de convite ficam de fora. |
| **Funções do banco** | Dado privado só sai por função `SECURITY DEFINER` que confere quem chama (dono, colaborador, admin). Função nova começa com `revoke all ... from public, anon`. |
| **Funções de servidor** | Nenhuma função publicada sem checar quem chama (login, admin, chave de serviço ou segredo interno). Webhooks validam assinatura/segredo. |
| **Armazenamento** | Buckets públicos só aceitam gravação na pasta do próprio usuário (ou admin). Documentos sensíveis ficam em bucket privado. |
| **Segredos** | Nada de chave secreta no repositório. Só a chave pública (anon) e a chave VAPID pública aparecem no código. |
| **Admin** | Verificado no servidor (`has_role`), nunca só na tela. |

Leitura de dado privado no app: `src/lib/contato-perfil.ts` (listas de colunas abertas e funções de leitura segura).

## 2. Regras ao escrever código

1. **Nunca** `select('*')` (nem `perfil_atleta(*)` embutido) em `perfil_atleta` ou `perfis_rede`. Use `COLUNAS_PERFIL_ATLETA` / `COLUNAS_PERFIL_REDE`.
2. **Coluna nova** nessas duas tabelas: ela só fica legível depois de `grant select (coluna) on ... to anon, authenticated` **e** de entrar nas listas de `contato-perfil.ts`. Se for dado pessoal, não conceda: crie função de leitura.
3. **Função `SECURITY DEFINER` nova**: `revoke all on function ... from public, anon;`, depois `grant execute` só a quem precisa, e valide `auth.uid()` dentro dela. Funções de gatilho não precisam de `grant`.
4. **Política com `true`** só para dado realmente público. Pergunte: "um visitante sem login pode ver isso?".
5. **Edge function nova**: defina como autentica (token do usuário, admin, `x-internal-secret` ou assinatura do provedor). `verify_jwt = false` só com checagem própria no código.
6. **Gravação com retorno** (`.insert().select()`): peça só colunas abertas.
7. **Upload**: caminho começa pela pasta do usuário (`<uid>/...`) ou área de admin. Limite tipo e tamanho quando criar bucket.
8. **Texto livre público** (bio, peneiras, comunicados): sem telefone, e-mail, link ou cobrança quando o risco for golpe.
9. **Dados de menores**: não expor nome completo, contato, escola, bairro ou data de nascimento fora do que o responsável tornou público.
10. **Nunca** imprimir CPF, telefone ou token em log, teste ou conversa.

## 3. Rotina de revisão

**A cada mudança no banco, em função de servidor ou em tela que lê perfis:**

```bash
node scripts/verificar-seguranca.mjs
```

Faz 48 verificações como visitante sem login (colunas fechadas, tabelas internas, funções negadas, funções antigas removidas).
Deve terminar com "N/N verificações passaram". Qualquer falha bloqueia o deploy até ser entendida.
Ao criar uma proteção nova, **acrescente o teste correspondente ao script**.

**Mensal:**
- `npm audit --omit=dev` e atualizar o que tiver correção.
- Rodar as consultas da seção 4 e comparar com o mês anterior.
- Conferir a lista de funções publicadas (`supabase functions list`): `verify_jwt=false` precisa ter checagem no código.
- Revisar quem tem papel de admin e quem recebe os avisos de admin (`carreira_admin_destinatarios`).
- Testar com login real: editar perfil, Modo Suporte, telas de admin, cadastro por convite.

**Trimestral ou antes de uma divulgação grande:** auditoria completa (esta lista inteira), incluindo configuração de login
(confirmação de e-mail, senha vazada, CAPTCHA, limites), buckets, backups e acessos do Supabase/Vercel/Asaas.

## 4. Consultas de auditoria (rodar no SQL do Supabase)

```sql
-- Tabelas do public sem RLS (esperado: nenhuma)
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- Políticas de leitura sem filtro (cada uma precisa de justificativa: dado público de verdade)
select tablename, policyname, roles from pg_policies
 where schemaname = 'public' and cmd in ('SELECT', 'ALL') and (qual is null or qual = 'true');

-- Funções SECURITY DEFINER que visitante consegue executar (revisar uma a uma)
select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and has_function_privilege('anon', p.oid, 'execute');

-- Colunas de perfis que visitante lê (CPF, telefone, documento e convite não podem aparecer)
select table_name, column_name from information_schema.column_privileges
 where table_schema = 'public' and table_name in ('perfil_atleta', 'perfis_rede') and grantee = 'anon' and privilege_type = 'SELECT';

-- Buckets e políticas de armazenamento
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';
```

## 5. O que já foi corrigido (histórico)

| Data | O que |
|---|---|
| 13–14/10/2026 | Função de push passou a autenticar; funções legadas sem login fechadas ou apagadas; `carreira_assinaturas` protegida contra auto-concessão de plano; contadores e status de conta protegidos por gatilho; peneiras com verificação do organizador, opt-in dos pais e regras no servidor. |
| 18/10/2026 | **Fase 1:** funções de pontos, selos e papel fechadas a visitante (`admin_adicionar_pontos` para o admin); `carreira-assets` restrito; registro de erros do navegador com limites; função de push antiga removida; avisos de admin passaram a ter lista de destinatários. |
| 18–19/10/2026 | **Fase 2:** CPF/CNPJ, tipo de documento e telefone fechados por coluna e lidos por funções; e-mail e data de nascimento removidos de `dados_perfil`; experiências de perfil privado e lista de seguidores restritas; código de convite lido, gerado e resolvido por funções; CPF do responsável com campo próprio e gravado no pagamento. |
| 19/10/2026 | **Cadastro de adolescente (12–17) com anuência:** dados do menor ficam em tabela fechada, sem perfil, até o responsável confirmar por link único de 7 dias (hash no banco); perfil nasce no nome do responsável; colaborador autorizado edita só campos leves (trava no banco). Material jurídico em `docs/ANUENCIA-ADOLESCENTES-REVISAO-JURIDICA.md`. |

Reversões prontas: `docs/rollback-seguranca-fase2-etapa3.sql` e `docs/rollback-seguranca-convites.sql`.

## 6. Em caso de incidente

1. Conter: revogar o acesso envolvido (token, função, política) antes de investigar.
2. Trocar chaves expostas: tokens do Supabase, Asaas, Resend, VAPID (conferir `docs` de push antes de trocar a VAPID).
3. Registrar o que foi exposto, desde quando e para quem; avaliar a obrigação de avisar titulares (LGPD).
4. Corrigir, acrescentar o teste em `scripts/verificar-seguranca.mjs` e registrar no histórico acima.
