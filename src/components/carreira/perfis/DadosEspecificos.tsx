import { Card } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { Award, Briefcase, Building2, FileText, MapPin, Star, Trophy } from 'lucide-react';
import { ehProfissionalEquipe, especialidadeVisivel, lerCertificacoes, linhasDeTexto } from '@/lib/perfil-profissional';
import type { ProfileType } from '../ProfileTypeSelector';

const LINK_FIELDS = new Set(['site', 'portfolio', 'site_whatsapp', 'contato', 'arroba']);
function isLinkField(key: string, val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  if (LINK_FIELDS.has(key)) return val.includes('.') || val.startsWith('http');
  return false;
}

interface Props {
  tipo: ProfileType;
  dados: Record<string, any> | null;
  accentColor?: string;
  /** "Cidade, UF" do perfil: entra como item "Localização" nos perfis de profissional. */
  localizacao?: string;
  /** Quando o Histórico Profissional estruturado já tem itens, o texto corrido de experiência sai (evita duplicar). */
  ocultarExperienciaTexto?: boolean;
}

interface ConfigProfissional {
  escalares: { key: string; label: string; Icone: LucideIcon }[];
  listas: { key: string; label: string }[];
  certKeys: string[];
  certTitulo: string;
  expKey: string;
}

const CONFIG_PROFISSIONAL: Record<string, ConfigProfissional> = {
  professor: {
    escalares: [
      { key: 'especialidade', label: 'Especialidade', Icone: Star },
      { key: 'modalidade', label: 'Modalidade', Icone: Trophy },
    ],
    listas: [{ key: 'categorias', label: 'Categorias que atua' }],
    certKeys: ['certificacoes'],
    certTitulo: 'Certificações',
    expKey: 'experiencia',
  },
  tecnico: {
    escalares: [{ key: 'clube_atual', label: 'Clube / Organização', Icone: Building2 }],
    listas: [
      { key: 'categorias', label: 'Categorias de interesse' },
      { key: 'posicoes', label: 'Posições que observa' },
    ],
    certKeys: ['licencas'],
    certTitulo: 'Licenças e certificações',
    expKey: 'historico',
  },
  preparador_fisico: {
    escalares: [
      { key: 'especialidade', label: 'Especialidade', Icone: Star },
      { key: 'cref', label: 'CREF', Icone: FileText },
    ],
    listas: [{ key: 'areas_atuacao', label: 'Áreas de atuação' }],
    certKeys: ['formacao', 'certificacoes'],
    certTitulo: 'Formação e certificações',
    expKey: 'experiencia',
  },
};

/** Professor, técnico e preparador físico: informações em grade, certificações e experiência em lista. */
function InformacoesProfissionaisEquipe({ tipo, dados, accentColor = '#3b82f6', localizacao, ocultarExperienciaTexto }: {
  tipo: string; dados: Record<string, any>; accentColor?: string; localizacao?: string; ocultarExperienciaTexto?: boolean;
}) {
  const cfg = CONFIG_PROFISSIONAL[tipo];
  const escalares = cfg.escalares
    .map((f) => ({ ...f, valor: f.key === 'especialidade' ? especialidadeVisivel(dados) : String(dados[f.key] || '').trim() }))
    .filter((f) => f.valor);
  if (localizacao) escalares.push({ key: 'localizacao', label: 'Localização', Icone: MapPin, valor: localizacao });
  const listas = cfg.listas
    .map((l) => ({ ...l, itens: (Array.isArray(dados[l.key]) ? dados[l.key] : []).filter(Boolean) as string[] }))
    .filter((l) => l.itens.length > 0);
  const certificacoesTexto = cfg.certKeys.flatMap((k) => linhasDeTexto(dados[k]));
  // Lista estruturada (aba Currículo) vence o texto corrido antigo.
  const estruturadas = lerCertificacoes(dados);
  const itensCert: { titulo: string; instituicao: string; status: string | null }[] =
    estruturadas.length > 0
      ? estruturadas
      : certificacoesTexto.map((titulo) => ({ titulo, instituicao: '', status: null }));
  const experiencia = ocultarExperienciaTexto ? [] : linhasDeTexto(dados[cfg.expKey]);

  if (escalares.length === 0 && listas.length === 0 && itensCert.length === 0 && experiencia.length === 0) return null;

  const tile = { backgroundColor: `${accentColor}18`, color: accentColor };

  return (
    <>
      {(escalares.length > 0 || listas.length > 0) && (
        <Card className="p-5">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4" style={{ color: accentColor }} />
            Informações Profissionais
          </h2>
          {escalares.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {escalares.map(({ key, label, Icone, valor }) => (
                <div key={key} className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={tile}>
                    <Icone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium text-foreground break-words">{valor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {listas.map((l) => (
            <div key={l.key} className={`flex flex-wrap items-center gap-2 ${escalares.length > 0 ? 'mt-4 pt-4 border-t border-border' : ''}`}>
              <span className="text-[11px] text-muted-foreground mr-1">{l.label}</span>
              {l.itens.map((item) => (
                <span key={item} className="px-2.5 py-0.5 text-xs rounded-full border text-foreground" style={{ borderColor: `${accentColor}40` }}>
                  {item}
                </span>
              ))}
            </div>
          ))}
        </Card>
      )}

      {itensCert.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award className="w-4 h-4" style={{ color: accentColor }} />
            {cfg.certTitulo}
          </h2>
          <ul className="space-y-2">
            {itensCert.map((c, i) => (
              <li key={`${c.titulo}-${i}`} className="flex items-start gap-3 text-sm text-foreground">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={tile}>
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="break-words">{c.titulo}</p>
                  {c.instituicao && <p className="text-xs text-muted-foreground break-words">{c.instituicao}</p>}
                </div>
                {c.status && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={c.status === 'andamento'
                      ? { backgroundColor: '#f59e0b22', color: '#d97706' }
                      : { backgroundColor: '#10b98122', color: '#059669' }}
                  >
                    {c.status === 'andamento' ? 'Em andamento' : 'Concluído'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {experiencia.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Briefcase className="w-4 h-4" style={{ color: accentColor }} />
            Experiência Profissional
          </h2>
          <ol className="relative ml-1.5 space-y-3 border-l border-border pl-5">
            {experiencia.map((linha, i) => (
              <li key={`${linha}-${i}`} className="relative text-sm text-foreground break-words">
                <span
                  className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                {linha}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}

interface FieldDisplay {
  key: string;
  label: string;
  type?: 'text' | 'list' | 'multiline';
}

const FIELDS_BY_TYPE: Record<ProfileType, FieldDisplay[]> = {
  professor: [
    { key: 'especialidade', label: 'Especialidade' },
    { key: 'modalidade', label: 'Modalidade' },
    { key: 'categorias', label: 'Categorias', type: 'list' },
    { key: 'certificacoes', label: 'Certificações', type: 'multiline' },
    { key: 'experiencia', label: 'Experiência', type: 'multiline' },
  ],
  tecnico: [
    { key: 'clube_atual', label: 'Clube / Organização' },
    { key: 'categorias', label: 'Categorias', type: 'list' },
    { key: 'posicoes', label: 'Posições que observa', type: 'list' },
    { key: 'licencas', label: 'Licenças', type: 'multiline' },
    { key: 'historico', label: 'Histórico', type: 'multiline' },
  ],
  dono_escola: [
    { key: 'nome_escola', label: 'Nome da Escola' },
    { key: 'endereco', label: 'Endereço' },
    { key: 'localizacao', label: 'Localização' },
    { key: 'modalidades', label: 'Modalidades', type: 'list' },
    { key: 'categorias', label: 'Categorias', type: 'list' },
    { key: 'site', label: 'Site' },
  ],
  preparador_fisico: [
    { key: 'especialidade', label: 'Especialidade' },
    { key: 'areas_atuacao', label: 'Áreas de Atuação', type: 'list' },
    { key: 'cref', label: 'CREF' },
    { key: 'formacao', label: 'Formação', type: 'multiline' },
    { key: 'certificacoes', label: 'Certificações', type: 'multiline' },
  ],
  empresario: [
    { key: 'empresa', label: 'Empresa / Agência' },
    { key: 'areas_atuacao', label: 'Áreas de Atuação', type: 'list' },
    { key: 'credenciais', label: 'Credenciais', type: 'multiline' },
    { key: 'site', label: 'Site / Contato' },
  ],
  influenciador: [
    { key: 'nicho', label: 'Nicho' },
    { key: 'rede_principal', label: 'Rede Principal' },
    { key: 'arroba', label: 'Perfil Principal' },
    { key: 'outras_redes', label: 'Outras Redes', type: 'multiline' },
  ],
  atleta_filho: [],
  jogador_profissional: [
    { key: 'clube_atual', label: 'Clube Atual (ou último)' },
    { key: 'status_carreira', label: 'Status da Carreira' },
    { key: 'posicao', label: 'Posição' },
    { key: 'categorias', label: 'Categorias', type: 'list' },
    { key: 'titulos', label: 'Títulos e Conquistas', type: 'multiline' },
  ],
  torcedor: [
    { key: 'time_torcida', label: 'Time do Coração' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'Estado' },
  ],
  scout: [
    { key: 'especialidade', label: 'Especialidade' },
    { key: 'regioes', label: 'Regiões de Atuação' },
    { key: 'clubes_anteriores', label: 'Clubes Anteriores', type: 'multiline' },
    { key: 'categorias', label: 'Categorias', type: 'list' },
    { key: 'posicoes', label: 'Posições que busca', type: 'list' },
  ],
  agente_clube: [
    { key: 'clube', label: 'Clube' },
    { key: 'categorias', label: 'Categorias', type: 'list' },
    { key: 'posicoes', label: 'Posições de Interesse', type: 'list' },
    { key: 'tempo_clube', label: 'Tempo no Clube' },
    { key: 'contato', label: 'Contato' },
  ],
  fotografo: [
    { key: 'especialidade', label: 'Especialidade' },
    { key: 'regiao', label: 'Região de Atuação' },
    { key: 'portfolio', label: 'Portfólio' },
    { key: 'site_whatsapp', label: 'Site / WhatsApp' },
  ],
};

export function DadosEspecificos({ tipo, dados, accentColor, localizacao, ocultarExperienciaTexto }: Props) {
  if (!dados) return null;

  if (ehProfissionalEquipe(tipo)) {
    return (
      <InformacoesProfissionaisEquipe tipo={tipo} dados={dados} accentColor={accentColor} localizacao={localizacao} ocultarExperienciaTexto={ocultarExperienciaTexto} />
    );
  }

  const fields = FIELDS_BY_TYPE[tipo] || [];
  const hasData = fields.some((f) => {
    const val = dados[f.key];
    return val && (Array.isArray(val) ? val.length > 0 : true);
  });

  if (!hasData) return null;

  const unidades = Array.isArray(dados.unidades) ? dados.unidades : [];

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-3">
        {tipo === 'torcedor' ? 'Informações' : 'Informações Profissionais'}
      </h2>
      <div className="space-y-3">
        {fields.map((field) => {
          const val = dados[field.key];
          if (!val || (Array.isArray(val) && val.length === 0)) return null;

          return (
            <div key={field.key}>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {field.label}
              </span>
              {field.type === 'list' && Array.isArray(val) ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {val.map((item: string) => (
                    <span key={item} className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground border border-border">
                      {item}
                    </span>
                  ))}
                </div>
              ) : field.type === 'multiline' ? (
                <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{val}</p>
              ) : isLinkField(field.key, val) ? (
                <a
                  href={String(val).startsWith('http') ? String(val) : `https://${val}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-0.5 block"
                >
                  {String(val).replace(/^https?:\/\//, '')}
                </a>
              ) : (
                <p className="text-sm text-foreground mt-0.5">{val}</p>
              )}
            </div>
          );
        })}

        {/* Unidades / Filiais for dono_escola */}
        {tipo === 'dono_escola' && unidades.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Unidades / Filiais
            </span>
            <div className="mt-1.5 space-y-2">
              {unidades.map((u: any, idx: number) => (
                <div key={idx} className="rounded-md border border-border p-2.5 bg-muted/20 flex items-center gap-2.5">
                  {u.logo_url && (
                    <img src={u.logo_url} alt={u.nome || 'Logo da unidade'} className="w-10 h-10 rounded object-cover shrink-0 border border-border" />
                  )}
                  <div className="min-w-0">
                    {u.nome && <p className="text-sm font-medium text-foreground">{u.nome}</p>}
                    {u.endereco && <p className="text-xs text-muted-foreground">🏠 {u.endereco}</p>}
                    {u.bairro && <p className="text-xs text-muted-foreground">📍 {u.bairro}</p>}
                    {u.referencia && <p className="text-xs text-muted-foreground">{u.referencia}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
