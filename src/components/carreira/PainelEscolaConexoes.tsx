import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, GraduationCap, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useComunidadeEscola, usePendentesEscola } from '@/hooks/useCarreiraData';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { PedidosPendentesAlunos } from './PedidosPendentesAlunos';

export interface EscolaDoDono {
  id: string;
  nome: string;
  slug: string;
}

interface Props {
  escola: EscolaDoDono;
  escolaUserId: string;
  accentColor?: string;
}

function Passo({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{numero}</span>
        {titulo}
      </h4>
      {children}
    </div>
  );
}

/**
 * Painel do dono da escola na tela de Conexões. Separa o que é ALUNO (entra pelo link da escola e precisa ser
 * confirmado) do que é CONTATO (outras pessoas e profissionais conectados, que ficam mais abaixo na tela).
 */
export function PainelEscolaConexoes({ escola, escolaUserId, accentColor = '#3b82f6' }: Props) {
  const [copiado, setCopiado] = useState(false);
  const { data: alunos = [] } = useComunidadeEscola(escolaUserId);
  const { data: pendentes = [] } = usePendentesEscola(escolaUserId, true);

  const link = `${window.location.origin}${carreiraPath('/cadastro')}?ref=atleta&escola=${escola.slug}`;
  const mensagem = `Olá! A ${escola.nome} usa o Carreira ID para acompanhar a trajetória dos alunos. Crie o perfil do seu atleta por este link: ${link}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  };

  return (
    <Card className="space-y-5 p-4" style={{ borderColor: `${accentColor}50`, borderWidth: 2 }}>
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <GraduationCap className="h-5 w-5 shrink-0" style={{ color: accentColor }} />
          Alunos da {escola.nome}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong className="text-foreground">Aluno</strong> é o atleta que treina na sua escola e aparece em "Nossos atletas" no perfil.
          <strong className="text-foreground"> Contato</strong> é qualquer outra pessoa conectada a você (profissionais, outras escolas…) e fica mais abaixo, em "Contatos".
        </p>
      </div>

      <Passo numero={1} titulo="Convide os alunos">
        <p className="text-xs text-muted-foreground">
          Envie este link aos pais. Quem criar o perfil do atleta por ele cai na lista de confirmação do passo 2.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 text-xs text-muted-foreground"
            aria-label="Link de convite de aluno"
          />
          <Button type="button" size="sm" className="h-9 shrink-0 gap-1.5" onClick={copiar}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer">
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 gap-1.5">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          </a>
        </div>
      </Passo>

      <Passo numero={2} titulo={`Confirme quem é aluno${pendentes.length ? ` (${pendentes.length} aguardando)` : ''}`}>
        <p className="text-xs text-muted-foreground">
          Antes de entrar na lista de alunos, o atleta espera a sua confirmação. Toque em <strong className="text-foreground">É aluno</strong> para
          aceitar ou em <strong className="text-foreground">Recusar</strong> se não conhece.
        </p>
        <PedidosPendentesAlunos escolaUserId={escolaUserId} accentColor={accentColor} mostrarVazio />
      </Passo>

      <Passo numero={3} titulo={`Alunos confirmados (${alunos.length})`}>
        <p className="text-xs text-muted-foreground">
          Estes aparecem para todos em "Nossos atletas". Para tirar alguém da lista, use o botão de desvincular no cartão dele, no perfil da escola.
        </p>
        <Link
          to={carreiraPath(`/${escola.slug}`)}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          style={{ borderColor: `${accentColor}60`, color: accentColor }}
        >
          <Users className="h-3.5 w-3.5" /> Ver e gerenciar a lista de alunos
        </Link>
      </Passo>
    </Card>
  );
}
