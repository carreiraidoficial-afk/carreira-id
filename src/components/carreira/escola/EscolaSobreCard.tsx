import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Info, Trophy, Users, MapPin, Building2, ChevronRight, Sun, Volleyball, Waves, Dribbble } from 'lucide-react';

interface Props {
  nome: string;
  bio: string | null;
  dados: Record<string, any> | null;
  accentColor: string;
  /** Logo/foto do perfil da escola, exibida no título do cartão. */
  logoUrl?: string | null;
  /** "Cidade - UF" da escola: ajuda o Google Maps a achar o endereço das unidades. */
  local?: string;
}

function lista(valor: unknown): string[] {
  return Array.isArray(valor)
    ? valor.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Ícone por palavra-chave da modalidade; o que não for conhecido cai no troféu. */
function iconeModalidade(nome: string): LucideIcon {
  const n = semAcento(nome);
  if (/areia|beach/.test(n)) return Sun;
  if (/volei/.test(n)) return Volleyball;
  if (/basquete/.test(n)) return Dribbble;
  if (/natacao/.test(n)) return Waves;
  return Trophy;
}

function TituloSecao({ icone: Icone, children, accentColor }: { icone: LucideIcon; children: string; accentColor: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
      <Icone className="w-3.5 h-3.5" style={{ color: accentColor }} />
      {children}
    </p>
  );
}

/** Bloco "Sobre" do perfil da escola: descrição + unidades + modalidades + categorias,
 * montado a partir dos dados já cadastrados (nada de preenchimento extra). */
export function EscolaSobreCard({ nome, bio, dados, accentColor, logoUrl, local }: Props) {
  const modalidades = lista(dados?.modalidades);
  const categorias = lista(dados?.categorias);
  const unidades: any[] = Array.isArray(dados?.unidades) ? dados!.unidades.filter((u: any) => u && (u.nome || u.bairro)) : [];
  const endereco = String(dados?.endereco || '').trim();

  const temAlgo = !!bio?.trim() || modalidades.length > 0 || categorias.length > 0 || unidades.length > 0 || !!endereco;
  if (!temAlgo) return null;

  const temUnidadesEModalidades = unidades.length > 0 && modalidades.length > 0;

  const secaoUnidades = unidades.length > 0 && (
    <div className="min-w-0">
      <TituloSecao icone={MapPin} accentColor={accentColor}>Unidades</TituloSecao>
      <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {unidades.map((u, i) => {
          const rotulo = String(u.nome || u.bairro);
          const enderecoUnidade = String(u.endereco || '').trim();
          // Se a unidade tem "referência" (ex.: uma praça), o mapa procura por ela; senão, pelo endereço.
          const referencia = String(u.referencia || '').trim();
          const consultaMapa = referencia
            ? [referencia, u.bairro, local].filter(Boolean).join(', ')
            : enderecoUnidade
              ? [enderecoUnidade, u.bairro, local].filter(Boolean).join(', ')
              : '';
          const conteudo = (
            <>
              <div
                className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
              >
                {u.logo_url ? (
                  <img src={u.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{rotulo}</p>
                {u.nome && u.bairro && <p className="text-xs text-muted-foreground">{u.bairro}</p>}
                {enderecoUnidade && (
                  <p className="mt-1 text-[11px] text-muted-foreground flex items-start gap-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" style={{ color: accentColor }} />
                    <span className="line-clamp-2">{enderecoUnidade}</span>
                  </p>
                )}
              </div>
              {consultaMapa && <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
            </>
          );
          const classes = 'flex items-center gap-3 rounded-xl border p-3 transition-colors';
          const estilo = { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}0d` };
          return consultaMapa ? (
            <a
              key={`${rotulo}-${i}`}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaMapa)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver ${rotulo} no mapa`}
              className={`${classes} hover:brightness-110`}
              style={estilo}
            >
              {conteudo}
            </a>
          ) : (
            <div key={`${rotulo}-${i}`} className={classes} style={estilo}>{conteudo}</div>
          );
        })}
      </div>
    </div>
  );

  const secaoModalidades = modalidades.length > 0 && (
    <div className="min-w-0">
      <TituloSecao icone={Trophy} accentColor={accentColor}>Modalidades</TituloSecao>
      <div className={`grid gap-2.5 grid-cols-1 sm:grid-cols-2 ${temUnidadesEModalidades ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
        {modalidades.map((m, i) => {
          const Icone = iconeModalidade(m);
          const destaque = i === 0;
          return (
            <div
              key={m}
              className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold"
              style={
                destaque
                  ? { backgroundColor: accentColor, borderColor: accentColor, color: '#ffffff' }
                  : { borderColor: `${accentColor}40`, backgroundColor: `${accentColor}0d` }
              }
            >
              <Icone className="w-4 h-4 shrink-0" style={destaque ? undefined : { color: accentColor }} />
              <span className={`min-w-0 ${destaque ? '' : 'text-foreground'}`}>{m}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Card className="p-4 sm:p-5" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2.5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="w-9 h-9 rounded-lg object-cover shrink-0"
            style={{ outline: `2px solid ${accentColor}50` }}
          />
        ) : (
          <Info className="w-4 h-4" style={{ color: accentColor }} />
        )}
        <span className="min-w-0 break-words">Sobre {nome}</span>
      </h2>

      <div className="space-y-5">
        {(bio?.trim() || endereco) && (
          <div>
            {bio?.trim() && (
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{bio}</p>
            )}
            {endereco && (
              <p className="mt-3 text-xs text-muted-foreground flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Sede: {endereco}</span>
              </p>
            )}
          </div>
        )}

        {temUnidadesEModalidades ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {secaoUnidades}
            {secaoModalidades}
          </div>
        ) : (
          <>
            {secaoUnidades}
            {secaoModalidades}
          </>
        )}

        {categorias.length > 0 && (
          <div>
            <TituloSecao icone={Users} accentColor={accentColor}>Categorias</TituloSecao>
            <div className="flex flex-wrap gap-2">
              {categorias.map((c) => (
                <span
                  key={c}
                  className="rounded-full border px-3 py-1 text-xs font-medium text-foreground"
                  style={{ borderColor: `${accentColor}40` }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
