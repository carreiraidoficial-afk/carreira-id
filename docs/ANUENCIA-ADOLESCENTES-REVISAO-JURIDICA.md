# Cadastro de adolescentes com anuência do responsável — material para revisão jurídica

Documento preparado para um advogado de LGPD/ECA Digital revisar. **Não é parecer jurídico.** Reúne o que o app faz, o texto
mostrado ao responsável e as dúvidas que não conseguimos fechar sozinhos.

## 1. O que o app faz (resumo técnico)

1. Atleta de 12 a 17 anos cria login, informa nome, nascimento, modalidade, categoria, cidade/UF e os dados do responsável (nome, WhatsApp, e-mail opcional).
2. Esses dados ficam numa tabela fechada (`pre_cadastro_adolescente`), sem perfil público, sem busca e sem publicação, por no máximo 7 dias.
3. O próprio adolescente envia ao responsável, pelo WhatsApp dele, um link único com prazo de 7 dias.
4. O responsável abre o link, entra/cria conta, informa o CPF, marca a caixa de autorização e confirma.
5. Na confirmação o perfil é criado **no nome do responsável** (ele é o titular da conta, do plano e dos dados) e o adolescente passa a ter acesso próprio
   limitado (foto, capa, bio, Instagram, posições, jornada). Nome, privacidade, plano e convites ficam só com o responsável.
6. Prova guardada: data/hora, versão do termo, IP e navegador do responsável, CPF do responsável. Contato do responsável é apagado após aprovação ou recusa.
7. Sem confirmação em 7 dias o pedido expira; expirados/recusados são apagados após mais 14 dias.
8. Menores de 12 anos não podem se cadastrar sozinhos (a tela orienta o responsável a criar o perfil).
9. O app não faz publicidade nem perfilamento de menores.

## 2. Texto mostrado ao responsável (versão `anuencia-2026-10-v2`)

> **{Nome} quer criar um perfil de atleta.** Como {Nome} é menor de idade, o cadastro só vale com a sua autorização como responsável legal.
>
> **O que é o Carreira ID?** Uma plataforma brasileira onde atletas de base registram a trajetória esportiva (jogos, campeonatos, conquistas) e ganham visibilidade com segurança.
>
> **Se você autorizar:**
> - O perfil de {Nome} é criado no seu nome: você é o responsável e administra a conta.
> - {Nome} ganha um acesso próprio para atualizar foto, capa, bio, posições e registrar a jornada. Nome, privacidade e plano ficam só com você.
> - Você ganha 7 dias de teste grátis do plano Elite. Depois, só continua se você quiser (R$ 12/mês).
> - O perfil nasce público (sem telefone, e-mail ou data de nascimento) e você pode mudar isso nas Configurações. Pode revogar o acesso de {Nome} ou excluir tudo a qualquer momento.
>
> Usamos seu CPF apenas para identificar você como responsável. Ele não aparece no perfil.
>
> ☐ Declaro que sou pai, mãe ou responsável legal de {Nome}, li os Termos de Uso e a Política de Privacidade e autorizo o tratamento dos dados pessoais de {Nome} para criar e manter o perfil esportivo. Confirmo que as informações de {Nome}, inclusive a data de nascimento, são verdadeiras e estou ciente de que dados falsos podem prejudicar o atleta, inclusive em campeonatos organizados por idade.

### 2.1 Declaração de maioridade (atleta com 18+ se cadastrando; versão `maioridade-2026-10-v2`)

> ☐ Declaro que tenho 18 anos ou mais e que as informações que informei são verdadeiras. Estou ciente de que dados falsos, como a data de nascimento, podem prejudicar o meu perfil e a minha participação em campeonatos organizados por idade. Quem tem menos de 18 anos precisa do cadastro com a autorização do responsável.

Fica registrado no perfil: data/hora e versão do texto. Aviso curto ao lado do campo de data de nascimento (todos os formulários): "Informe a data real. Dados falsos podem prejudicar o atleta, inclusive em campeonatos organizados por idade."

## 3. Mensagem enviada pelo adolescente ao responsável (WhatsApp)

> Oi, {Responsável}! Sou eu. Quero montar meu perfil de atleta no *Carreira ID*, uma plataforma brasileira onde atletas de base registram a trajetória esportiva (jogos, campeonatos e conquistas).
> Como sou menor de idade, preciso da sua autorização. Leva 2 minutos e o perfil só é ativado depois que você confirmar: {link}
> Pode conferir antes em carreiraid.com.br

## 4. Pontos para o advogado decidir

1. **Faixa 12–17 e LGPD art. 14:** o consentimento do responsável é exigido para 12–17 ou só para crianças (até 12)? Adotamos a anuência para todos os menores de 18 como cautela. Está adequado, ou excessivo?
2. **ECA Digital (Lei 15.211/2025) e Decreto 12.880/2026:** a vinculação ao responsável e a "aferição de idade" por autodeclaração (data de nascimento) bastam para este tipo de serviço, ou o regulamento da ANPD exige método adicional?
3. **Prova da anuência:** CPF + caixa marcada + IP/navegador/versão do termo é suficiente? Há necessidade de verificação adicional de que o signatário é de fato o responsável (hoje não há; um adolescente poderia usar outra conta)?
4. **Perfil público por padrão** para menores, com bio/foto/posição/cidade e sem contato, nascimento ou escola: compatível com o "melhor interesse"? Preferem privado por padrão?
5. **Política de privacidade:** precisa de seção específica sobre dados de crianças e adolescentes (finalidade, base legal, retenção, direitos do titular exercidos pelo responsável, encarregado/DPO).
6. **Termos de Uso:** idade mínima, responsabilidade do responsável, hipóteses de suspensão de conta de menor.
7. **Retenção:** pedido pendente guardado 7 dias (+14 se expirado/recusado). Prazos adequados?
8. **Declaração de maioridade e aviso de dados falsos:** o texto das seções 2 e 2.1 é adequado e proporcional? Há risco de afirmar efeitos (ex.: campeonatos por idade) que o app não controla?
9. **WhatsApp:** o adolescente fornece o número do responsável. Há risco de tratamento sem base legal sobre dado de terceiro? (Coletamos só nome e telefone; o envio é feito pelo próprio adolescente.)

## 5. Fontes consultadas (orientação pública, sem validação jurídica)

- Lei 15.211/2025 (ECA Digital), em vigor desde março de 2026: contas de menores de 16 anos vinculadas a responsável; proibição de autodeclaração onde há restrição etária; vedação de perfilamento para publicidade.
- LGPD art. 14 e Enunciado CD/ANPD nº 1/2023: dados de crianças e adolescentes podem usar outras bases legais, observado o melhor interesse; consentimento específico e em destaque de um dos pais quando aplicável.
