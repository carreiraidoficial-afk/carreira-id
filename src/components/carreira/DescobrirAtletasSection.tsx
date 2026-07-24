import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Filter, LayoutGrid, List, MapPin, Footprints, Trophy, User, ChevronDown, X, Loader2, ShieldCheck, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';

interface Filters {
  nome: string;
  categoria: string;
  posicao: string;
  pe_dominante: string;
  modalidade: string;
  estado: string;
  cidade: string;
  status_atleta: string;
}

import { CATEGORIAS, ESTADOS as ESTADOS_CONST } from '@/constants/esportes';

const POSICOES = [
  'Goleiro', 'Lateral Direito', 'Lateral Esquerdo', 'Zagueiro',
  'Volante', 'Meia', 'Meia Atacante', 'Ponta Direita', 'Ponta Esquerda',
  'Centroavante', 'Atacante',
];

const PE_OPTIONS = [
  { value: 'direito', label: 'Destro' },
  { value: 'esquerdo', label: 'Canhoto' },
  { value: 'ambidestro', label: 'Ambidestro' },
];

const ESTADOS = [...ESTADOS_CONST];

const PE_LABELS: Record<string, string> = {
  direito: 'Destro',
  esquerdo: 'Canhoto',
  ambidestro: 'Ambidestro',
};

const emptyFilters: Filters = {
  nome: '',
  categoria: '',
  posicao: '',
  pe_dominante: '',
  modalidade: '',
  estado: '',
  cidade: '',
  status_atleta: '',
};

function calcularCategoria(dataNascimento: string): string {
  const birthYear = new Date(dataNascimento).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  return `Sub-${age}`;
}

export function DescobrirAtletasSection() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const activeFilterCount = Object.values(appliedFilters).filter(v => v && v.length > 0).length;

  const { data: results, isLoading } = useQuery({
    queryKey: ['descobrir-atletas', appliedFilters],
    queryFn: async () => {
      let query = supabase
        .from('perfil_atleta')
        .select('id, slug, nome, foto_url, modalidade, modalidades, categoria, cidade, estado, posicao_principal, posicao_secundaria, pe_dominante, crianca_id, cor_destaque, bio, followers_count, conexoes_count')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (appliedFilters.nome) {
        query = query.ilike('nome', `%${appliedFilters.nome}%`);
      }
      if (appliedFilters.posicao) {
        query = query.or(`posicao_principal.eq.${appliedFilters.posicao},posicao_secundaria.eq.${appliedFilters.posicao}`);
      }
      if (appliedFilters.pe_dominante) {
        query = query.eq('pe_dominante', appliedFilters.pe_dominante);
      }
      if (appliedFilters.modalidade) {
        query = query.ilike('modalidade', `%${appliedFilters.modalidade}%`);
      }
      if (appliedFilters.estado) {
        query = query.eq('estado', appliedFilters.estado);
      }
      if (appliedFilters.cidade) {
        query = query.ilike('cidade', `%${appliedFilters.cidade}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let atletas = data || [];

      // If category filter is set, we need to fetch birth dates and filter client-side
      if (appliedFilters.categoria) {
        const criancaIds = atletas.filter(a => a.crianca_id).map(a => a.crianca_id!);
        if (criancaIds.length > 0) {
          const { data: criancas } = await supabase
            .from('criancas')
            .select('id, data_nascimento')
            .in('id', criancaIds);

          const criancaMap = new Map((criancas || []).map(c => [c.id, c.data_nascimento]));

          atletas = atletas.filter(a => {
            if (!a.crianca_id) return false;
            const dn = criancaMap.get(a.crianca_id);
            if (!dn) return false;
            return calcularCategoria(dn) === appliedFilters.categoria;
          });
        } else {
          // No criancas linked, filter by stored categoria field
          atletas = atletas.filter(a => a.categoria === appliedFilters.categoria);
        }
      }

      // Fetch birth dates for category display
      const allCriancaIds = atletas.filter(a => a.crianca_id).map(a => a.crianca_id!);
      let criancaDates = new Map<string, string>();
      if (allCriancaIds.length > 0) {
        const { data: criancas } = await supabase
          .from('criancas')
          .select('id, data_nascimento')
          .in('id', allCriancaIds);
        criancaDates = new Map((criancas || []).map(c => [c.id, c.data_nascimento || '']));
      }

      // Fetch current experiences for status
      const atletaCriancaIds = atletas.map(a => a.crianca_id).filter(Boolean) as string[];
      let expMap = new Map<string, { tipo_instituicao: string; nome_escola: string }>();
      if (atletaCriancaIds.length > 0) {
        const { data: exps } = await supabase
          .from('carreira_experiencias')
          .select('crianca_id, tipo_instituicao, nome_escola')
          .in('crianca_id', atletaCriancaIds)
          .eq('atual', true);
        for (const exp of exps || []) {
          if (exp.crianca_id) expMap.set(exp.crianca_id, { tipo_instituicao: exp.tipo_instituicao || '', nome_escola: exp.nome_escola });
        }
      }

      // Filter by status if set
      if (appliedFilters.status_atleta) {
        atletas = atletas.filter(a => {
          if (!a.crianca_id) return false;
          const exp = expMap.get(a.crianca_id);
          if (appliedFilters.status_atleta === 'federado') {
            return exp?.tipo_instituicao === 'clube_federado';
          } else if (appliedFilters.status_atleta === 'formacao') {
            return !exp || exp.tipo_instituicao !== 'clube_federado';
          }
          return true;
        });
      }

      // Determine which plans currently have search-priority / listing-highlight enabled
      const { data: planosConfig } = await supabase
        .from('carreira_planos_config')
        .select('plano, prioridade_busca, destaque_listagem');
      const prioridadeBuscaAtiva = planosConfig?.find(p => p.plano === 'premium')?.prioridade_busca ?? false;
      const destaqueListagemAtivo = planosConfig?.find(p => p.plano === 'premium')?.destaque_listagem ?? false;

      // Determine which athletes have an active/trial premium subscription
      // (uses a SECURITY DEFINER RPC since carreira_assinaturas is only readable by its own owner)
      let premiumCriancaIds = new Set<string>();
      if (allCriancaIds.length > 0) {
        const { data: premiumRows } = await supabase
          .rpc('get_premium_crianca_ids', { p_crianca_ids: allCriancaIds });
        premiumCriancaIds = new Set((premiumRows || []).map(r => r.crianca_id));
      }

      let atletasComPlano = atletas.map(a => ({
        ...a,
        categoriaCalc: a.crianca_id && criancaDates.get(a.crianca_id) ? calcularCategoria(criancaDates.get(a.crianca_id)!) : a.categoria,
        statusInfo: a.crianca_id ? expMap.get(a.crianca_id) : null,
        isPremium: !!(a.crianca_id && premiumCriancaIds.has(a.crianca_id)),
        destaque: destaqueListagemAtivo && !!(a.crianca_id && premiumCriancaIds.has(a.crianca_id)),
      }));

      if (prioridadeBuscaAtiva) {
        atletasComPlano = [
          ...atletasComPlano.filter(a => a.isPremium),
          ...atletasComPlano.filter(a => !a.isPremium),
        ];
      }

      return atletasComPlano;
    },
  });

  const handleSearch = () => {
    setAppliedFilters({ ...filters });
  };

  const handleClear = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card className="p-4">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Filtros de Busca</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{activeFilterCount}</Badge>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 space-y-3">
            {/* Name search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={filters.nome}
                onChange={e => updateFilter('nome', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Row 1: Categoria + Posição */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={filters.categoria} onValueChange={v => updateFilter('categoria', v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.posicao} onValueChange={v => updateFilter('posicao', v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Posição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas posições</SelectItem>
                  {POSICOES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Pé dominante + Modalidade */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={filters.pe_dominante} onValueChange={v => updateFilter('pe_dominante', v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pé dominante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filters.modalidade} onValueChange={v => updateFilter('modalidade', v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Modalidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Futebol">Futebol</SelectItem>
                  <SelectItem value="Futsal">Futsal</SelectItem>
                  <SelectItem value="Society">Society</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: Status do Atleta */}
            <div className="grid grid-cols-1 gap-2">
              <Select value={filters.status_atleta} onValueChange={v => updateFilter('status_atleta', v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Status do Atleta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="federado">⚽ Atleta Federado</SelectItem>
                  <SelectItem value="formacao">🏫 Atleta em Formação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Estado + Cidade */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={filters.estado} onValueChange={v => updateFilter('estado', v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos estados</SelectItem>
                  {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>

              <Input
                placeholder="Cidade"
                value={filters.cidade}
                onChange={e => updateFilter('cidade', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="h-9 text-xs"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleSearch}>
                <Search className="w-3.5 h-3.5 mr-1" />
                Buscar Atletas
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleClear}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoading ? 'Buscando...' : `${results?.length || 0} atleta${(results?.length || 0) !== 1 ? 's' : ''} encontrado${(results?.length || 0) !== 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-1">
          <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="sm" className="h-7 w-7 p-0"
            onClick={() => setViewMode('grid')}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="h-7 w-7 p-0"
            onClick={() => setViewMode('list')}>
            <List className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results?.map(atleta => (
            <Link key={atleta.id} to={carreiraPath(`/${atleta.slug}`)} className="block">
              <Card className={`overflow-hidden hover:ring-1 hover:ring-primary/50 transition-all group ${atleta.destaque ? 'ring-2 ring-amber-400' : ''}`}>
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                  {atleta.foto_url ? (
                    <img src={atleta.foto_url} alt={atleta.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <User className="w-12 h-12 text-muted-foreground/40" />
                  )}
                  {atleta.destaque && (
                    <Badge className="absolute top-1 right-1 text-[9px] px-1 py-0 h-4 gap-0.5 bg-amber-400 text-amber-950 border-0">
                      <Crown className="w-2.5 h-2.5" />Destaque
                    </Badge>
                  )}
                </div>
                <div className="p-2.5 space-y-1">
                  <h3 className="text-xs font-bold text-foreground truncate">{atleta.nome}</h3>
                  {atleta.categoriaCalc && (
                    <p className="text-[10px] font-medium" style={{ color: atleta.cor_destaque || 'hsl(var(--primary))' }}>
                      {atleta.categoriaCalc}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {atleta.posicao_principal && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
                        <Footprints className="w-2.5 h-2.5" />{atleta.posicao_principal}
                      </Badge>
                    )}
                    {atleta.pe_dominante && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                        {PE_LABELS[atleta.pe_dominante] || atleta.pe_dominante}
                      </Badge>
                    )}
                  </div>
                  {atleta.statusInfo?.tipo_instituicao === 'clube_federado' && (
                    <div className="flex items-center gap-0.5 text-[9px] text-primary">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span className="truncate">{atleta.statusInfo.nome_escola}</span>
                    </div>
                  )}
                  {(atleta.cidade || atleta.estado) && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      {[atleta.cidade, atleta.estado].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Results List */}
      {!isLoading && viewMode === 'list' && (
        <div className="space-y-2">
          {results?.map(atleta => (
            <Link key={atleta.id} to={carreiraPath(`/${atleta.slug}`)} className="block">
              <Card className={`p-3 hover:ring-1 hover:ring-primary/50 transition-all ${atleta.destaque ? 'ring-2 ring-amber-400' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {atleta.foto_url ? (
                      <img src={atleta.foto_url} alt={atleta.nome} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground truncate">{atleta.nome}</h3>
                      {atleta.destaque && (
                        <Badge className="text-[9px] px-1 py-0 h-4 gap-0.5 bg-amber-400 text-amber-950 border-0 shrink-0">
                          <Crown className="w-2.5 h-2.5" />Destaque
                        </Badge>
                      )}
                      {atleta.categoriaCalc && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {atleta.categoriaCalc}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                      {atleta.posicao_principal && (
                        <span className="flex items-center gap-0.5">
                          <Footprints className="w-3 h-3" />
                          {atleta.posicao_principal}
                          {atleta.posicao_secundaria && ` / ${atleta.posicao_secundaria}`}
                        </span>
                      )}
                      {atleta.pe_dominante && (
                        <span>• {PE_LABELS[atleta.pe_dominante] || atleta.pe_dominante}</span>
                      )}
                      {atleta.modalidade && (
                        <span className="flex items-center gap-0.5">
                          <Trophy className="w-3 h-3" />{atleta.modalidade}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      {(atleta.cidade || atleta.estado) && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {[atleta.cidade, atleta.estado].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {atleta.statusInfo?.tipo_instituicao === 'clube_federado' && (
                        <span className="flex items-center gap-0.5 text-primary">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {atleta.statusInfo.nome_escola}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && results?.length === 0 && (
        <div className="text-center py-10">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum atleta encontrado com esses filtros.</p>
          <p className="text-xs text-muted-foreground mt-1">Tente ajustar os critérios de busca.</p>
        </div>
      )}
    </div>
  );
}
