import { Card } from '@/components/ui/card';
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

export function DadosEspecificos({ tipo, dados }: Props) {
  if (!dados) return null;

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
