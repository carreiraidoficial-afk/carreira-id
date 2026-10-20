import { useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UfCidadeSelect } from '@/components/shared/UfCidadeSelect';
import { TelefoneInput } from '@/components/shared/TelefoneInput';
import { MODALIDADES, CATEGORIAS_BASE as CATEGORIAS } from '@/constants/esportes';
import { validatePhone, limparTelefone } from '@/lib/form-validators';
import { idadeEmAnos, whatsappParaWaMe, AVISO_DATA_REAL } from '@/lib/adolescente-anuencia';

interface Props {
  onBack: () => void;
  /** Código do convite (ex.: link da escola): vira vínculo pendente quando o responsável autoriza. */
  conviteCodigo?: string | null;
  /** Escola e unidade vindas do link (?escola=slug&unidade=...): viram pedido de vínculo pendente quando o responsável autoriza. */
  escolaSlug?: string | null;
  unidade?: string | null;
  /** Link de colega (?a=slug): conexão direta com quem convidou, sem aprovação, quando o responsável autoriza. */
  atletaSlug?: string | null;
  /** Cadastro salvo: devolve o token do link do responsável (só existe neste momento). */
  onCriado: (token: string) => void;
}

/** Cadastro iniciado pelo adolescente (12 a 17 anos). Nada vira perfil até o responsável confirmar. */
export function AdolescenteCadastroForm({ onBack, onCriado, conviteCodigo = null, escolaSlug = null, unidade = null, atletaSlug = null }: Props) {
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [modalidade, setModalidade] = useState('Futebol');
  const [categoria, setCategoria] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [respNome, setRespNome] = useState('');
  const [respWhatsapp, setRespWhatsapp] = useState('');
  const [respEmail, setRespEmail] = useState('');
  const [salvando, setSalvando] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) { toast.error('Informe o seu nome'); return; }
    if (!dataNascimento) { toast.error('Informe a sua data de nascimento'); return; }
    const idade = idadeEmAnos(dataNascimento);
    if (idade < 12) { toast.error('O cadastro próprio é a partir de 12 anos. Peça para seu responsável criar o seu perfil.'); return; }
    if (idade >= 18) { toast.error('Quem tem 18 anos ou mais faz o cadastro comum. Volte e escolha o seu perfil.'); return; }
    if (respNome.trim().length < 2) { toast.error('Informe o nome do seu responsável'); return; }
    const tel = limparTelefone(respWhatsapp);
    if (!tel || !validatePhone(tel)) { toast.error('Confira o WhatsApp do responsável'); return; }
    const email = respEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast.error('Confira o e-mail do responsável'); return; }

    setSalvando(true);
    try {
      const { data, error } = await (supabase as any).rpc('adolescente_criar_pre_cadastro', {
        p_nome: nome.trim(),
        p_data_nascimento: dataNascimento,
        p_modalidade: modalidade || 'Futebol',
        p_categoria: categoria || null,
        p_cidade: cidade || null,
        p_estado: estado || null,
        p_pais: 'Brasil',
        p_resp_nome: respNome.trim(),
        p_resp_whatsapp: whatsappParaWaMe(tel),
        p_resp_email: email || null,
        p_convite_codigo: conviteCodigo || null,
        p_escola_slug: escolaSlug || null,
        p_unidade: unidade || null,
        p_atleta_slug: atletaSlug || null,
      });
      if (error) throw error;
      onCriado((data as any).token);
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar agora. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-foreground">⚽ Meu cadastro de atleta</h1>
        <p className="text-sm text-muted-foreground mt-1">Para menores de 18 anos. Seu responsável confirma no final.</p>
      </div>

      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="adol-nome">Seu nome *</Label>
          <Input id="adol-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" maxLength={100} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adol-nasc">Data de nascimento *</Label>
          <Input id="adol-nasc" type="date" value={dataNascimento} max={hoje} onChange={(e) => setDataNascimento(e.target.value)} required />
          <p className="text-xs text-muted-foreground">Cadastro próprio a partir de 12 anos. Ela não aparece no seu perfil público. {AVISO_DATA_REAL}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Modalidade *</Label>
            <Select value={modalidade} onValueChange={setModalidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODALIDADES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <UfCidadeSelect estado={estado} cidade={cidade} onEstadoChange={setEstado} onCidadeChange={setCidade} className="grid grid-cols-2 gap-3" />

        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            Seu responsável (pai, mãe ou responsável legal)
          </div>
          <div className="space-y-2">
            <Label htmlFor="adol-resp-nome">Nome do responsável *</Label>
            <Input id="adol-resp-nome" value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Nome completo" maxLength={100} required />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp do responsável *</Label>
            <TelefoneInput value={respWhatsapp} onChange={setRespWhatsapp} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adol-resp-email">E-mail do responsável (opcional)</Label>
            <Input id="adol-resp-email" type="email" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
          </div>
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={salvando}>
          {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Continuar'}
        </Button>
      </form>
    </div>
  );
}
