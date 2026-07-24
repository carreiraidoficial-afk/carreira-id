import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

export interface CurriculoExperiencia {
  nomeEscola: string;
  dataInicio: string;
  dataFim: string | null;
  atual: boolean;
  categoria: string | null;
  cidade: string | null;
  estado: string | null;
}

export interface CurriculoCampeonato {
  nome: string;
  organizador: string | null;
  dataInicio: string;
  posicaoFinal: string | null;
  categoria: string | null;
  nomeTime: string | null;
}

export interface CurriculoStats {
  totalJogos: number;
  totalGols: number;
  totalAssistencias: number;
  totalVitorias: number;
  totalCampeonatos: number;
  totalPremiacoes: number;
}

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
}

const POSICAO_LABELS: Record<string, string> = {
  campeao: 'Campeão',
  vice: 'Vice-campeão',
  semifinalista: 'Semifinalista',
  terceiro: '3º Lugar',
  quartas: 'Quartas de final',
  oitavas: 'Oitavas de final',
  fase_grupos: 'Fase de grupos',
  eliminado: 'Participação',
  em_andamento: 'Em andamento',
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '2 solid #f97316',
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  nome: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  subInfo: {
    fontSize: 10,
    color: '#555',
    marginBottom: 2,
  },
  brand: {
    fontSize: 9,
    color: '#f97316',
    fontWeight: 700,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    color: '#f97316',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '30%',
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 700,
    color: '#f97316',
  },
  statLabel: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  item: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: '0.5 solid #e5e5e5',
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: 700,
  },
  itemMeta: {
    fontSize: 9,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    fontSize: 8,
    fontWeight: 700,
    color: '#f97316',
    marginTop: 2,
  },
  empty: {
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
    borderTop: '0.5 solid #e5e5e5',
    paddingTop: 8,
  },
});

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  return `${m}/${y}`;
}

export function CurriculoDocument({ data }: { data: CurriculoData }) {
  const local = [data.cidade, data.estado].filter(Boolean).join(' - ');

  return (
    <Document title={`Currículo Esportivo — ${data.nome}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {data.fotoUrl ? (
            <Image src={data.fotoUrl} style={styles.photo} />
          ) : null}
          <View style={styles.headerInfo}>
            <Text style={styles.nome}>{data.nome}</Text>
            <Text style={styles.subInfo}>
              {[data.modalidade, data.categoria].filter(Boolean).join(' · ')}
              {data.idade ? ` · ${data.idade} anos` : ''}
            </Text>
            {local ? <Text style={styles.subInfo}>{local}</Text> : null}
            <Text style={styles.brand}>CARREIRA ID</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estatísticas</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalJogos}</Text>
              <Text style={styles.statLabel}>Jogos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalGols}</Text>
              <Text style={styles.statLabel}>Gols</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalAssistencias}</Text>
              <Text style={styles.statLabel}>Assistências</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalVitorias}</Text>
              <Text style={styles.statLabel}>Vitórias</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalCampeonatos}</Text>
              <Text style={styles.statLabel}>Campeonatos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.stats.totalPremiacoes}</Text>
              <Text style={styles.statLabel}>Premiações</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experiência (Clubes e Escolinhas)</Text>
          {data.experiencias.length === 0 ? (
            <Text style={styles.empty}>Nenhuma experiência registrada ainda.</Text>
          ) : (
            data.experiencias.map((exp, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitle}>{exp.nomeEscola}</Text>
                <Text style={styles.itemMeta}>
                  {formatDate(exp.dataInicio)} — {exp.atual ? 'Atual' : formatDate(exp.dataFim)}
                  {exp.categoria ? ` · ${exp.categoria}` : ''}
                  {exp.cidade ? ` · ${exp.cidade}${exp.estado ? '/' + exp.estado : ''}` : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campeonatos Disputados</Text>
          {data.campeonatos.length === 0 ? (
            <Text style={styles.empty}>Nenhum campeonato registrado ainda.</Text>
          ) : (
            data.campeonatos.map((camp, i) => (
              <View key={i} style={styles.item} wrap={false}>
                <Text style={styles.itemTitle}>{camp.nome}</Text>
                <Text style={styles.itemMeta}>
                  {formatDate(camp.dataInicio)}
                  {camp.categoria ? ` · ${camp.categoria}` : ''}
                  {camp.nomeTime ? ` · ${camp.nomeTime}` : ''}
                  {camp.organizador ? ` · Org: ${camp.organizador}` : ''}
                </Text>
                {camp.posicaoFinal ? (
                  <Text style={styles.badge}>
                    {POSICAO_LABELS[camp.posicaoFinal] || camp.posicaoFinal}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Currículo gerado em {new Date().toLocaleDateString('pt-BR')} pelo Carreira ID —
          carreiraid.com.br/{data.slug}
        </Text>
      </Page>
    </Document>
  );
}
