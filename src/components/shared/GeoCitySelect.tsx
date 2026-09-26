import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GEO_DATA_BASE_URL } from '@/lib/geoData';

interface CidadeGeo {
  id: number;
  name: string;
}

interface EstadoComCidades {
  id: number;
  cities: CidadeGeo[];
}

interface PaisComCidades {
  id: number;
  states: EstadoComCidades[];
}

/** Cache em memória por país -- evita rebaixar o mesmo arquivo se a pessoa
 * trocar de estado dentro do mesmo país várias vezes. */
const cachePorPais = new Map<number, Promise<PaisComCidades | null>>();

function fetchCidadesDoPais(countryId: number): Promise<PaisComCidades | null> {
  if (!cachePorPais.has(countryId)) {
    const promise = fetch(`${GEO_DATA_BASE_URL}/cities/${countryId}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    cachePorPais.set(countryId, promise);
  }
  return cachePorPais.get(countryId)!;
}

interface Props {
  countryId?: number;
  stateId?: number;
  value: string;
  onChange: (nome: string) => void;
  placeHolder?: string;
}

/** Substitui o CitySelect da lib react-country-state-city, que sempre baixa
 * o arquivo global de cidades inteiro (~41MB) -- aqui busca só o arquivo do
 * país selecionado (ver src/lib/geoData.ts), tipicamente poucos KB. */
export function GeoCitySelect({ countryId, stateId, value, onChange, placeHolder = 'Selecione' }: Props) {
  const [cidades, setCidades] = useState<CidadeGeo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCidades([]);
    if (!countryId || !stateId) return;
    let ativo = true;
    setLoading(true);
    fetchCidadesDoPais(countryId).then((pais) => {
      if (!ativo) return;
      const estado = pais?.states.find((s) => s.id === stateId);
      setCidades(estado?.cities || []);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [countryId, stateId]);

  return (
    <Select value={value} onValueChange={onChange} disabled={!stateId || loading}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? 'Carregando...' : placeHolder} />
      </SelectTrigger>
      <SelectContent>
        {cidades.map((c) => (
          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
