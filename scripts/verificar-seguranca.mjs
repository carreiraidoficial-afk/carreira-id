#!/usr/bin/env node
/**
 * Verificação de segurança do Carreira ID, feita como um VISITANTE sem login (só com a chave pública do site).
 * Rode depois de qualquer mudança no banco, nas funções ou nas telas que leem perfis:
 *
 *     node scripts/verificar-seguranca.mjs
 *
 * Sai com código 1 se algum teste falhar. Não grava nada: só faz leituras e chamadas que devem ser recusadas.
 * Veja o checklist completo em docs/SEGURANCA.md.
 */
import { readFileSync } from 'node:fs';

const cliente = readFileSync(new URL('../src/integrations/supabase/client.ts', import.meta.url), 'utf-8');
const URL_BASE = cliente.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)?.[1];
const CHAVE = cliente.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*"([^"]+)"/)?.[1];
if (!URL_BASE || !CHAVE) { console.error('Não achei a URL/chave pública em src/integrations/supabase/client.ts'); process.exit(2); }

const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' };
const get = (caminho) => fetch(`${URL_BASE}/rest/v1/${caminho}`, { headers: H });
const rpc = (nome, corpo = {}) => fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, { method: 'POST', headers: H, body: JSON.stringify(corpo) });
const ZERO = '00000000-0000-0000-0000-000000000000';

const resultados = [];
async function teste(grupo, nome, fn) {
  try {
    const ok = await fn();
    resultados.push({ grupo, nome, ok: ok === true, detalhe: ok === true ? '' : String(ok) });
  } catch (e) {
    resultados.push({ grupo, nome, ok: false, detalhe: `erro: ${e.message}` });
  }
}
const negado = async (resp) => (resp.status >= 400 ? true : `esperava negar, veio HTTP ${resp.status}`);
const semLinhas = async (resp) => {
  if (resp.status >= 400) return true;
  const d = await resp.json();
  return Array.isArray(d) && d.length === 0 ? true : `veio ${Array.isArray(d) ? d.length + ' linhas' : 'resposta inesperada'}`;
};

// 1) Colunas sensíveis dos perfis: ninguém lê direto (CPF, telefone, documento, código de convite)
for (const tabela of ['perfil_atleta', 'perfis_rede']) {
  for (const coluna of ['cpf_cnpj', 'telefone_whatsapp', 'tipo_documento', 'convite_codigo', '*']) {
    await teste('Colunas sensíveis', `${tabela}.${coluna === '*' ? 'select=*' : coluna} negado`, async () => negado(await get(`${tabela}?select=${encodeURIComponent(coluna)}&limit=1`)));
  }
}

// 2) O que precisa continuar público funciona
await teste('Leitura pública', 'perfil_atleta (colunas abertas)', async () => {
  const r = await get('perfil_atleta?select=nome,slug&is_public=eq.true&limit=5');
  return r.status === 200 ? true : `HTTP ${r.status}`;
});
await teste('Leitura pública', 'perfis_rede (colunas abertas)', async () => {
  const r = await get('perfis_rede?select=nome,slug,tipo,whatsapp_publico&limit=5');
  return r.status === 200 ? true : `HTTP ${r.status}`;
});
await teste('Leitura pública', 'feed com perfil embutido', async () => {
  const r = await get('posts_atleta?select=id,perfil:perfil_atleta(nome,slug),perfil_rede:perfis_rede(nome)&limit=3');
  return r.status === 200 ? true : `HTTP ${r.status}`;
});

// 3) Dados pessoais soltos dentro de dados_perfil
await teste('Dados pessoais', 'dados_perfil sem e-mail, CPF, telefone ou data de nascimento', async () => {
  const r = await get('perfis_rede?select=dados_perfil&limit=500');
  const d = await r.json();
  const proibidas = ['email', 'cpf', 'cpf_cnpj', 'telefone', 'telefone_whatsapp', 'data_nascimento'];
  const achados = d.filter((x) => x.dados_perfil && proibidas.some((k) => k in x.dados_perfil)).length;
  return achados === 0 ? true : `${achados} perfis com dado pessoal em dados_perfil`;
});

// 4) Tabelas internas não devolvem linhas a visitante
for (const tabela of ['profiles', 'criancas', 'carreira_assinaturas', 'carreira_assinaturas_familia', 'carreira_push_subscriptions', 'segredos_internos', 'user_roles', 'carreira_emails_enviados', 'carreira_cupons', 'perfil_atleta_colaboradores', 'peneiras', 'peneira_convites', 'carreira_admin_destinatarios']) {
  await teste('Tabelas internas', `${tabela} sem linhas`, async () => semLinhas(await get(`${tabela}?select=*&limit=1`)));
}

// 5) Quem segue quem e experiências
await teste('Privacidade', 'seguidores (atleta_follows) sem linhas para visitante', async () => semLinhas(await get('atleta_follows?select=id&limit=1')));
await teste('Privacidade', 'experiências de visitante só de atletas com perfil público', async () => {
  const exp = await (await get('carreira_experiencias?select=crianca_id&limit=1000')).json();
  if (!Array.isArray(exp)) return 'resposta inesperada';
  const criancas = [...new Set(exp.map((e) => e.crianca_id).filter(Boolean))];
  if (criancas.length === 0) return true;
  const pub = await (await get(`perfil_atleta?select=crianca_id&is_public=eq.true&crianca_id=in.(${criancas.join(',')})`)).json();
  const publicas = new Set(pub.map((p) => p.crianca_id));
  const fora = criancas.filter((c) => !publicas.has(c)).length;
  return fora === 0 ? true : `${fora} atletas de perfil privado com experiência visível`;
});

// 6) Funções do banco: visitante não consegue chamar
const funcoes = [
  ['adicionar_pontos', { p_user_id: ZERO, p_acao_tipo: 't', p_pontos: 0, p_descricao: 't' }],
  ['dar_badge', { p_user_id: ZERO, p_badge_tipo: 't', p_badge_nome: 't', p_badge_descricao: 't' }],
  ['verificar_badges_convites', { p_user_id: ZERO }],
  ['get_user_role', { _user_id: ZERO }],
  ['expirar_trials_carreira', {}],
  ['carreira_cupom_validar', { p_codigo: 'X' }],
  ['check_carreira_atividade_limit', { p_user_id: ZERO, p_crianca_id: ZERO }],
  ['perfil_atleta_privado', { p_perfil_id: ZERO }],
  ['perfil_rede_privado', { p_perfil_id: ZERO }],
  ['admin_contatos_perfis', { p_atleta_ids: [ZERO], p_rede_ids: null, p_crianca_ids: null }],
  ['admin_adicionar_pontos', { p_user_id: ZERO, p_acao_tipo: 't', p_pontos: 0, p_descricao: 't' }],
  ['resolver_convite', { p_codigo: 'XXXXXX' }],
  ['codigo_convite_da_conta', { p_user_id: null }],
  ['codigo_convite_do_perfil', { p_tipo: 'rede', p_perfil_id: ZERO }],
];
for (const [nome, corpo] of funcoes) {
  await teste('Funções do banco', `${nome} negada a visitante`, async () => negado(await rpc(nome, corpo)));
}
await teste('Funções do banco', 'rede_contato_publico não devolve telefone de quem não marcou público', async () => {
  const r = await rpc('rede_contato_publico', { p_user_ids: [ZERO] });
  const d = await r.json();
  return Array.isArray(d) && d.length === 0 ? true : 'devolveu linhas para um usuário inexistente';
});

// Cadastro de adolescente com anuência
await teste('Cadastro de adolescente', 'tabela pre_cadastro_adolescente fechada a visitante', async () => negado(await get('pre_cadastro_adolescente?select=*&limit=1')));
for (const [nome, corpo] of [
  ['adolescente_criar_pre_cadastro', { p_nome: 'x', p_data_nascimento: '2011-01-01', p_modalidade: 'Futebol', p_categoria: null, p_cidade: null, p_estado: null, p_pais: 'Brasil', p_resp_nome: 'x', p_resp_whatsapp: '11999999999', p_resp_email: null }],
  ['adolescente_meu_pre_cadastro', {}],
  ['adolescente_reenviar_link', {}],
  ['adolescente_marcar_envio', {}],
  ['admin_pre_cadastros', {}],
  ['responsavel_aprovar_pre_cadastro', { p_token: 'x', p_cpf: '52998224725', p_termo_versao: 'v1' }],
]) {
  await teste('Cadastro de adolescente', `${nome} negada a visitante`, async () => negado(await rpc(nome, corpo)));
}
await teste('Cadastro de adolescente', 'link inexistente devolve só "invalido"', async () => {
  const d = await (await rpc('responsavel_ver_pre_cadastro', { p_token: 'nao-existe' })).json();
  return d && d.status === 'invalido' && Object.keys(d).length === 1 ? true : 'resposta inesperada';
});

// 7) Funções de servidor (edge functions)
await teste('Funções de servidor', 'send-carreira-push recusa visitante', async () => {
  const r = await fetch(`${URL_BASE}/functions/v1/send-carreira-push`, { method: 'POST', headers: H, body: JSON.stringify({ user_ids: [ZERO], title: 'x', body: 'x' }) });
  return r.status === 401 || r.status === 403 ? true : `HTTP ${r.status}`;
});
for (const antiga of ['send-push-notification', 'update-user-email', 'seed-test-data']) {
  await teste('Funções de servidor', `${antiga} não existe mais`, async () => {
    const r = await fetch(`${URL_BASE}/functions/v1/${antiga}`, { method: 'POST', headers: H, body: '{}' });
    return r.status === 404 ? true : `HTTP ${r.status}`;
  });
}

for (const [nome, corpo] of [
  ['send-perfil-incompleto-email', { nome: 'x', email: 'vitima@example.com', assunto: 'a', titulo: 'b', corpo: 'c' }],
  ['moderate-content', { content: 'oi', user_id: 'x' }],
  ['carreira-dicas-uso', {}],
  ['carreira-lembrete-perfil-incompleto', {}],
  ['carreira-lembrete-perfil-atleta-incompleto', {}],
]) {
  await teste('Funções de servidor', `${nome} recusa visitante (só o servidor ou o usuário logado)`, async () => {
    const r = await fetch(`${URL_BASE}/functions/v1/${nome}`, { method: 'POST', headers: H, body: JSON.stringify(corpo) });
    return r.status === 401 || r.status === 403 ? true : `HTTP ${r.status}`;
  });
}
for (const apagada of ['asaas-webhook-sandbox', 'send-peneira-push']) {
  await teste('Funções de servidor', `${apagada} não existe mais`, async () => {
    const r = await fetch(`${URL_BASE}/functions/v1/${apagada}`, { method: 'POST', headers: H, body: '{}' });
    return r.status === 404 ? true : `HTTP ${r.status}`;
  });
}
await teste('Funções do banco', 'admin_destinatarios_ids negada a visitante', async () => negado(await rpc('admin_destinatarios_ids')));

// Relatório
let falhas = 0, grupoAtual = '';
for (const r of resultados) {
  if (r.grupo !== grupoAtual) { grupoAtual = r.grupo; console.log(`\n${grupoAtual}`); }
  if (!r.ok) falhas++;
  console.log(`  ${r.ok ? 'OK   ' : 'FALHA'}  ${r.nome}${r.ok ? '' : `  -> ${r.detalhe}`}`);
}
console.log(`\n${resultados.length - falhas}/${resultados.length} verificações passaram.`);
if (falhas > 0) { console.log(`${falhas} FALHA(S): investigue antes de publicar. Veja docs/SEGURANCA.md.`); process.exit(1); }
