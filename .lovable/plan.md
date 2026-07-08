## 1) Google (login e cadastro) na tela `/auth`

Hoje o botão "Entrar com Google" existe só em `/carreira/cadastro`. Vou replicar o mesmo fluxo em `src/pages/Auth.tsx`, funcionando tanto para quem já tem conta quanto para novos usuários (o Supabase trata os dois casos no mesmo `signInWithOAuth` — se o e-mail Google ainda não existe, cria a conta; se já existe, faz login).

Mudanças:
- Adicionar botão "Continuar com Google" acima ou abaixo do formulário e-mail/senha, com um separador ("ou").
- Handler `handleGoogleLogin` idêntico ao de `CarreiraCadastroPage.tsx` (usa `data.url` no preview Lovable, `redirectTo` em produção).
- Após retorno do OAuth, o `AuthContext` já detecta a sessão via `onAuthStateChange` e o `useEffect` de redirecionamento existente encaminha para `/carreira/admin`, `/dashboard` ou `/minha` conforme o perfil.
- Sem mudanças de backend, sem mudanças no `AuthContext`, sem novas dependências.

Observação: a criação automática de `profile` para usuário Google já funciona no cadastro; o mesmo trigger cobre login/cadastro por `/auth`.

## 2) Login por biometria — avaliação e estratégia

**Dificuldade:** média. Não existe "login por digital" nativo de Supabase. O padrão web para isso é **WebAuthn / Passkeys** (o próprio SO usa Face ID, Touch ID, Windows Hello, digital do Android). Funciona em PWA instalado e no navegador moderno; não exige app nativo.

**Limitações reais:**
- Só funciona **após um primeiro login "normal"** (e-mail/senha ou Google) — a biometria é um segundo fator/atalho vinculado àquele dispositivo.
- É **por dispositivo**: o usuário precisa registrar a passkey em cada aparelho (celular, notebook). Passkeys sincronizadas por iCloud/Google Password Manager reduzem esse atrito, mas não eliminam.
- Requer HTTPS e domínio estável (funciona no domínio publicado; no preview Lovable a origem muda e complica testes).
- iOS Safari e Android Chrome atuais suportam bem; navegadores muito antigos, não.

**Estratégia recomendada (2 fases, sem quebrar nada hoje):**

Fase A — Passkeys nativas do navegador (recomendado):
1. Após login bem-sucedido, mostrar em `Configurações` (ou banner no `/minha`) a opção **"Ativar entrada por biometria neste dispositivo"**.
2. No clique, chamar `navigator.credentials.create(...)` (WebAuthn) e salvar o credential ID + chave pública em uma nova tabela `user_passkeys` no Supabase (via edge function que gera o challenge).
3. Na tela `/auth`, adicionar botão **"Entrar com biometria"** que chama `navigator.credentials.get(...)`, envia a asserção para uma edge function `verify-passkey`, que valida e devolve uma sessão Supabase (via `admin.generateLink` ou custom JWT).
4. Manter e-mail/senha e Google como alternativas sempre visíveis (fallback obrigatório se o usuário trocar de aparelho).

Fase B (opcional) — se depois virar app nativo via Capacitor: usar `@capacitor-community/biometric-auth` para desbloquear localmente um refresh token guardado no Keychain/Keystore. Mais simples, mas exige empacotar como app.

**Esforço estimado da Fase A:** 1 tabela + 2 edge functions (registro e verificação) + UI de ativação + botão em `/auth`. Uso a lib `@simplewebauthn/browser` + `@simplewebauthn/server` para não reimplementar o protocolo. Requer Lovable Cloud habilitado (hoje está desativado nas permissões) para criar tabela/edge functions.

**Recomendação prática:** entregar agora só a parte 1 (Google no `/auth`). A biometria fica como próximo passo, quando você autorizar Lovable Cloud e confirmar que quer o esforço da Fase A — ou se preferir esperar para quando virar app nativo (Fase B, mais simples).

## Escopo desta implementação (só o que executo agora)

- Editar `src/pages/Auth.tsx`: adicionar botão Google + handler, separador visual, mantendo login/cadastro por e-mail e o toggle atual.
- Nada de backend, nada de biometria neste passo.
