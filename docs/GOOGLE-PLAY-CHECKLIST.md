# Checklist — Carreira ID na Google Play

Meta: chegar a 100% antes de criar a inscrição/enviar para revisão.
Legenda de responsável: **[Claude]** eu faço no código/banco · **[Você]** depende de você · **[Juntos]** decisão ou revisão.
Avaliação de origem: 12–13/10/2026 (sem teste em aparelho, sem Lighthouse). Regras da Play citadas devem ser reconfirmadas na Play Console.

Progresso: 2 / 39 (B2 e B4 feitos; B1, B3 e restante pendentes)

---

## A. Decisões (destravam o resto)
- [ ] A1 **[Juntos]** Pagamento: Play Billing no app Android, ou app Android só com plano grátis (sem tela de compra)? Conferir regra vigente para o Brasil (Pix, programa de cobrança alternativa).
- [ ] A2 **[Você]** Conta de desenvolvedor: pessoal ou organização (CNPJ/D-U-N-S)? Conta pessoal nova exige teste fechado (~12 testadores / 14 dias) — confirmar.
- [ ] A3 **[Juntos]** Público-alvo declarado: adultos/responsáveis (18+). Confirmar que nenhuma tela se dirige a menores de 13.
- [ ] A4 **[Você]** Nome do app na loja, categoria (Esportes ou Social) e e-mail de suporte público.

## B. Bloqueios de política (reprovação provável)
- [ ] B1 **[Claude]** Pagamento conforme decidido em A1 (Play Billing ou ocultar compra no Android).
- [x] B2 **[Claude]** Denunciar conteúdo (posts, comentários, perfis, fotos) — botão + motivo + registro.
- [ ] B3 **[Claude]** Bloquear usuário (some do feed, conexões e busca; reversível).
- [x] B4 **[Claude]** Tela no admin para tratar denúncias (ver, ocultar, banir, marcar como resolvida).
- [ ] B5 **[Claude]** Declaração de maioridade/responsável legal no cadastro (checkbox registrado junto do aceite dos termos).
- [ ] B6 **[Juntos]** Política de privacidade reescrita: controlador, CNPJ, encarregado (LGPD), dados coletados (inclui menores), base legal (art. 14), compartilhamento (Supabase, Asaas, Resend, Google Analytics, Meta Pixel, Vercel), retenção, direitos, exclusão, transferência internacional, cookies.
- [ ] B7 **[Juntos]** Termos de uso reescritos (UGC, conduta, moderação, menores, assinatura/cancelamento). Revisão por advogado.
- [ ] B8 **[Claude]** Página pública de exclusão de conta/dados (URL própria) com instruções e canal de pedido.
- [ ] B9 **[Claude]** Revisar Google Analytics e Meta Pixel: manter, limitar ou desligar no app Android; refletir na política e no formulário de dados.

## C. Técnico do app (PWA/TWA)
- [ ] C1 **[Claude]** Ícones reais: 192×192 e 512×512 exatos (hoje são 500×500) + maskable 512×512; atualizar manifest.
- [ ] C2 **[Claude]** Manifest estático no HTML (hoje é injetado por JavaScript) com ícone 192, capturas de tela e `id`/`start_url` coerentes.
- [ ] C3 **[Claude]** Corrigir `/.well-known/assetlinks.json` (hoje devolve HTML); servir como JSON com a impressão digital do app.
- [ ] C4 **[Você]** Gerar/guardar a chave de assinatura (Play App Signing) e passar o SHA-256 para o assetlinks.
- [ ] C5 **[Claude]** Gerar o projeto Android (Bubblewrap/PWABuilder): pacote `br.com.carreiraid...`, versão, ícone, cor, orientação.
- [ ] C6 **[Claude]** Tela offline decente (sem rede o app não mostra erro cru).
- [ ] C7 **[Claude]** Testar login por Google dentro do app Android (deve abrir pelo Chrome, não WebView).
- [ ] C8 **[Claude]** Testar notificações push no Android 13+ (permissão, toque abre a tela certa).
- [ ] C9 **[Claude]** Links externos (WhatsApp, e-mail, compartilhar) e botão voltar do Android.
- [ ] C10 **[Claude]** Lighthouse/PWABuilder: desempenho, acessibilidade, instalabilidade (meta: sem erros críticos).
- [ ] C11 **[Você]** Testar em pelo menos 2 aparelhos Android reais (um antigo).

## D. Conteúdo da ficha na loja
- [ ] D1 **[Juntos]** Descrição curta (80 caracteres) e completa (4000), em português; sem promessas proibidas.
- [ ] D2 **[Claude]** Gráfico de destaque 1024×500.
- [ ] D3 **[Você]** Mínimo 2 capturas de tela de celular (ideal 6–8) + opcional tablet.
- [ ] D4 **[Juntos]** Ícone de loja 512×512 (arquivo final).
- [ ] D5 **[Você]** Conta de teste para o revisor da Google (login e senha) + instruções de acesso.
- [ ] D6 **[Você]** E-mail de contato, site e endereço (se conta de organização).

## E. Formulários da Play Console
- [ ] E1 **[Juntos]** Segurança dos dados (Data safety): nome, e-mail, telefone, nascimento, fotos/vídeos, localização aproximada (cidade), pagamentos, identificadores (push, analytics), compartilhamento e criptografia.
- [ ] E2 **[Juntos]** Classificação de conteúdo (IARC): interação entre usuários, conteúdo gerado por usuários, compras.
- [ ] E3 **[Juntos]** Público-alvo e conteúdo (declarar 18+; sem foco em crianças).
- [ ] E4 **[Juntos]** Declarações: anúncios (não), acesso a conta/exclusão (URL de B8), notícias, saúde, finanças.
- [ ] E5 **[Você]** Verificação da conta de desenvolvedor concluída.

## F. Teste e lançamento
- [ ] F1 **[Você]** Teste interno (equipe) funcionando por alguns dias.
- [ ] F2 **[Você]** Teste fechado com os testadores exigidos (se conta pessoal), por 14 dias seguidos.
- [ ] F3 **[Juntos]** Revisão final deste checklist: todos os itens marcados.
- [ ] F4 **[Você]** Enviar para produção e acompanhar a revisão (costuma levar alguns dias).

---

## Observações
- Itens B1–B3 são os que mais reprovam; fazer primeiro.
- Atualizar o "Progresso" no topo a cada item concluído.
- Não colocar senhas, tokens ou chaves neste arquivo.
