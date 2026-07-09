## Ajustes no dialog "Compartilhar perfil"

Arquivo único a alterar: `src/components/carreira/CompartilharPerfilDialog.tsx`.
Nada de backend, nada em templates.

### 1) Remover o SMS

- Remover o ícone `Smartphone` do import de `lucide-react`.
- Remover o botão SMS do grid de ações.
- Remover a branch `else if (canal === 'sms')` da função `enviar` e o valor `'sms'` do tipo do parâmetro.
- Ajustar o grid: `grid-cols-1 sm:grid-cols-3` (3 ações: WhatsApp, Email, Copiar). No mobile fica uma coluna com botões largos (mais fácil de tocar); no desktop, três colunas lado a lado.

### 2) Corrigir a experiência no celular

Causa: o `DialogContent` está com `max-h-[90vh] overflow-y-auto` e sem barra de ações fixa. Em iOS Safari `90vh` inclui a barra de URL, e como o conteúdo (título + descrição + tabs + subtítulo + chips + textarea de 9 linhas + botões + dica) supera a altura visível, o usuário vê apenas o topo (título/tabs/chips) e não percebe que precisa rolar até a pré-visualização e as ações. Foi por isso que na tela do celular "não aparecem as mesmas opções".

Correções:

- Trocar `max-h-[90vh]` por `max-h-[100dvh]` e `h-[100dvh] sm:h-auto` para ocupar a tela cheia no celular e voltar ao tamanho normal a partir de `sm:`. Adicionar `p-0 sm:p-6` para dar mais respiro no mobile.
- Estruturar o `DialogContent` em três áreas:
  - **Header sticky** no topo (título + descrição + `TabsList`), `sticky top-0 bg-background z-10 border-b px-4 pt-4 pb-2`.
  - **Área rolável** com o subtítulo da aba, chips de template e a textarea, `flex-1 overflow-y-auto px-4 py-3`. Reduzir a textarea no mobile para `rows={6}` (fica `sm:rows-9` via classe) para caber melhor.
  - **Footer sticky** no rodapé com os 3 botões de ação e a dica, `sticky bottom-0 bg-background border-t px-4 py-3` — assim WhatsApp/Email/Copiar ficam sempre visíveis, mesmo enquanto o usuário rola a mensagem.
- Adicionar `flex flex-col` no `DialogContent` para o sticky funcionar corretamente com `flex-1`.

### 3) Verificação pós-implementação

- Rodar Playwright headless em dois viewports (`390×844` mobile e `1280×900` desktop), abrir `/feed` autenticado, ir a um perfil, clicar em "Compartilhar" e capturar screenshots comprovando que:
  - No mobile: tabs, chips, textarea e os 3 botões de ação são todos visíveis/alcançáveis, com o footer fixo.
  - No desktop: layout inalterado, sem SMS, 3 botões em linha.
- Rodar `tsgo` para garantir que a remoção do tipo `'sms'` não quebrou nada.