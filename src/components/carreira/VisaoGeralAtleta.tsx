import { useQuery } from '@tanstack/react-query';
import { parseDataLocal } from '@/lib/datas';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, Footprints, MapPin, PenSquare, Target, Trophy, User, UsersRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import type { CarreiraExperiencia } from '@/hooks/useCarreiraExperienciasData';

interface Props {
  perfil: any;
  experiencias: CarreiraExperiencia[] | undefined;
  accentColor: string;
  /** O dono vê o atalho para publicar (as publicações vivem no Feed). */
  isOwner?: boolean;
  onVerExperiencias: () => void;
}

const PE_LABELS: Record<string, string> = { direito: 'Direito', esquerdo: 'Esquerdo', ambidestro: 'Ambidestro' };

function anoDe(data: string | null | undefined): string {
  return data ? String(parseDataLocal(data).getFullYear()) : '';
}

/** Aba "Visão Geral" do atleta: resumo com as informações principais e os clubes por onde passou. */
export function VisaoGeralAtleta({ perfil, experiencias, accentColor, isOwner, onVerExperiencias }: Props) {
  // Mesma consulta do topo do perfil (chave igual, vem do cache): a categoria é calculada pela data de nascimento.
  const { data: crianca } = useQuery({
    queryKey: ['crianca-nascimento', perfil.crianca_id],
    queryFn: async () => {
      const { data } = await supabase.from('criancas').select('data_nascimento').eq('id', perfil.crianca_id).single();
      return data;
    },
    enabled: !!perfil.crianca_id,
  });

  const categoria = crianca?.data_nascimento
    ? `Sub ${new Date().getFullYear() - parseDataLocal(crianca.data_nascimento).getFullYear()}`
    : perfil.categoria;
  const modalidades: string[] = (perfil.modalidades?.length ? perfil.modalidades : [perfil.modalidade]).filter(Boolean);
  const posicao = perfil.posicao_principal
    ? `${perfil.posicao_principal}${perfil.posicao_secundaria ? ` / ${perfil.posicao_secundaria}` : ''}`
    : '';
  const pe = perfil.pe_dominante ? PE_LABELS[perfil.pe_dominante] || perfil.pe_dominante : '';
  const local = [perfil.cidade, perfil.estado].filter(Boolean).join(', ');

  const linhas = [
    categoria && { icone: UsersRound, rotulo: 'Categoria', valor: categoria },
    posicao && { icone: Target, rotulo: 'Posição', valor: posicao },
    pe && { icone: Footprints, rotulo: 'Pé', valor: pe },
    modalidades.length > 0 && { icone: Trophy, rotulo: 'Modalidade', valor: modalidades.join(' e ') },
    local && { icone: MapPin, rotulo: 'Cidade', valor: local },
  ].filter(Boolean) as { icone: any; rotulo: string; valor: string }[];

  // Atual primeiro, depois os mais recentes. O resumo mostra até 3; o resto fica na aba Experiência.
  const clubes = [...(experiencias || [])]
    .sort((a, b) => Number(b.atual) - Number(a.atual) || String(b.data_inicio).localeCompare(String(a.data_inicio)));
  const clubesVisiveis = clubes.slice(0, 3);

  return (
    <div className="space-y-3">
      {isOwner && (
        <Link
          to={carreiraPath('/feed')}
          className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/40"
          style={{ borderColor: `${accentColor}50`, color: accentColor }}
        >
          <span className="flex items-center gap-2">
            <PenSquare className="h-4 w-4" /> Publicar no Feed
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}

      <Card className="p-4" style={{ borderColor: `${accentColor}40`, borderWidth: 1 }}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <User className="h-4 w-4" style={{ color: accentColor }} /> Informações principais
        </h2>
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não há informações preenchidas.</p>
        ) : (
          <dl className="space-y-3">
            {linhas.map(({ icone: Icone, rotulo, valor }) => (
              <div key={rotulo} className="flex items-center gap-3">
                <Icone className="h-5 w-5 shrink-0" style={{ color: accentColor }} />
                <div className="min-w-0">
                  <dt className="text-[11px] leading-tight text-muted-foreground">{rotulo}</dt>
                  <dd className="break-words text-sm font-semibold leading-tight text-foreground">{valor}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card className="p-4" style={{ borderColor: `${accentColor}40`, borderWidth: 1 }}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4" style={{ color: accentColor }} /> Clubes e escolas
        </h2>
        {clubesVisiveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma passagem cadastrada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {clubesVisiveis.map((c) => {
              const inicio = anoDe(c.data_inicio);
              const fim = c.atual ? 'Atual' : anoDe(c.data_fim);
              const periodo = [inicio, fim].filter(Boolean).join(' - ');
              return (
                <li key={c.id} className="flex items-center gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-full border bg-white object-contain p-0.5" />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                      style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    >
                      {c.nome_escola?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold leading-tight text-foreground">{c.nome_escola}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.categoria_instituicao, periodo].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {clubes.length > 0 && (
          <button
            type="button"
            onClick={onVerExperiencias}
            className="mt-3 flex items-center gap-1 text-xs font-semibold hover:underline"
            style={{ color: accentColor }}
          >
            {clubes.length > clubesVisiveis.length ? `Ver todas (${clubes.length})` : 'Ver detalhes'} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </Card>
    </div>
  );
}
