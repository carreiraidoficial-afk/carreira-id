import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, School, Instagram, Globe, Phone, Users, Trophy, Building2, CalendarDays, ExternalLink } from 'lucide-react';
import { lerLinksEscola } from '@/lib/links-escola';
import { useComunidadeEscola } from '@/hooks/useCarreiraData';
import { useTrofeusEscola } from '@/hooks/useSalaTrofeusEscola';

interface PerfilEscola {
  id: string;
  user_id: string;
  nome: string;
  foto_url: string | null;
  banner_url?: string | null;
  cidade?: string | null;
  estado?: string | null;
  instagram?: string | null;
  site?: string | null;
  telefone_whatsapp?: string | null;
  whatsapp_publico?: boolean;
  dados_perfil?: Record<string, any> | null;
}

interface Props {
  perfil: PerfilEscola;
  displayName: string;
  accentColor: string;
  isEscolaParceira: boolean;
  isAnonymous: boolean;
  requireAuth: (reason: string) => void;
  /** Botões de ação (Conectar / Torcer / Compartilhar / Editar), já montados pela página. */
  actions: ReactNode;
}

function formatarSoDigitos(valor: string | null | undefined) {
  return String(valor || '').replace(/\D/g, '');
}

export function EscolaPerfilHero({ perfil, displayName, accentColor, isEscolaParceira, isAnonymous, requireAuth, actions }: Props) {
  const dados = (perfil.dados_perfil || {}) as Record<string, any>;
  const modalidades: string[] = Array.isArray(dados.modalidades)
    ? dados.modalidades.filter((m: any): m is string => typeof m === 'string' && m.trim().length > 0)
    : [];
  const unidades: any[] = Array.isArray(dados.unidades) ? dados.unidades : [];
  const links = lerLinksEscola(dados);
  const instagram = String(perfil.instagram || dados.arroba || '').replace(/^@+/, '').trim();
  const site = String(perfil.site || dados.site || '').trim();
  const digitos = formatarSoDigitos(perfil.telefone_whatsapp);
  const whatsappIntl = digitos ? (digitos.startsWith('55') ? digitos : `55${digitos}`) : '';
  const temContato = !!(perfil.whatsapp_publico && whatsappIntl);

  const { data: comunidade = [] } = useComunidadeEscola(perfil.user_id);
  const { data: trofeus = [] } = useTrofeusEscola(perfil.id);

  const anoFundacao = Number(dados.ano_fundacao);
  const anoAtual = new Date().getFullYear();
  const anosAtuacao = Number.isFinite(anoFundacao) && anoFundacao > 1900 && anoFundacao <= anoAtual
    ? anoAtual - anoFundacao
    : 0;

  const metricas = [
    { icon: Users, valor: comunidade.length, rotulo: comunidade.length === 1 ? 'Atleta' : 'Atletas' },
    { icon: Building2, valor: unidades.length, rotulo: unidades.length === 1 ? 'Unidade' : 'Unidades' },
    { icon: Trophy, valor: trofeus.length, rotulo: trofeus.length === 1 ? 'Conquista' : 'Conquistas' },
    { icon: CalendarDays, valor: anosAtuacao, rotulo: anosAtuacao === 1 ? 'Ano de atuação' : 'Anos de atuação' },
  ].filter((m) => m.valor > 0);

  const local = [perfil.cidade, perfil.estado].filter(Boolean).join(' - ');

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl overflow-hidden bg-card"
        style={{ border: `2px solid ${accentColor}50` }}
      >
        {/* Capa */}
        <div className="relative h-36 sm:h-48 lg:h-60 w-full overflow-hidden">
          {perfil.banner_url ? (
            <img src={perfil.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}66 55%, #0f172a)` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <div className="relative px-4 sm:px-6 pb-5">
          {/* Logo: única peça que sobrepõe a capa (metade por cima, metade por baixo) */}
          <div
            className="absolute -top-12 sm:-top-16 left-4 sm:left-6 z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-card shadow-lg flex items-center justify-center"
            style={{ border: '4px solid hsl(var(--card))', outline: `2px solid ${accentColor}66` }}
          >
            {perfil.foto_url ? (
              <img src={perfil.foto_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <School className="w-10 h-10 text-muted-foreground" />
            )}
          </div>

          <div className="pt-14 sm:pt-4 sm:pl-40 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:min-h-[4.5rem]">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight break-words">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-sm text-muted-foreground">
                {local && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />{local}
                  </span>
                )}
                <Badge variant="outline" className="text-[11px] gap-1" style={{ borderColor: `${accentColor}60`, color: accentColor }}>
                  <School className="w-3 h-3" />Escola de Esportes
                </Badge>
                {isEscolaParceira && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                    🤝 Escola Parceira
                  </Badge>
                )}
              </div>
              {modalidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {modalidades.map((mod) => (
                    <Badge key={mod} variant="secondary" className="text-[11px]">{mod}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 [&_button]:w-auto">
              {actions}
              {temContato && !isAnonymous && (
                <a
                  href={`https://wa.me/${whatsappIntl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />Entrar em contato
                </a>
              )}
              {temContato && isAnonymous && (
                <button
                  type="button"
                  onClick={() => requireAuth('contact')}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />Entrar em contato
                </button>
              )}
            </div>
          </div>

          {(instagram || site) && !isAnonymous && (
            <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-border text-xs">
              {instagram && (
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline" style={{ color: accentColor }}>
                  <Instagram className="w-3.5 h-3.5" />@{instagram}
                </a>
              )}
              {site && (
                <a href={site.startsWith('http') ? site : `https://${site}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:underline" style={{ color: accentColor }}>
                  <Globe className="w-3.5 h-3.5" />{site.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {links.length > 0 && (
        <section
          className="rounded-xl bg-card p-4 sm:p-5"
          style={{ border: `2px solid ${accentColor}50` }}
        >
          <h2 className="text-base font-semibold text-foreground mb-3">Matrículas e agendamento</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {links.map((link, idx) => (
              <a
                key={`${link.url}-${idx}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={`inline-flex items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  idx === 0 ? 'text-white sm:col-span-2' : 'border bg-background text-foreground hover:bg-muted'
                }`}
                style={idx === 0 ? { backgroundColor: accentColor } : { borderColor: `${accentColor}50` }}
              >
                <span className="truncate">{link.titulo}</span>
                <ExternalLink className="w-4 h-4 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Links externos informados pela escola.</p>
        </section>
      )}

      {metricas.length > 0 && (
        <div
          className="grid gap-px rounded-xl overflow-hidden bg-border"
          style={{ gridTemplateColumns: `repeat(${metricas.length}, minmax(0, 1fr))`, border: `1px solid ${accentColor}30` }}
        >
          {metricas.map(({ icon: Icon, valor, rotulo }) => (
            <div key={rotulo} className="bg-card px-3 py-4 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-center sm:text-left">
              <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" style={{ color: accentColor }} />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-foreground leading-none">{valor}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{rotulo}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
