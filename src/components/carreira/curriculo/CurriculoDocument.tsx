import { Document, Page, Text, View, Image, StyleSheet, Svg, Polygon } from '@react-pdf/renderer';

// A fonte da marca (Plus Jakarta Sans) é registrada por quem gera o PDF (ver curriculo-fontes.ts no app).
const FONTE = 'PlusJakarta';

export interface CurriculoExperiencia {
  nomeEscola: string;
  dataInicio: string;
  dataFim: string | null;
  atual: boolean;
  categoria: string | null;
  cidade: string | null;
  estado: string | null;
  posicao?: string | null;
  logoUrl?: string | null;
}

export interface CurriculoCampeonato {
  nome: string;
  organizador: string | null;
  dataInicio: string;
  posicaoFinal: string | null;
  categoria: string | null;
  nomeTime: string | null;
}

export interface CurriculoPremiacao {
  titulo: string;
  campeonato: string | null;
  /** coletivo = campeão/vice/3º do time; individual = prêmio do atleta; destaque_jogo = uma partida em que foi o destaque. */
  tipo?: 'coletivo' | 'individual' | 'destaque_jogo';
  /** Detalhe da linha (nos destaques de jogo: "vs Adversário · Fase"). */
  detalhe?: string | null;
}

/** Posições que entram como troféu (e ganham selo): só o pódio. */
export const POSICOES_PODIO = ['campeao', 'vice', 'terceiro'];

export interface CurriculoStats {
  totalJogos: number;
  totalGols: number;
  totalAssistencias: number;
  totalVitorias: number;
  totalCampeonatos: number;
  totalPremiacoes: number;
  // Goleiro
  jogosComoGoleiro?: number;
  totalDefesas?: number;
  totalGolsSofridos?: number;
  totalPenaltisDefendidos?: number;
}

export type CurriculoTema = 'claro' | 'escuro';

export interface CurriculoData {
  nome: string;
  fotoUrl: string | null;
  modalidade: string | null;
  categoria: string | null;
  cidade: string | null;
  estado: string | null;
  idade: number | null;
  slug: string;
  stats: CurriculoStats;
  experiencias: CurriculoExperiencia[];
  campeonatos: CurriculoCampeonato[];
  // Novos (todos opcionais, o currículo continua funcionando sem eles)
  bio?: string | null;
  posicaoPrincipal?: string | null;
  posicaoSecundaria?: string | null;
  peDominante?: string | null;
  corDestaque?: string | null;
  instagram?: string | null;
  pais?: string | null;
  modalidades?: string[];
  premiacoes?: CurriculoPremiacao[];
  /** QR code do perfil público, já como imagem (data URL). */
  qrCodeUrl?: string | null;
  /** Logo da marca (imagem clara, para fundo escuro). */
  logoUrl?: string | null;
  tema?: CurriculoTema;
}

export const POSICAO_LABELS: Record<string, string> = {
  campeao: 'Campeão',
  vice: 'Vice-campeão',
  semifinalista: 'Semifinalista',
  terceiro: '3º lugar',
  quartas: 'Quartas de final',
  oitavas: 'Oitavas de final',
  fase_grupos: 'Fase de grupos',
  eliminado: 'Participação',
  em_andamento: 'Em andamento',
};

// Medalhas: só campeão, vice e terceiro ganham cor própria.
export const MEDALHA: Record<string, { fundo: string; texto: string }> = {
  campeao: { fundo: '#FEF3C7', texto: '#92400E' },
  vice: { fundo: '#E5E7EB', texto: '#374151' },
  terceiro: { fundo: '#FFEDD5', texto: '#9A3412' },
};

export function paleta(tema: CurriculoTema, acento: string) {
  const escuro = tema === 'escuro';
  return {
    escuro,
    acento,
    pagina: escuro ? '#0A0A0A' : '#FFFFFF',
    faixa: '#000000',
    texto: escuro ? '#F5F7FA' : '#111827',
    suave: escuro ? '#9CA3AF' : '#6B7280',
    cartao: escuro ? '#151515' : '#F3F4F6',
    linha: escuro ? '#262626' : '#E5E7EB',
  };
}

export function corValida(c?: string | null): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#F97316';
}

/** A fonte do PDF não tem emoji nem símbolos: tira o que viraria um quadradinho e junta linhas soltas. */
export function limpar(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .replace(/[\p{Extended_Pictographic}‍️�]/gu, '')
    .replace(/\s*\n+\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s·]+|[\s·]+$/g, '');
}

export function arroba(instagram: string): string {
  const s = instagram.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '').replace(/^@/, '');
  return s ? `@${s}` : '';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return m ? `${m}/${y}` : y;
}

export function ano(iso: string | null): string {
  return iso ? iso.split('-')[0] : '';
}

export function numero(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/** Números de destaque: só o que tem valor, adaptado à posição (goleiro x linha). Máximo de 6. */
export function destaques(d: CurriculoData): { valor: number; rotulo: string }[] {
  const s = d.stats;
  const ehGoleiro = /goleir/i.test(d.posicaoPrincipal || '') || (numero(s.jogosComoGoleiro) > 0 && numero(s.totalDefesas) > 0);
  const lista: { valor: number; rotulo: string }[] = [
    { valor: numero(s.totalJogos), rotulo: 'Jogos' },
    { valor: numero(s.totalVitorias), rotulo: 'Vitórias' },
  ];
  if (ehGoleiro) {
    lista.push(
      { valor: numero(s.totalDefesas), rotulo: 'Defesas' },
      { valor: numero(s.totalPenaltisDefendidos), rotulo: 'Pênaltis defendidos' },
    );
  } else {
    lista.push(
      { valor: numero(s.totalGols), rotulo: 'Gols' },
      { valor: numero(s.totalAssistencias), rotulo: 'Assistências' },
    );
  }
  lista.push(
    { valor: numero(s.totalCampeonatos), rotulo: 'Campeonatos' },
    { valor: numero(s.totalPremiacoes), rotulo: 'Premiações' },
  );
  return lista.filter((x) => x.valor > 0).slice(0, 6);
}

/** Dados do atleta para o bloco "Ficha técnica" (aparece quando ainda não há premiações). */
function fichaTecnica(d: CurriculoData): { rotulo: string; valor: string }[] {
  const mods = (d.modalidades && d.modalidades.length ? d.modalidades : [d.modalidade]).filter(Boolean).join(' · ');
  const posicoes = [d.posicaoPrincipal, d.posicaoSecundaria].filter(Boolean).join(' / ');
  const atual = d.experiencias.find((x) => x.atual);
  return [
    { rotulo: 'Modalidades', valor: mods },
    { rotulo: 'Posição', valor: posicoes },
    { rotulo: 'Pé dominante', valor: d.peDominante ? String(d.peDominante).replace(/^./, (c) => c.toUpperCase()) : '' },
    { rotulo: 'Categoria', valor: d.categoria || '' },
    { rotulo: 'Clube atual', valor: atual ? limpar(atual.nomeEscola) : '' },
  ].filter((x) => x.valor);
}

function criarEstilos(p: ReturnType<typeof paleta>) {
  return StyleSheet.create({
    page: { fontFamily: FONTE, fontSize: 9.5, color: p.texto, backgroundColor: p.pagina, paddingTop: 26, paddingBottom: 66 },
    // Capa
    faixa: { backgroundColor: p.faixa, height: 168, paddingHorizontal: 32, paddingTop: 26, position: 'relative', marginTop: -26 },
    acentoBarra: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: p.acento },
    acentoCanto: { position: 'absolute', right: -40, top: -50, width: 190, height: 190, borderRadius: 95, backgroundColor: p.acento, opacity: 0.16 },
    topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logo: { width: 104, height: 26, objectFit: 'contain' },
    marca: { fontSize: 11, fontWeight: 800, color: '#FFFFFF', letterSpacing: 1.2 },
    tipoDoc: { fontSize: 7.5, fontWeight: 600, color: p.acento, letterSpacing: 2, textTransform: 'uppercase' },
    heroTexto: { position: 'absolute', left: 190, right: 32, top: 66 },
    nome: { fontSize: 25, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1 },
    linhaEsporte: { fontSize: 11, fontWeight: 600, color: p.acento, marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 9 },
    chip: { fontSize: 8, fontWeight: 600, color: '#E5E7EB', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginRight: 5, marginBottom: 4 },
    foto: { position: 'absolute', left: 32, top: 62, width: 128, height: 160, borderRadius: 14, borderWidth: 4, borderColor: p.pagina, objectFit: 'cover' },
    fotoVazia: { position: 'absolute', left: 32, top: 62, width: 128, height: 160, borderRadius: 14, borderWidth: 4, borderColor: p.pagina, backgroundColor: p.acento, alignItems: 'center', justifyContent: 'center' },
    fotoInicial: { fontSize: 54, fontWeight: 800, color: '#FFFFFF' },
    // Corpo
    corpo: { paddingHorizontal: 32, marginTop: 14 },
    corpoComFoto: { paddingLeft: 32 + 128 + 24, paddingRight: 32, minHeight: 36 },
    bio: { fontSize: 9.5, lineHeight: 1.5, color: p.suave },
    secao: { marginTop: 12 },
    secaoTitulo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    secaoTraco: { width: 16, height: 3, borderRadius: 2, backgroundColor: p.acento, marginRight: 7 },
    secaoTexto: { fontSize: 9, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: p.texto },
    ficha: { backgroundColor: p.cartao, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 4 },
    fichaLinha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.6, borderBottomColor: p.linha },
    fichaRotulo: { fontSize: 8, fontWeight: 600, color: p.suave, textTransform: 'uppercase', letterSpacing: 0.5 },
    fichaValor: { fontSize: 9.5, fontWeight: 700, color: p.texto, maxWidth: '62%', textAlign: 'right' },
    numerosFaixa: { flexDirection: 'row', backgroundColor: p.cartao, borderRadius: 10, borderTopWidth: 2, borderTopColor: p.acento, paddingVertical: 7 },
    numeroCelula: { flex: 1, alignItems: 'center' },
    numeroDivisor: { borderLeftWidth: 0.5, borderLeftColor: p.linha },
    numeroValor: { fontSize: 16, fontWeight: 800, color: p.texto, lineHeight: 1 },
    numeroRotulo: { fontSize: 6.5, fontWeight: 600, color: p.suave, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
    colunas: { flexDirection: 'row' },
    colEsq: { width: '56%', paddingRight: 14 },
    colDir: { width: '44%' },
    // Trajetória
    clube: { flexDirection: 'row', marginBottom: 9 },
    clubePonto: { width: 9, height: 9, borderRadius: 5, backgroundColor: p.acento, marginTop: 3, marginRight: 9 },
    clubeLinha: { position: 'absolute', left: 4, top: 14, bottom: -9, width: 1, backgroundColor: p.linha },
    clubeLogo: { width: 20, height: 20, borderRadius: 4, marginRight: 8, objectFit: 'contain' },
    clubeNome: { fontSize: 10.5, fontWeight: 700, color: p.texto },
    clubeMeta: { fontSize: 8.5, color: p.suave, marginTop: 1.5 },
    // Destaques
    premio: { flexDirection: 'row', marginBottom: 7, backgroundColor: p.cartao, borderRadius: 8, padding: 8 },
    premioIcone: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    premioIconeTxt: { fontSize: 8, fontWeight: 800, color: '#92400E' },
    premioTitulo: { fontSize: 9.5, fontWeight: 700, color: p.texto },
    premioCamp: { fontSize: 8, color: p.suave, marginTop: 1.5 },
    // Campeonatos
    campLinha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.6, borderBottomColor: p.linha },
    campAno: { width: 34, fontSize: 9, fontWeight: 800, color: p.acento },
    campInfo: { flex: 1, paddingRight: 8 },
    campNome: { fontSize: 10, fontWeight: 700, color: p.texto },
    campMeta: { fontSize: 8, color: p.suave, marginTop: 1.5 },
    campChip: { fontSize: 7.5, fontWeight: 800, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
    vazio: { fontSize: 9, color: p.suave },
    mais: { fontSize: 8, fontWeight: 600, color: p.acento, marginTop: 4 },
    // Rodapé
    rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, backgroundColor: p.faixa, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32 },
    rodapeBarra: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: p.acento },
    qr: { width: 38, height: 38, borderRadius: 4, backgroundColor: '#FFFFFF', marginRight: 12 },
    rodapeTitulo: { fontSize: 8.5, fontWeight: 700, color: '#FFFFFF' },
    rodapeLink: { fontSize: 8.5, fontWeight: 800, color: p.acento, marginTop: 2 },
    rodapeData: { marginLeft: 'auto', fontSize: 7.5, color: '#9CA3AF', textAlign: 'right' },
  });
}

function Secao({ titulo, nota, estilos, children }: { titulo: string; nota?: string; estilos: ReturnType<typeof criarEstilos>; children: React.ReactNode }) {
  return (
    <View style={estilos.secao}>
      <View style={estilos.secaoTitulo} minPresenceAhead={40}>
        <View style={estilos.secaoTraco} />
        <Text style={estilos.secaoTexto}>{titulo}</Text>
        {nota ? <Text style={[estilos.mais, { marginTop: 0, marginLeft: 'auto' }]}>{nota}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const MAX_CLUBES = 4;
const MAX_DESTAQUES = 3;
const MAX_CAMPEONATOS = 4;

export function CurriculoDocument({ data }: { data: CurriculoData }) {
  const acento = corValida(data.corDestaque);
  const p = paleta(data.tema ?? 'claro', acento);
  const e = criarEstilos(p);
  const local = [data.cidade, data.estado].filter(Boolean).join(' - ');
  const posicoes = [data.posicaoPrincipal, data.posicaoSecundaria].filter(Boolean).join(' / ');
  const linhaEsporte = [data.modalidade, posicoes, data.categoria].filter(Boolean).join('  ·  ');
  const chips = [
    data.idade ? `${data.idade} anos` : null,
    data.peDominante ? `Pé ${String(data.peDominante).toLowerCase()}` : null,
    local || null,
    data.pais && data.pais !== 'Brasil' ? data.pais : null,
  ].filter(Boolean) as string[];
  const numeros = destaques(data);
  // No resumo, as partidas em que foi destaque viram uma linha só ("Destaque do jogo (3x)"); o completo lista cada uma.
  const premiacoesTodas = data.premiacoes || [];
  const nDestaques = premiacoesTodas.filter((x) => x.tipo === 'destaque_jogo').length;
  const premiacoes: CurriculoPremiacao[] = [
    ...premiacoesTodas.filter((x) => x.tipo !== 'destaque_jogo'),
    ...(nDestaques > 0 ? [{ titulo: nDestaques === 1 ? 'Destaque do jogo' : `Destaque do jogo (${nDestaques}x)`, campeonato: null, tipo: 'destaque_jogo' as const }] : []),
  ];
  const clubes = data.experiencias.slice(0, MAX_CLUBES);
  const campeonatos = [...data.campeonatos].sort((a, b) => (b.dataInicio || '').localeCompare(a.dataInicio || ''));
  const dataGerado = new Date().toLocaleDateString('pt-BR');
  const link = `carreiraid.com.br/${data.slug}`;

  return (
    <Document title={`Currículo esportivo — ${data.nome}`} author="Carreira ID" subject="Currículo esportivo">
      <Page size="A4" style={e.page} wrap={false}>
        {/* Capa */}
        <View style={e.faixa}>
          <View style={e.acentoCanto} />
          <View style={e.topo}>
            {data.logoUrl ? <Image src={data.logoUrl} style={e.logo} /> : <Text style={e.marca}>CARREIRA ID</Text>}
            <Text style={e.tipoDoc}>Currículo esportivo</Text>
          </View>
          <View style={e.heroTexto}>
            <Text style={[e.nome, limpar(data.nome).length > 26 ? { fontSize: 21 } : {}]}>{limpar(data.nome)}</Text>
            {linhaEsporte ? <Text style={e.linhaEsporte}>{linhaEsporte}</Text> : null}
            {chips.length > 0 ? (
              <View style={e.chips}>
                {chips.map((c) => <Text key={c} style={e.chip}>{c}</Text>)}
              </View>
            ) : null}
          </View>
          <View style={e.acentoBarra} />
        </View>
        {data.fotoUrl ? (
          <Image src={data.fotoUrl} style={e.foto} />
        ) : (
          <View style={e.fotoVazia}><Text style={e.fotoInicial}>{data.nome.trim().charAt(0).toUpperCase()}</Text></View>
        )}

        {/* Resumo */}
        <View style={[e.corpo, e.corpoComFoto]}>
          {limpar(data.bio) ? <Text style={e.bio}>{limpar(data.bio)}</Text> : null}
        </View>

        <View style={e.corpo}>
          {/* Números */}
          {numeros.length > 0 ? (
            <Secao titulo="Números da carreira" estilos={e}>
              <View style={e.numerosFaixa} wrap={false}>
                {numeros.map((n, i) => (
                  <View key={n.rotulo} style={[e.numeroCelula, i > 0 ? e.numeroDivisor : {}]}>
                    <Text style={e.numeroValor}>{n.valor}</Text>
                    <Text style={e.numeroRotulo}>{n.rotulo}</Text>
                  </View>
                ))}
              </View>
            </Secao>
          ) : null}

          {/* Trajetória + Destaques */}
          <View style={[e.colunas, e.secao]}>
            <View style={e.colEsq}>
              <View style={e.secaoTitulo}>
                <View style={e.secaoTraco} />
                <Text style={e.secaoTexto}>Trajetória</Text>
              </View>
              {data.experiencias.length === 0 ? (
                <Text style={e.vazio}>Nenhuma experiência registrada ainda.</Text>
              ) : (
                clubes.map((exp, i) => (
                  <View key={i} style={e.clube} wrap={false}>
                    {i < clubes.length - 1 ? <View style={e.clubeLinha} /> : null}
                    {exp.logoUrl ? <Image src={exp.logoUrl} style={e.clubeLogo} /> : <View style={e.clubePonto} />}
                    <View style={{ flex: 1 }}>
                      <Text style={e.clubeNome}>{limpar(exp.nomeEscola)}</Text>
                      <Text style={e.clubeMeta}>
                        {[
                          `${formatDate(exp.dataInicio)} — ${exp.atual ? 'Atual' : formatDate(exp.dataFim)}`,
                          exp.categoria,
                          exp.posicao,
                          exp.cidade ? `${exp.cidade}${exp.estado ? '/' + exp.estado : ''}` : null,
                        ].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              {data.experiencias.length > MAX_CLUBES ? (
                <Text style={e.mais}>+ {data.experiencias.length - MAX_CLUBES} no perfil completo</Text>
              ) : null}
            </View>
            <View style={e.colDir}>
              <View style={e.secaoTitulo}>
                <View style={e.secaoTraco} />
                <Text style={e.secaoTexto}>{premiacoes.length === 0 ? 'Ficha técnica' : 'Destaques'}</Text>
              </View>
              {premiacoes.length === 0 ? (
                <View style={e.ficha}>
                  {fichaTecnica(data).map((f, i, arr) => (
                    <View key={f.rotulo} style={[e.fichaLinha, i === arr.length - 1 ? { borderBottomWidth: 0 } : {}]}>
                      <Text style={e.fichaRotulo}>{f.rotulo}</Text>
                      <Text style={e.fichaValor}>{f.valor}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                premiacoes.slice(0, MAX_DESTAQUES).map((pr, i) => (
                  <View key={i} style={e.premio} wrap={false}>
                    <View style={e.premioIcone}>
                      <Svg viewBox="0 0 24 24" width={9} height={9}>
                        <Polygon points="12,2 15,9 22,9.5 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9.5 9,9" fill="#92400E" />
                      </Svg>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={e.premioTitulo}>{limpar(pr.titulo)}</Text>
                      {pr.campeonato ? <Text style={e.premioCamp}>{limpar(pr.campeonato)}</Text> : null}
                    </View>
                  </View>
                ))
              )}
              {premiacoes.length > MAX_DESTAQUES ? (
                <Text style={e.mais}>+ {premiacoes.length - MAX_DESTAQUES} no perfil completo</Text>
              ) : null}
            </View>
          </View>

          {/* Campeonatos */}
          <Secao
            titulo="Campeonatos disputados"
            nota={campeonatos.length > MAX_CAMPEONATOS ? `+ ${campeonatos.length - MAX_CAMPEONATOS} no perfil completo` : undefined}
            estilos={e}
          >
            {campeonatos.length === 0 ? (
              <Text style={e.vazio}>Nenhum campeonato registrado ainda.</Text>
            ) : (
              campeonatos.slice(0, MAX_CAMPEONATOS).map((camp, i) => {
                const medalha = camp.posicaoFinal && POSICOES_PODIO.includes(camp.posicaoFinal) ? MEDALHA[camp.posicaoFinal] : undefined;
                return (
                  <View key={i} style={e.campLinha} wrap={false}>
                    <Text style={e.campAno}>{ano(camp.dataInicio)}</Text>
                    <View style={e.campInfo}>
                      <Text style={e.campNome}>{limpar(camp.nome)}</Text>
                      <Text style={e.campMeta}>
                        {[camp.categoria, camp.nomeTime, camp.organizador ? `Org.: ${camp.organizador}` : null].filter(Boolean).join('  ·  ')}
                      </Text>
                    </View>
                    {camp.posicaoFinal && medalha ? (
                      <Text style={[e.campChip, { backgroundColor: medalha.fundo, color: medalha.texto }]}>
                        {POSICAO_LABELS[camp.posicaoFinal] || camp.posicaoFinal}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </Secao>
        </View>

        {/* Rodapé fixo com QR do perfil */}
        <View style={e.rodape} fixed>
          <View style={e.rodapeBarra} />
          {data.qrCodeUrl ? <Image src={data.qrCodeUrl} style={e.qr} /> : null}
          <View>
            <Text style={e.rodapeTitulo}>Perfil completo, jogos e vídeos</Text>
            <Text style={e.rodapeLink}>{link}</Text>
          </View>
          <Text style={e.rodapeData}>
            Gerado em {dataGerado}
            {data.instagram && arroba(data.instagram) ? `\n${arroba(data.instagram)}` : ''}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
