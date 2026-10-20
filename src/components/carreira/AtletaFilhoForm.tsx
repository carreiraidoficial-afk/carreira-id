import { useEffect, useRef, useState } from 'react';
import { copiarTelefoneParaConta } from '@/lib/telefone-conta';
import { TelefoneInput } from '@/components/shared/TelefoneInput';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UfCidadeSelect } from '@/components/shared/UfCidadeSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Upload, Shield, Lock, CheckCircle } from 'lucide-react';
import { validateCPF, formatCPF } from '@/lib/cpf-validator';
import { validatePhone, limparTelefone, formatPhoneInput, SUPPORT_WHATSAPP_URL } from '@/lib/form-validators';
import { trackOnboardingFunil } from '@/lib/onboardingFunil';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import { idadeEmAnos, AVISO_DATA_REAL, MAIORIDADE_DECLARACAO_VERSAO } from '@/lib/adolescente-anuencia';
import { VisibilidadePerfilEscolha, type VisibilidadePerfil } from '@/components/carreira/VisibilidadePerfilEscolha';

interface Props {
  userId: string;
  defaultName: string;
  inviteCode: string | null;
  onBack: () => void;
  /** Quando um cupom válido foi digitado, informa quantos dias de trial ele
   * concede (substitui o TRIAL_DIAS padrão) e o id do cupom, pra registrar
   * na assinatura e contar quantos atletas cada cupom trouxe. */
  onComplete: (cupomAplicado?: { diasTrial: number; cupomId: string }) => void | Promise<void>;
  /** Permite cadastrar um atleta mesmo que o responsável já tenha outro
   * (irmãos). Sem isso, o form bloqueia um segundo cadastro por engano. */
  allowMultiple?: boolean;
  /** 'proprio': atleta com 18 anos ou mais se cadastrando (dados dele, sem responsável). Padrão: responsável cadastrando o atleta. */
  modo?: 'responsavel' | 'proprio';
  /** Quando a pessoa diz que é o próprio atleta e tem menos de 18 anos: leva ao cadastro com autorização do responsável. */
  onSouMenor?: () => void;
}

import { MODALIDADES, CATEGORIAS_BASE as CATEGORIAS } from '@/constants/esportes';
import { StateSelect } from 'react-country-state-city';
import { PaisSelect } from '@/components/shared/PaisSelect';
import 'react-country-state-city/dist/react-country-state-city.css';
import { GeoCitySelect } from '@/components/shared/GeoCitySelect';
import { GEO_DATA_BASE_URL } from '@/lib/geoData';

import { resolverConvite } from '@/lib/contato-perfil';
const normalizarNome = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    + '-' + Math.random().toString(36).substring(2, 6);
}

export function AtletaFilhoForm({ userId, defaultName, inviteCode, onBack, onComplete, allowMultiple = false, modo = 'responsavel', onSouMenor }: Props) {
  const [nome, setNome] = useState('');
  // Pode mudar no meio do caminho: se o nome do atleta é igual ao do responsável, perguntamos se é o próprio atleta.
  const [modoAtual, setModoAtual] = useState<'responsavel' | 'proprio'>(modo);
  const proprio = modoAtual === 'proprio';
  const [declaraMaioridade, setDeclaraMaioridade] = useState(false);
  const [perguntaAtleta, setPerguntaAtleta] = useState(false);
  const jaConfirmouResponsavel = useRef(false);
  const [nomeResponsavel, setNomeResponsavel] = useState(defaultName || '');
  const [dataNascimento, setDataNascimento] = useState('');
  const [modalidade, setModalidade] = useState('Futebol');
  const [categoria, setCategoria] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [pais, setPais] = useState<string>('Brasil');
  const [paisObj, setPaisObj] = useState<any>(null);
  const [estadoIntlId, setEstadoIntlId] = useState<number | undefined>();

  const [cpf, setCpf] = useState('');
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Quem pode ver o perfil. Adulto e atleta de 16+ já vêm com "Público" marcado; para menor de 16 a escolha é obrigatória e explícita.
  const [visibilidade, setVisibilidade] = useState<VisibilidadePerfil | null>(null);
  const idadeAtleta = dataNascimento ? idadeEmAnos(dataNascimento) : -1;
  useEffect(() => {
    if (visibilidade === null && (proprio || idadeAtleta >= 16)) setVisibilidade('publico');
  }, [proprio, idadeAtleta, visibilidade]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cupomAplicado, setCupomAplicado] = useState<{ diasTrial: number; cupomId: string } | undefined>();

  const formatPhone = formatPhoneInput;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AtletaFilhoForm] Submit iniciado');

    if (!nome.trim()) {
      toast.error('Nome do atleta é obrigatório');
      return;
    }
    if (!dataNascimento) {
      toast.error('Data de nascimento é obrigatória');
      return;
    }
    // Nome do atleta igual ao do responsável: provavelmente é o próprio atleta se cadastrando. Pergunta antes de seguir.
    if (!proprio && !jaConfirmouResponsavel.current && normalizarNome(nome) !== '' && normalizarNome(nome) === normalizarNome(nomeResponsavel)) {
      setPerguntaAtleta(true);
      return;
    }
    if (proprio && !declaraMaioridade) {
      toast.error('Marque a declaração de que você tem 18 anos ou mais para continuar.');
      return;
    }
    if (!visibilidade) {
      toast.error('Escolha quem pode ver o perfil: público ou só quem tem conta.');
      return;
    }
    if (proprio && idadeEmAnos(dataNascimento) < 18) {
      toast.error('Quem tem menos de 18 anos faz o cadastro com a autorização do responsável. Volte e escolha essa opção.');
      return;
    }

    const cleanDocInput = cpf.replace(/\D/g, '');
    let cleanDoc: string | null = null;

    const cleanPhoneInput = limparTelefone(telefoneWhatsapp);
    let cleanPhone: string | null = null;

    // Validate CPF if provided
    if (cleanDocInput.length > 0) {
      if (!validateCPF(cleanDocInput)) {
        toast.error('CPF inválido. Verifique os números digitados.');
        return;
      }
      cleanDoc = cleanDocInput;
    }

    // Validate WhatsApp if provided
    if (cleanPhoneInput.length > 0) {
      if (!validatePhone(cleanPhoneInput)) {
        toast.error('Número de WhatsApp inválido. Confira o número e o país selecionado.');
        return;
      }
      cleanPhone = cleanPhoneInput;
    }

    setIsLoading(true);
    console.log('[AtletaFilhoForm] Validação OK, criando perfil...');
    trackOnboardingFunil(userId, 'formulario_enviado', 'atleta_filho');
    try {
      // Bloqueia duplicata só quando NÃO for um cadastro intencional de mais
      // um atleta (irmãos) -- ver allowMultiple, ligado ao botão "Adicionar
      // outro atleta" no painel do responsável.
      if (!allowMultiple) {
        const { data: existingPerfil } = await supabase
          .from('perfil_atleta')
          .select('id, slug')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (existingPerfil) {
          toast.info('Você já possui um perfil de atleta cadastrado. Redirecionando...', { duration: 4000 });
          setIsLoading(false);
          await onComplete();
          return;
        }
      }

      // 1. Create crianca record (generate ID client-side to avoid SELECT after INSERT,
      // since RLS SELECT policies won't match until perfil_atleta is linked)
      const criancaId = crypto.randomUUID();
      const { error: criancaError } = await supabase
        .from('criancas')
        .insert({
          id: criancaId,
          nome: nome.trim(),
          data_nascimento: dataNascimento,
          ativo: true,
        });

      if (criancaError) { console.error('[AtletaFilhoForm] Erro crianca:', criancaError); throw criancaError; }
      console.log('[AtletaFilhoForm] Crianca criada:', criancaId);

      // 2. Upload photo if provided
      let fotoUrl: string | null = null;
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop();
        const path = `${userId}/${criancaId}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('atleta-fotos')
          .upload(path, fotoFile, { upsert: true });

        if (uploadError) {
          console.error('Erro upload foto:', uploadError);
          toast.error('Erro ao enviar foto, mas o perfil será criado sem foto.');
        } else {
          const { data: urlData } = supabase.storage
            .from('atleta-fotos')
            .getPublicUrl(path);
          fotoUrl = urlData.publicUrl;
        }
      }

      // 3. Create perfil_atleta linked to crianca
      const slug = generateSlug(nome);
      const { data: novoPerfil, error: perfilError } = await supabase
        .from('perfil_atleta')
        .insert({
          user_id: userId,
          nome: nome.trim(),
          slug,
          modalidade: modalidade || 'Futebol',
          categoria: categoria || null,
          cidade: cidade || null,
          estado: estado || null,
          pais: pais || 'Brasil',
          bio: null,
          foto_url: fotoUrl,
          crianca_id: criancaId,
          is_public: visibilidade === 'publico',
          cpf_cnpj: cleanDoc || null,
          tipo_documento: cleanDoc ? 'cpf' : null,
          telefone_whatsapp: cleanPhone || null,
          origem: 'carreira',
          cadastro_proprio: proprio,
          maioridade_declarada_em: proprio ? new Date().toISOString() : null,
          maioridade_declaracao_versao: proprio ? MAIORIDADE_DECLARACAO_VERSAO : null,
        } as any)
        .select('id')
        .single();

      if (perfilError) { console.error('[AtletaFilhoForm] Erro perfil:', perfilError); throw perfilError; }
      console.log('[AtletaFilhoForm] Perfil criado com slug:', slug);

      // 4. Handle cupom personalizado if present (código digitado pela família)
      if (cupomCodigo.trim()) {
        // A validação é feita no servidor (código exato, ativo e dentro da validade): a tabela de cupons não é pública.
        const { data: cupom } = await (supabase as any).rpc('carreira_cupom_validar', { p_codigo: cupomCodigo.trim() });

        if (cupom && cupom.id) {
          setCupomAplicado({ diasTrial: cupom.dias_trial, cupomId: cupom.id });
        } else {
          toast.info('Código de cupom inválido ou expirado — seguindo com o trial padrão.');
        }
      }

      // 5. Handle invite code if present
      if (inviteCode) {
        const inviterProfile = await resolverConvite(inviteCode);

        if (inviterProfile) {
          await supabase.from('rede_convites').insert({
            convidante_perfil_id: inviterProfile.id,
            convidado_user_id: userId,
          });
          // userId = current user must be solicitante for RLS
          await supabase.from('rede_conexoes').insert({
            solicitante_id: userId,
            destinatario_id: inviterProfile.user_id,
            // Convite de escola: o dono precisa confirmar que é aluno antes do atleta entrar em "Nossos atletas".
            status: inviterProfile.tipo === 'dono_escola' ? 'pendente' : 'aceita',
            origem: 'convite',
            solicitante_perfil_atleta_id: novoPerfil?.id || null,
          } as any);
        }
      }

      // O WhatsApp do responsável também vira telefone da conta, se a conta ainda não tem um.
      await copiarTelefoneParaConta(userId, cleanPhone);
      toast.success('Perfil do atleta criado com sucesso!');

      // E-mail de boas-vindas pro responsável -- não bloqueia nem falha o
      // cadastro se o envio der problema, é só um "bônus".
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const primeiroNomeResponsavel = ((proprio ? nome : nomeResponsavel) || (proprio ? 'atleta' : 'responsável')).trim().split(' ')[0];
          await supabase.functions.invoke('send-perfil-incompleto-email', {
            body: {
              nome: (proprio ? nome : nomeResponsavel).trim() || (proprio ? 'Atleta' : 'Responsável'),
              email: user.email,
              assunto: `Bem-vindo ao Carreira ID, ${primeiroNomeResponsavel}! 🎉`,
              titulo: proprio ? 'Seu perfil já está no ar' : `O perfil de ${nome.trim()} já está no ar`,
              corpo: proprio
                ? 'Seu cadastro foi concluído com sucesso. Agora é só completar o seu perfil pra aparecer com tudo pra quem importa no esporte.'
                : `Seu cadastro foi concluído com sucesso. Agora é só completar o perfil de ${nome.trim()} pra ele aparecer com tudo pra quem importa no esporte de base.`,
              ctaTexto: 'Ver o perfil',
              profileUrl: `https://carreiraid.com.br${carreiraPath(`/${slug}`)}`,
              userId,
              tipoEmail: 'boas_vindas',
            },
          });
        }
      } catch (emailErr) {
        console.error('[AtletaFilhoForm] Erro ao enviar email de boas-vindas (não bloqueia o cadastro):', emailErr);
      }

      // Show an explicit success screen and only advance (which triggers the
      // PWA install popup upstream) once the user acknowledges it — otherwise
      // the popup covers the still-visible form and it looks like nothing happened.
      setShowSuccess(true);
    } catch (err: any) {
      console.error('Erro ao criar perfil do atleta:', err);
      toast.error(
        (err?.message || 'Erro ao criar perfil') +
        '. Se o problema persistir, entre em contato com o suporte.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="animate-fade-in text-center space-y-4 py-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Perfil criado com sucesso! 🎉</h2>
        <p className="text-sm text-muted-foreground">
          {proprio ? 'Seu perfil já está pronto.' : <>O perfil de <strong className="text-foreground">{nome.trim()}</strong> já está pronto.</>}
        </p>
        <Button className="w-full" size="lg" onClick={() => onComplete(cupomAplicado)}>
          Continuar
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-foreground">⚽ Perfil do Atleta</h1>
        <p className="text-sm text-muted-foreground mt-1">{proprio ? 'Cadastre os seus dados de atleta' : 'Cadastre os dados do seu atleta'}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          <Shield className="w-3.5 h-3.5" />
          {proprio ? 'Perfil administrado por você' : 'Perfil administrado por você (responsável)'}
        </div>
      </div>

      <form id="form-atleta" onSubmit={handleSubmit} className="space-y-4">
        {/* Nome do Atleta */}
        <div className="space-y-2">
          <Label htmlFor="nome-atleta">{proprio ? 'Seu nome *' : 'Nome do Atleta *'}</Label>
          <Input
            id="nome-atleta"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={proprio ? 'Seu nome completo' : 'Nome completo do atleta'}
            required
            maxLength={100}
          />
        </div>

        {/* Data de Nascimento */}
        <div className="space-y-2">
          <Label htmlFor="data-nascimento">Data de Nascimento *</Label>
          <Input
            id="data-nascimento"
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">{AVISO_DATA_REAL}</p>
        </div>

        {/* CPF and WhatsApp - Private fields */}
        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Lock className="w-4 h-4" />
            {proprio ? 'Seus dados de contato (não serão exibidos publicamente)' : 'Dados do responsável (não serão exibidos publicamente)'}
          </div>
          {!proprio && (
            <div className="space-y-2">
              <Label>Nome do Responsável *</Label>
              <Input
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                placeholder="Nome completo do responsável"
                maxLength={100}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>{proprio ? 'Seu CPF' : 'CPF do Responsável'}</Label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div className="space-y-2">
            <Label>{proprio ? 'Seu WhatsApp' : 'WhatsApp do Responsável'}</Label>
            <TelefoneInput value={telefoneWhatsapp} onChange={setTelefoneWhatsapp} />
          </div>
        </div>

        <VisibilidadePerfilEscolha
          value={visibilidade}
          onChange={setVisibilidade}
          ajuda={!proprio && idadeAtleta < 16 ? 'Para atletas com menos de 16 anos, escolha com cuidado: você decide quem vê o perfil.' : undefined}
        />

        {proprio && (
          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={declaraMaioridade} onCheckedChange={(v) => setDeclaraMaioridade(!!v)} className="mt-0.5" />
            <span>Declaro que tenho <strong className="text-foreground">18 anos ou mais</strong> e que as informações que informei são verdadeiras. Estou ciente de que dados falsos, como a data de nascimento, podem prejudicar o meu perfil e a minha participação em campeonatos organizados por idade. Quem tem menos de 18 anos precisa do cadastro com a autorização do responsável.</span>
          </label>
        )}

        {/* Foto */}
        <div className="space-y-2">
          <Label>Foto do Atleta</Label>
          <div className="flex items-center gap-3">
            {fotoPreview ? (
              <img src={fotoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <label className="cursor-pointer">
              <span className="text-sm text-primary hover:underline">
                {fotoPreview ? 'Trocar foto' : 'Escolher foto'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>
        </div>

        {/* Modalidade */}
        <div className="space-y-2">
          <Label>Modalidade Principal</Label>
          <Select value={modalidade} onValueChange={setModalidade}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {MODALIDADES.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Categoria */}
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* País -- lib com base real de países/estados/cidades (mesma
            usada por concorrentes); Brasil continua no seletor por IBGE
            já existente, o resto usa Estado/Cidade da própria lib. */}
        <div className="space-y-2">
          <Label>País</Label>
          <PaisSelect
            value={pais}
            onChange={(c) => {
              setPaisObj(c);
              setPais(c.nomePt);
              setEstado(''); setCidade(''); setEstadoIntlId(undefined);
            }}
          />
        </div>

        {pais === 'Brasil' ? (
          <UfCidadeSelect
            estado={estado}
            cidade={cidade}
            onEstadoChange={setEstado}
            onCidadeChange={setCidade}
            className="grid grid-cols-2 gap-3"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Estado / Região</Label>
              <StateSelect
                countryid={paisObj?.id}
                placeHolder="Selecione"
                containerClassName="w-full"
                inputClassName="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                src={GEO_DATA_BASE_URL}
                onChange={(s: any) => { setEstado(s?.name || ''); setEstadoIntlId(s?.id); setCidade(''); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <GeoCitySelect
                countryId={paisObj?.id}
                stateId={estadoIntlId}
                value={cidade}
                onChange={setCidade}
              />
            </div>
          </div>
        )}

        {/* Cupom de convite */}
        <div className="space-y-2">
          <Label>Cupom de convite (opcional)</Label>
          <Input
            value={cupomCodigo}
            onChange={(e) => setCupomCodigo(e.target.value)}
            placeholder="Ex: IGOR30"
            className="font-mono uppercase"
            maxLength={30}
          />
          <p className="text-xs text-muted-foreground">Ganhou um código de algum profissional? Digite aqui para ganhar dias extras do Elite.</p>
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Criar Perfil do Atleta
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          Dúvidas ou problemas no cadastro?{' '}
          <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Fale com o suporte via WhatsApp
          </a>
        </p>
      </form>

      <AlertDialog open={perguntaAtleta} onOpenChange={setPerguntaAtleta}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você é o próprio atleta?</AlertDialogTitle>
            <AlertDialogDescription>
              O nome do atleta é igual ao nome do responsável. Este formulário é para pai, mãe ou responsável cadastrando o atleta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                // Sou o próprio atleta: a idade decide o caminho.
                if (idadeEmAnos(dataNascimento) < 18) {
                  if (onSouMenor) onSouMenor();
                  else toast.error('Quem tem menos de 18 anos faz o cadastro com a autorização do responsável.');
                } else {
                  setModoAtual('proprio');
                  toast.info('Certo! Vamos usar o cadastro com os seus dados.');
                }
              }}
            >
              Sim, sou o atleta
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                jaConfirmouResponsavel.current = true;
                setTimeout(() => (document.getElementById('form-atleta') as HTMLFormElement | null)?.requestSubmit(), 0);
              }}
            >
              Não, sou o responsável
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
