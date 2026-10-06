import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList, Wallet, CalendarCheck, CalendarClock, MessageCircle, Trophy, MapPin, Globe, Link2,
  ArrowRight, ExternalLink, Zap,
} from 'lucide-react';
import { LinkEscola, TipoLink, TIPOS_LINK } from '@/lib/links-escola';

export const ICONES_LINK: Record<TipoLink, LucideIcon> = {
  matricula: ClipboardList,
  planos: Wallet,
  aula_experimental: CalendarCheck,
  agendamento: CalendarClock,
  whatsapp: MessageCircle,
  competicao: Trophy,
  localizacao: MapPin,
  site: Globe,
  outro: Link2,
};

/** O layout depende só da quantidade de links -- o dono nunca escolhe tamanho ou posição. */
function classesGrade(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (n === 3) return 'grid-cols-1 sm:grid-cols-2';
  if (n === 4) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
}

interface Props {
  links: LinkEscola[];
  accentColor: string;
}

export function EscolaLinksBloco({ links, accentColor }: Props) {
  if (links.length === 0) return null;
  const n = links.length;

  return (
    <section
      className="rounded-xl bg-card p-4 sm:p-5"
      style={{ border: `2px solid ${accentColor}50` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: accentColor }} />
          Acesso rápido
          <span className="hidden sm:inline text-xs font-normal text-muted-foreground">
            Informações, matrículas e agendamento
          </span>
        </h2>
        <p className="text-[10px] text-muted-foreground">Links externos informados pela escola.</p>
      </div>

      <div className={`grid gap-3 ${classesGrade(n)}`}>
        {links.map((link, idx) => {
          const tipo = TIPOS_LINK[link.tipo];
          const Icone = ICONES_LINK[link.tipo];
          const destaque = idx === 0;
          const descricao = link.descricao || tipo.descricaoPadrao;
          // Com 3 links, o primeiro ocupa a linha inteira em telas médias.
          const ocupaLinha = n === 3 && destaque;
          const unico = n === 1;

          return (
            <a
              key={`${link.url}-${idx}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`group relative overflow-hidden rounded-xl p-3 sm:p-4 flex items-center gap-3 transition-transform hover:-translate-y-0.5 ${
                unico ? 'sm:gap-4' : 'sm:flex-col sm:items-stretch sm:gap-2 sm:min-h-[150px]'
              } ${ocupaLinha ? 'sm:col-span-2' : ''} ${destaque ? 'text-white' : 'bg-background text-foreground border'}`}
              style={
                destaque
                  ? { background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc 60%, #0f172a)` }
                  : { borderColor: `${accentColor}40` }
              }
            >
              <Icone
                aria-hidden
                className="absolute -right-3 -bottom-3 w-24 h-24 opacity-[0.08] pointer-events-none"
              />
              <div className={`shrink-0 ${unico ? '' : 'sm:flex sm:items-start sm:justify-between sm:gap-2'}`}>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={destaque ? { backgroundColor: 'rgba(255,255,255,0.18)' } : { backgroundColor: `${accentColor}18`, color: accentColor }}
                >
                  <Icone className="w-5 h-5" />
                </div>
                {!unico && <ExternalLink className="hidden sm:block w-4 h-4 opacity-60 shrink-0" />}
              </div>
              <ExternalLink className="sm:hidden absolute top-3 right-3 w-4 h-4 opacity-60" />

              {/* No celular: coluna ao lado do ícone. Do sm pra cima, vira filho direto do card. */}
              <div className={`flex flex-1 min-w-0 flex-col gap-2 pr-6 ${unico ? 'sm:pr-8' : 'sm:pr-0 sm:contents'}`}>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug line-clamp-2">{link.titulo}</h3>
                  {descricao && (
                    <p className={`mt-1 text-xs leading-relaxed line-clamp-2 hidden sm:block ${destaque ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {descricao}
                    </p>
                  )}
                </div>
                <span
                  className={`${unico ? 'sm:hidden' : 'sm:mt-auto'} inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold`}
                  style={
                    destaque
                      ? { backgroundColor: '#ffffff', color: '#0f172a' }
                      : { backgroundColor: accentColor, color: '#ffffff' }
                  }
                >
                  {tipo.cta}
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>

              {/* Link único (sm+): botão fica à direita, na mesma linha do texto */}
              {unico && (
                <span
                  className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                >
                  {tipo.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
