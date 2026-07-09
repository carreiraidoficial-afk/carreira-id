## Diagnóstico

Encontrei três problemas distintos, todos em componentes de compartilhamento:

### 1) No celular abre um compartilhamento diferente (sem as opções)

O botão "Compartilhar" que aparece no card do perfil no celular **não é o mesmo** do desktop.

- **Desktop** (`CarreiraPerfilPage.tsx` linha 942) usa `ShareButton` → abre o `CompartilharPerfilDialog` com abas Torcedores/Atletas/Rede, chips de template e botões WhatsApp/Email/Copiar.
- **Mobile** (`CarreiraPerfilPage.tsx` linha 1017-1022, `lg:hidden`) renderiza o `PerfilHeader`, que tem seu **próprio** botão Compartilhar chamando `handleShare` (linhas 131-139 de `PerfilHeader.tsx`). Esse handler chama `navigator.share(...)` — abre o sheet nativo do Android/iOS com só o link, sem templates nem escolha de público.

É por isso que no celular "não aparecem as mesmas opções".

### 2) No desktop o texto do preview aparece cortado

Na reestruturação anterior o `DialogContent` ficou com `max-h-[90vh]` + header sticky + footer sticky + `flex-1 overflow-y-auto` na área do meio, e a textarea foi reduzida para `rows={6}`. Como o footer sticky reserva bastante altura, sobra pouco espaço para a textarea no desktop e ela mostra só ~3 linhas com scroll interno — a mensagem que antes aparecia inteira agora fica cortada.

### 3) WhatsApp abre `api.whatsapp.com` e dá "bloqueado" (imagem 3)

O `enviar('whatsapp')` usa `https://wa.me/?text=...`. Quando não há número, o `wa.me` redireciona para `api.whatsapp.com/send/?text=...` no desktop, e esse domínio é bloqueado por muitos antivírus/extensões/proxies corporativos (é o `ERR_BLOCKED_BY_RESPONSE` da terceira imagem). No celular esse mesmo link abre o app nativo sem passar pelo redirect e funciona.

## Plano de correção

Um único arquivo além do dialog. Sem mexer em templates nem backend.

### A) Unificar o botão Compartilhar no mobile (`src/components/carreira/PerfilHeader.tsx`)

- Remover a função `handleShare` (que usa `navigator.share`) e o import de `Share2` se ficar sem uso.
- Adicionar estado `const [shareOpen, setShareOpen] = useState(false)` e trocar o botão da linha 303-306 para abrir o mesmo `CompartilharPerfilDialog` usado no desktop.
- Passar `ownerUserId={perfil.user_id}`, `atletaNome={perfil.nome}`, `atletaSlug={perfil.slug}`, `accentColor={perfil.cor_destaque}` para o dialog.
- Assim o botão Compartilhar do card grande no celular passa a abrir exatamente o mesmo modal do desktop, com Torcedores/Atletas/Rede, chips e ações.

### B) Ajustar o layout do dialog para não cortar texto no desktop (`src/components/carreira/CompartilharPerfilDialog.tsx`)

Manter o modo "tela cheia + header/footer sticky" apenas no mobile e voltar ao layout natural no desktop:

- `DialogContent`: manter `h-[100dvh] sm:h-auto sm:max-h-[90vh]` mas trocar `flex flex-col gap-0` por classes responsivas: no `sm:` remover o `flex-1 overflow-y-auto` do meio e deixar o próprio `DialogContent` rolar (o comportamento original). Ou seja, sticky só com `sm:static` no header/footer a partir de `sm:`.
- Aumentar a textarea no desktop: `rows={6}` no mobile e `sm:min-h-[220px]` (ou classe `sm:[&]:h-56`) para caber a mensagem inteira sem scroll interno. Manter `resize-y`.
- Reduzir a "dica" no desktop para uma linha só (`sm:line-clamp-1`) ou mantê-la — mas garantir que o footer não consuma mais que ~120px no desktop.
- Verificar visualmente com Playwright em `1280×900` que a mensagem inteira do template "Direto" aparece sem scroll na textarea, e em `390×844` que header/chips/preview/ações continuam alcançáveis com footer sticky.

### C) Corrigir o link do WhatsApp para não cair em `api.whatsapp.com` (mesmo arquivo)

Na função `enviar`, ramificar por dispositivo:

```ts
if (canal === 'whatsapp') {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const url = isMobile
    ? `https://wa.me/?text=${encodeURIComponent(texto)}`               // abre app nativo
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(texto)}`; // abre WhatsApp Web
  window.open(url, '_blank', 'noopener,noreferrer');
}
```

`web.whatsapp.com/send?text=` abre direto o WhatsApp Web no desktop sem passar por `api.whatsapp.com`, evitando o bloqueio da imagem 3. No celular o `wa.me` continua abrindo o app.

### D) Verificação

- `tsgo` para garantir que a remoção do `handleShare`/`Share2` não deixou referências penduradas.
- Playwright em `390×844` e `1280×900`:
  - Mobile: tocar em "Compartilhar" no card grande → confirmar que abre o dialog com abas (não o sheet nativo).
  - Desktop: abrir o dialog → confirmar que a textarea mostra a mensagem inteira sem scroll interno; clicar em WhatsApp → confirmar que a nova aba aponta para `web.whatsapp.com/send?text=...` (não `wa.me`/`api.whatsapp.com`).