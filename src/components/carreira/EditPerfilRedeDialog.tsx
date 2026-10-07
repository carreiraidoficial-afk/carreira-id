import { useState, useEffect, useCallback, useRef } from 'react';
import { CurriculoEditor } from '@/components/carreira/perfis/CurriculoEditor';
import {
  ehProfissionalEquipe, lerCertificacoes, lerConquistas, lerIdiomas, normalizarLinkedin,
  MAX_BIO_PROFISSIONAL, MAX_SOBRE_MIM, MAX_CERTIFICACOES, MAX_CONQUISTAS, MAX_IDIOMAS, type Certificacao, type Conquista, type IdiomaNivel,
} from '@/lib/perfil-profissional';
import { TelefoneInput } from '@/components/shared/TelefoneInput';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EquipeEscolaEditor } from '@/components/carreira/escola/EquipeEscolaEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Instagram, Trash2, Globe, Phone, Mail, Plus, Lock, Upload, Linkedin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';
import { Separator } from '@/components/ui/separator';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { formatCPF } from '@/lib/cpf-validator';
import { formatCNPJ } from '@/lib/cnpj-validator';
import { validateDocument, validatePhone as validatePhoneNumber, validateEmail as validateEmailAddress, formatPhoneMask, limparTelefone, formatPhoneInput, SUPPORT_WHATSAPP_URL } from '@/lib/form-validators';
import { ColorPicker } from './ColorPicker';
import { EscolaCompletudeCard } from './escola/EscolaCompletudeCard';
import { LinksEscolaEditor } from './escola/LinksEscolaEditor';
import { type LinkEscola, TIPOS_LINK, lerLinksEscola, normalizarUrl } from '@/lib/links-escola';

// Linha recém-adicionada e não preenchida (só o título sugerido do tipo) não conta como link.
const linkEscolaVazio = (l: LinkEscola) =>
  !l.url.trim() && (!l.titulo.trim() || l.titulo === TIPOS_LINK[l.tipo].tituloPadrao) && !l.descricao?.trim();

// ── Dynamic field definitions per profile type (mirrors ProfileTypeForm) ──

interface DynFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  options?: string[];
}

import { CATEGORIAS, MODALIDADES_ESCOLA, MODALIDADES_PROFISSIONAL } from '@/constants/esportes';
const POSICOES = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante'];

function getDynamicFields(tipo: string): DynFieldDef[] {
  switch (tipo) {
    case 'professor':
      return [
        { key: 'especialidade', label: 'Especialidade', type: 'select', options: ['Preparação Física', 'Técnico de Futebol', 'Goleiros', 'Tático', 'Coordenação Motora', 'Outro'] },
        { key: 'modalidade', label: 'Modalidade Principal', type: 'select', options: MODALIDADES_PROFISSIONAL },
        { key: 'categorias', label: 'Categorias que trabalha', type: 'multiselect', options: CATEGORIAS },
        { key: 'certificacoes', label: 'Certificações / Cursos', type: 'textarea' },
        { key: 'experiencia', label: 'Experiência Profissional', type: 'textarea' },
      ];
    case 'tecnico':
      return [
        { key: 'clube_atual', label: 'Clube / Organização Atual', type: 'text' },
        { key: 'categorias', label: 'Categorias de Interesse', type: 'multiselect', options: CATEGORIAS },
        { key: 'posicoes', label: 'Posições que mais observa', type: 'multiselect', options: POSICOES },
        { key: 'licencas', label: 'Licenças / Certificações', type: 'textarea' },
        { key: 'historico', label: 'Histórico Profissional', type: 'textarea' },
      ];
    case 'dono_escola':
      return [
        { key: 'nome_escola', label: 'Nome da Escolinha / Clube', type: 'text' },
        { key: 'endereco', label: 'Endereço da Sede', type: 'text' },
        { key: 'localizacao', label: 'Localização (Cidade, Estado)', type: 'text' },
        { key: 'ano_fundacao', label: 'Ano de fundação (ex: 2017)', type: 'text' },
        { key: 'modalidades', label: 'Modalidades Oferecidas', type: 'multiselect', options: MODALIDADES_ESCOLA },
        { key: 'categorias', label: 'Categorias Atendidas', type: 'multiselect', options: CATEGORIAS },
        { key: 'site', label: 'Site', type: 'text' },
      ];
    case 'preparador_fisico':
      return [
        { key: 'especialidade', label: 'Especialidade', type: 'select', options: ['Força', 'Resistência', 'Reabilitação', 'Funcional', 'Velocidade', 'Outro'] },
        { key: 'areas_atuacao', label: 'Áreas de Atuação', type: 'multiselect', options: ['Atletas de Base', 'Profissional', 'Amador', 'Reabilitação'] },
        { key: 'cref', label: 'CREF', type: 'text' },
        { key: 'formacao', label: 'Formação Acadêmica', type: 'textarea' },
        { key: 'certificacoes', label: 'Certificações', type: 'textarea' },
      ];
    case 'empresario':
      return [
        { key: 'empresa', label: 'Empresa / Agência', type: 'text' },
        { key: 'areas_atuacao', label: 'Áreas de Atuação', type: 'multiselect', options: ['Representação', 'Marketing Esportivo', 'Assessoria de Carreira', 'Direitos de Imagem', 'Outro'] },
        { key: 'credenciais', label: 'Credenciais / Licenças', type: 'textarea' },
        { key: 'site', label: 'Site / Contato', type: 'text' },
      ];
    case 'influenciador':
      return [
        { key: 'nicho', label: 'Nicho / Especialidade', type: 'select', options: ['Análise Tática', 'Treinos', 'Motivação', 'Bastidores', 'Humor', 'Notícias', 'Outro'] },
        { key: 'rede_principal', label: 'Principal Rede Social', type: 'select', options: ['Instagram', 'YouTube', 'TikTok', 'Twitter/X'] },
        { key: 'arroba', label: '@ da Rede Social', type: 'text' },
        { key: 'outras_redes', label: 'Outras Redes Sociais', type: 'textarea' },
      ];
    case 'jogador_profissional':
      return [
        { key: 'clube_atual', label: 'Clube Atual (ou último)', type: 'text' },
        { key: 'status_carreira', label: 'Status da Carreira', type: 'select', options: ['Ativo', 'Aposentado'] },
        { key: 'posicao', label: 'Posição', type: 'select', options: POSICOES },
        { key: 'categorias', label: 'Categorias que jogou', type: 'multiselect', options: [...CATEGORIAS, 'Seleção Brasileira'] },
        { key: 'titulos', label: 'Títulos e Conquistas', type: 'textarea' },
      ];
    case 'scout':
      return [
        { key: 'especialidade', label: 'Especialidade', type: 'select', options: ['Futebol de Base', 'Profissional', 'Internacional', 'Feminino', 'Outro'] },
        { key: 'regioes', label: 'Regiões de Atuação', type: 'text' },
        { key: 'clubes_anteriores', label: 'Clubes com quem já trabalhou', type: 'textarea' },
        { key: 'categorias', label: 'Categorias de Interesse', type: 'multiselect', options: CATEGORIAS },
        { key: 'posicoes', label: 'Posições que mais busca', type: 'multiselect', options: POSICOES },
      ];
    case 'agente_clube':
      return [
        { key: 'clube', label: 'Qual clube você representa?', type: 'text' },
        { key: 'categorias', label: 'Categorias que observa', type: 'multiselect', options: CATEGORIAS },
        { key: 'posicoes', label: 'Posições de Interesse', type: 'multiselect', options: POSICOES },
        { key: 'tempo_clube', label: 'Tempo no Clube', type: 'text' },
        { key: 'contato', label: 'Contato Profissional', type: 'text' },
      ];
    case 'fotografo':
      return [
        { key: 'especialidade', label: 'Especialidade', type: 'select', options: ['Esportes', 'Eventos Esportivos', 'Retratos de Atletas', 'Cobertura de Campeonatos', 'Outro'] },
        { key: 'regiao', label: 'Região de Atuação', type: 'text' },
        { key: 'portfolio', label: 'Portfólio (link)', type: 'text' },
        { key: 'site_whatsapp', label: 'Site / WhatsApp', type: 'text' },
      ];
    default:
      return [];
  }
}

// ── Form schema (base fields) ──

const formSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  bio: z.string().max(500, 'Máximo de 500 caracteres').optional(),
  instagram: z.string().max(200).optional(),
  site: z.string().max(200).optional(),
  whatsapp_publico: z.boolean().optional(),
  telefone_whatsapp: z.string().max(20).optional(),
  cpf_cnpj: z.string().max(20).optional(),
  tipo_documento: z.enum(['cpf', 'cnpj']).optional(),
  time_torcida: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Unidade {
  nome: string;
  endereco: string;
  bairro: string;
  referencia: string;
  /** Link do Google Maps da unidade (opcional); tem prioridade sobre referência/endereço no mapa. */
  link_mapa?: string;
  logo_url?: string | null;
  // Campos so-de-formulario -- viram logo_url apos upload no submit.
  logoFile?: File | null;
  logoPreview?: string | null;
}

interface EditPerfilRedeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  perfil: any;
}

const formatPhone = formatPhoneInput;

type AbaId = 'escola' | 'links' | 'equipe' | 'curriculo' | 'conta';
const ABAS_ESCOLA: { id: AbaId; rotulo: string }[] = [
  { id: 'escola', rotulo: 'Escola' },
  { id: 'links', rotulo: 'Links e unidades' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'conta', rotulo: 'Conta' },
];
const ABAS_PROFISSIONAL: { id: AbaId; rotulo: string }[] = [
  { id: 'escola', rotulo: 'Perfil' },
  { id: 'curriculo', rotulo: 'Currículo' },
  { id: 'conta', rotulo: 'Conta' },
];

/** Só a escola usa abas. As abas escondem os campos mas não os desmontam: o formulário continua
 * um só e "Salvar Alterações" grava tudo de uma vez. Nos outros tipos de perfil tudo aparece como antes. */
function Aba({ id, atual, ativo, children }: { id: AbaId; atual: AbaId; ativo: boolean; children: React.ReactNode }) {
  if (!ativo) return <>{children}</>;
  return <div hidden={atual !== id} className="space-y-4">{children}</div>;
}

const formatDoc = (value: string, tipo: 'cpf' | 'cnpj') => {
  return tipo === 'cnpj' ? formatCNPJ(value) : formatCPF(value);
};

export function EditPerfilRedeDialog({ open, onOpenChange, perfil }: EditPerfilRedeDialogProps) {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(perfil?.foto_url || '');
  const [bannerUrl, setBannerUrl] = useState(perfil?.banner_url || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [corDestaque, setCorDestaque] = useState((perfil?.dados_perfil as any)?.cor_destaque || '#3b82f6');
  const [disponivelTrabalho, setDisponivelTrabalho] = useState<boolean>(!!(perfil?.dados_perfil as any)?.disponivel_trabalho);

  // Account fields (from profiles table)
  const [contaEmail, setContaEmail] = useState('');
  const [contaTelefone, setContaTelefone] = useState('');
  const [loadingConta, setLoadingConta] = useState(false);

  // Brasão for torcedor
  const [brasaoUrl, setBrasaoUrl] = useState('');
  const [brasaoUploading, setBrasaoUploading] = useState(false);

  // Dynamic dados_perfil values
  const [dadosValues, setDadosValues] = useState<Record<string, string | string[]>>({});

  // Fallback to direct Supabase auth for Carreira-only users
  const sessionUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) sessionUserIdRef.current = session.user.id;
    });
  }, []);
  const getEffectiveUserId = () => user?.id || sessionUserIdRef.current;

  // Unidades (filiais) for dono_escola
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  // Links da escola (matrícula, planos, aula experimental...) for dono_escola
  const [linksEscola, setLinksEscola] = useState<LinkEscola[]>([]);
  // Currículo do profissional (vai pra dados_perfil junto com o resto, em "Salvar Alterações")
  const [tituloProf, setTituloProf] = useState('');
  const [sobreMimProf, setSobreMimProf] = useState('');
  const [linkedinProf, setLinkedinProf] = useState('');
  const [certificacoesProf, setCertificacoesProf] = useState<Certificacao[]>([]);
  const [idiomasProf, setIdiomasProf] = useState<IdiomaNivel[]>([]);
  const [conquistasProf, setConquistasProf] = useState<Conquista[]>([]);

  const isTorcedor = perfil?.tipo === 'torcedor';
  const isDono = perfil?.tipo === 'dono_escola';
  // Escola e profissional (professor/técnico/preparador) usam abas; os demais tipos seguem em coluna única.
  const ehProf = ehProfissionalEquipe(perfil?.tipo);
  const usaAbas = isDono || ehProf;
  const abasDisponiveis = isDono ? ABAS_ESCOLA : ABAS_PROFISSIONAL;
  const [aba, setAba] = useState<AbaId>('escola');
  useEffect(() => {
    if (open) setAba('escola');
  }, [open]);
  const tipo = perfil?.tipo || '';

  const dados = (perfil?.dados_perfil || {}) as Record<string, any>;
  const dynamicFields = getDynamicFields(tipo);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: perfil?.nome || '',
      bio: perfil?.bio || '',
      instagram: perfil?.instagram || '',
      site: perfil?.site || '',
      whatsapp_publico: perfil?.whatsapp_publico || false,
      telefone_whatsapp: formatPhone(String(perfil?.telefone_whatsapp || '')),
      cpf_cnpj: '',
      tipo_documento: perfil?.tipo_documento === 'cnpj' ? 'cnpj' : 'cpf',
      time_torcida: dados.time_torcida || '',
    },
  });

  const tipoDoc = form.watch('tipo_documento') || 'cpf';

  // Load dados_perfil values into dynamic state
  const loadDadosValues = useCallback((d: Record<string, any>) => {
    const vals: Record<string, string | string[]> = {};
    for (const field of getDynamicFields(tipo)) {
      const val = d[field.key];
      if (val !== undefined && val !== null) {
        vals[field.key] = val;
      }
    }
    setDadosValues(vals);
  }, [tipo]);

  useEffect(() => {
    if (open && perfil) {
      const d = (perfil.dados_perfil || {}) as Record<string, any>;
      const rawDoc = String(perfil.cpf_cnpj || '').replace(/\D/g, '');
      const docTipo = perfil.tipo_documento === 'cnpj' ? 'cnpj' as const : 'cpf' as const;
      form.reset({
        nome: perfil.nome || '',
        bio: perfil.bio || '',
        instagram: perfil.instagram || '',
        site: perfil.site || '',
        whatsapp_publico: perfil.whatsapp_publico || false,
        telefone_whatsapp: formatPhone(String(perfil.telefone_whatsapp || '')),
        cpf_cnpj: rawDoc ? formatDoc(rawDoc, docTipo) : '',
        tipo_documento: docTipo,
        time_torcida: d.time_torcida || '',
      });
      setPhotoUrl(perfil.foto_url || '');
      setBannerUrl(perfil.banner_url || '');
      setCorDestaque(d.cor_destaque || '#3b82f6');
      setDisponivelTrabalho(!!d.disponivel_trabalho);
      setBrasaoUrl(d.brasao_url || '');
      setUnidades(Array.isArray(d.unidades)
        ? d.unidades.map((u: Unidade) => ({ ...u, logoPreview: u.logo_url || null }))
        : []);
      setLinksEscola(lerLinksEscola(d));
      setTituloProf(String(d.titulo_profissional || ''));
      // Bio antiga e longa: o texto completo vai para "Sobre mim" (nada se perde) e a Bio fica para resumir.
      const bioAntiga = String(perfil.bio || '');
      setSobreMimProf(
        d.sobre_mim ? String(d.sobre_mim)
          : (ehProf && bioAntiga.length > MAX_BIO_PROFISSIONAL ? bioAntiga.slice(0, MAX_SOBRE_MIM) : ''),
      );
      setLinkedinProf(String(d.linkedin || ''));
      setCertificacoesProf(lerCertificacoes(d));
      setIdiomasProf(lerIdiomas(d));
      setConquistasProf(lerConquistas(d));
      loadDadosValues(d);

      // Load account data
      if (user) {
        setLoadingConta(true);
        supabase
          .from('profiles')
          .select('email, telefone')
          .eq('user_id', user.id)
          .single()
          .then(({ data: profileData }) => {
            if (profileData) {
              setContaEmail(profileData.email || '');
              setContaTelefone(profileData.telefone || '');
            }
            setLoadingConta(false);
          });
      }
    }
  }, [open, perfil, form, user, loadDadosValues]);

  const setDynValue = (key: string, value: string | string[]) => {
    setDadosValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDynMulti = (key: string, option: string) => {
    const current = (Array.isArray(dadosValues[key]) ? dadosValues[key] : []) as string[];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setDynValue(key, next);
  };

  const addUnidade = useCallback(() => {
    if (unidades.length < 5) setUnidades(prev => [...prev, { nome: '', endereco: '', bairro: '', referencia: '', logo_url: null, logoFile: null, logoPreview: null }]);
  }, [unidades.length]);

  const removeUnidade = useCallback((idx: number) => {
    setUnidades(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const updateUnidade = useCallback((idx: number, field: keyof Unidade, value: string) => {
    setUnidades(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  }, []);

  const handleUnidadeLogoChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUnidades(prev => prev.map((u, i) => i === idx ? { ...u, logoFile: file, logoPreview: reader.result as string } : u));
    };
    reader.readAsDataURL(file);
  };

  const handleBrasaoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const effectiveId = getEffectiveUserId();
    if (!file || !effectiveId) {
      if (!effectiveId) toast.error('Você precisa estar logado para enviar o brasão');
      return;
    }
    setBrasaoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${effectiveId}/brasao-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('atleta-fotos')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('atleta-fotos').getPublicUrl(path);
      setBrasaoUrl(urlData.publicUrl);
      toast.success('Brasão enviado!');
    } catch (err: any) {
      toast.error('Erro ao enviar brasão: ' + err.message);
    } finally {
      setBrasaoUploading(false);
    }
  };

  // Erro de validação num campo de aba escondida seria silencioso: abre a aba certa.
  // Campos de texto antigos (certificações e experiência) saem do editor quando a lista estruturada que os
  // substitui existe: senão haveria dois lugares para o mesmo dado. O texto antigo continua guardado.
  const temHistoricoEstruturado = Array.isArray(dados.historico_profissional) && dados.historico_profissional.length > 0;
  const textoSubstituido = (chave: string) =>
    ehProf && (
      (['certificacoes', 'licencas', 'formacao'].includes(chave) && certificacoesProf.length > 0) ||
      (['experiencia', 'historico'].includes(chave) && temHistoricoEstruturado)
    );

  const onInvalid = (erros: Record<string, unknown>) => {
    const chaves = Object.keys(erros);
    setAba(chaves.some((k) => k === 'cpf_cnpj' || k === 'tipo_documento') ? 'conta' : 'escola');
    toast.error('Confira os campos destacados.');
  };

  const onSubmit = async (data: FormData) => {
    // Validate document if provided
    const cleanDoc = (data.cpf_cnpj || '').replace(/\D/g, '');
    if (cleanDoc) {
      const docTipo = (data.tipo_documento || 'cpf') as 'cpf' | 'cnpj';
      if (!validateDocument(cleanDoc, docTipo)) {
        setAba('conta');
        toast.error(`${docTipo === 'cnpj' ? 'CNPJ' : 'CPF'} inválido. Verifique os números digitados.`);
        return;
      }
    }
    // Validate phone if provided
    const cleanPhone = limparTelefone(data.telefone_whatsapp || '');
    if (cleanPhone && !validatePhoneNumber(cleanPhone)) {
      setAba('escola');
      toast.error('Número de WhatsApp inválido. Use um número real com DDD.');
      return;
    }
    // Validate email if changed
    if (contaEmail.trim() && !validateEmailAddress(contaEmail.trim())) {
      setAba('conta');
      toast.error('Email inválido. Verifique o endereço digitado.');
      return;
    }

    // Link do Google Maps das unidades: se preenchido, precisa ser um endereço válido.
    if (isDono && unidades.some((u) => u.link_mapa?.trim() && !normalizarUrl(u.link_mapa))) {
      setAba('links');
      toast.error('Confira o link do Google Maps das unidades: precisa ser um endereço começando com https://');
      return;
    }

    // Links da escola: linha preenchida pela metade ou com endereço inválido trava o salvar.
    if (isDono) {
      for (const l of linksEscola) {
        if (linkEscolaVazio(l)) continue;
        if (!l.titulo.trim() || !normalizarUrl(l.url)) {
          setAba('links');
          toast.error('Confira os links da escola: cada um precisa de título e de um endereço começando com https://');
          return;
        }
      }
    }

    // Bio curta do profissional: o texto longo mora em "Sobre mim".
    if (ehProf && (data.bio || '').length > MAX_BIO_PROFISSIONAL) {
      setAba('escola');
      toast.error(`A bio aceita até ${MAX_BIO_PROFISSIONAL} caracteres. Resuma e deixe o texto longo em "Sobre mim".`);
      return;
    }

    // LinkedIn do profissional: se preenchido, precisa ser um endereço do LinkedIn.
    if (ehProf && normalizarLinkedin(linkedinProf) === null) {
      setAba('escola');
      toast.error('Confira o link do LinkedIn: use o endereço do seu perfil (linkedin.com/in/...).');
      return;
    }

    setSaving(true);
    try {

      // Build new dados_perfil preserving existing keys and updating dynamic fields
      const newDados: Record<string, any> = {
        ...dados,
        cor_destaque: corDestaque,
        disponivel_trabalho: disponivelTrabalho,
      };

      // Merge all dynamic field values into dados_perfil
      for (const field of dynamicFields) {
        const val = dadosValues[field.key];
        if (val !== undefined) {
          newDados[field.key] = val;
        }
      }

      // Currículo do profissional: valor vazio apaga a chave (em vez de gravar lista/texto vazio).
      if (ehProf) {
        const definir = (chave: string, valor: string | unknown[]) => {
          if (typeof valor === 'string' ? valor === '' : valor.length === 0) delete newDados[chave];
          else newDados[chave] = valor;
        };
        definir('titulo_profissional', tituloProf.trim().slice(0, 80));
        definir('sobre_mim', sobreMimProf.trim().slice(0, MAX_SOBRE_MIM));
        definir('linkedin', normalizarLinkedin(linkedinProf) || '');
        definir('certificacoes_lista', certificacoesProf
          .map((c) => ({ titulo: c.titulo.trim().slice(0, 100), instituicao: c.instituicao.trim().slice(0, 100), status: c.status }))
          .filter((c) => c.titulo).slice(0, MAX_CERTIFICACOES));
        definir('idiomas', idiomasProf
          .map((i) => ({ idioma: i.idioma.trim().slice(0, 30), nivel: i.nivel }))
          .filter((i) => i.idioma).slice(0, MAX_IDIOMAS));
        definir('conquistas', conquistasProf
          .map((c) => ({ titulo: c.titulo.trim().slice(0, 100), descricao: c.descricao.trim().slice(0, 120), ano: /^\d{4}$/.test(c.ano) ? c.ano : '', tipo: c.tipo }))
          .filter((c) => c.titulo).slice(0, MAX_CONQUISTAS));
      }

      // Torcedor-specific fields
      if (isTorcedor) {
        newDados.time_torcida = data.time_torcida || null;
        newDados.brasao_url = brasaoUrl || null;
      }

      if (isDono) {
        newDados.links = linksEscola
          .filter((l) => !linkEscolaVazio(l))
          .map((l) => ({
            titulo: l.titulo.trim(),
            url: normalizarUrl(l.url)!,
            tipo: l.tipo,
            ...(l.descricao?.trim() ? { descricao: l.descricao.trim() } : {}),
          }));
      }

      // Unidades for dono_escola -- a logo de cada unidade e so capturada
      // aqui (logo_url), ainda sem nenhuma tela que a exiba (fica pronta pra
      // quando a "Comunidade da Escola" for retomada).
      if (isDono) {
        const validUnidades = unidades.filter(u => u.nome.trim() || u.bairro.trim());
        const effectiveId = getEffectiveUserId();
        newDados.unidades = await Promise.all(validUnidades.map(async (u, idx) => {
          let logoUrl = u.logo_url || null;
          if (u.logoFile && effectiveId) {
            const ext = u.logoFile.name.split('.').pop();
            const path = `${effectiveId}/unidade-logo-${Date.now()}-${idx}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('atleta-fotos')
              .upload(path, u.logoFile, { upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('atleta-fotos').getPublicUrl(path);
              logoUrl = urlData.publicUrl;
            }
          }
          const linkMapa = u.link_mapa?.trim() ? normalizarUrl(u.link_mapa) : null;
          return { nome: u.nome, endereco: u.endereco, bairro: u.bairro, referencia: u.referencia, ...(linkMapa ? { link_mapa: linkMapa } : {}), logo_url: logoUrl };
        }));
      }

      const { error } = await supabase
        .from('perfis_rede')
        .update({
          nome: data.nome,
          bio: data.bio || null,
          instagram: data.instagram || null,
          site: data.site || null,
          whatsapp_publico: data.whatsapp_publico || false,
          telefone_whatsapp: cleanPhone || null,
          cpf_cnpj: cleanDoc || null,
          tipo_documento: data.tipo_documento || 'cpf',
          foto_url: photoUrl || null,
          ...(isDono ? { banner_url: bannerUrl || null } : {}),
          dados_perfil: newDados,
        } as any)
        .eq('id', perfil.id);

      if (error) throw error;

      // Update account data (profiles table)
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            nome: data.nome.trim(),
            telefone: contaTelefone.trim() || null,
          })
          .eq('user_id', user.id);

        if (profileError) console.error('Erro ao atualizar profile:', profileError);

        // Update email if changed
        if (contaEmail.trim() && contaEmail.trim() !== user.email) {
          const { error: emailError } = await supabase.auth.updateUser({ email: contaEmail.trim() });
          if (emailError) {
            toast.error('Erro ao atualizar email: ' + emailError.message);
          } else {
            toast.info('Um email de confirmação foi enviado para o novo endereço');
          }
        }

        await refreshUser();
      }

      toast.success('Perfil atualizado!');
      queryClient.invalidateQueries({ queryKey: ['perfil-rede'] });
      queryClient.invalidateQueries({ queryKey: ['meu-perfil-rede'] });
      queryClient.invalidateQueries({ queryKey: ['carreira-profile-by-slug'] });
      if (perfil?.slug) {
        queryClient.invalidateQueries({ queryKey: ['carreira-profile-by-slug', perfil.slug] });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const canUseCnpj = ['dono_escola', 'empresario'].includes(perfil?.tipo || '');

  // ── Render a single dynamic field ──
  const renderDynField = (field: DynFieldDef) => {
    const val = dadosValues[field.key];

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-sm">{field.label}</Label>
          <Select value={(val as string) || ''} onValueChange={(v) => setDynValue(field.key, v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === 'multiselect' && field.options) {
      const selected = Array.isArray(val) ? val : [];
      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-sm">{field.label}</Label>
          <div className="flex flex-wrap gap-1.5">
            {field.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => toggleDynMulti(field.key, opt)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  selected.includes(opt)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className="space-y-2">
          <Label className="text-sm">{field.label}</Label>
          <Textarea
            value={(val as string) || ''}
            onChange={(e) => setDynValue(field.key, e.target.value)}
            rows={3}
          />
        </div>
      );
    }

    // text
    return (
      <div key={field.key} className="space-y-2">
        <Label className="text-sm">{field.label}</Label>
        <Input
          value={(val as string) || ''}
          onChange={(e) => setDynValue(field.key, e.target.value)}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Perfil e Conta</DialogTitle>
        </DialogHeader>

        {usaAbas && (
          <div role="tablist" aria-label="Seções do perfil" className={`grid gap-1 rounded-lg bg-muted p-1 ${abasDisponiveis.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {abasDisponiveis.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={aba === t.id}
                onClick={() => setAba(t.id)}
                className={`rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors ${
                  aba === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
        )}

        {isDono && perfil && aba === 'escola' && (
          <EscolaCompletudeCard
            perfil={{ ...perfil, foto_url: photoUrl || null, banner_url: bannerUrl || null }}
            accentColor={corDestaque}
          />
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            <Aba id="escola" atual={aba} ativo={usaAbas}>
            <ProfilePhotoUpload
              currentPhotoUrl={photoUrl}
              currentBannerUrl={bannerUrl}
              onPhotoChange={setPhotoUrl}
              onBannerChange={setBannerUrl}
              showBanner={isDono}
              photoLabel={isDono ? 'Foto do Perfil (você ou a logo da escola)' : undefined}
              photoHelperText={isDono ? 'Você escolhe: sua própria foto ou a logo da escola — o que subir aqui aparece publicamente no perfil, no selo de Escola Parceira e na seção Escolas Parceiras da home.' : undefined}
            />
            </Aba>

            <Aba id="links" atual={aba} ativo={usaAbas}>
            {/* Links da escola (acesso rápido) - only for dono_escola */}
            {isDono && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <Label className="text-sm font-medium">Links de acesso rápido da escola</Label>
                <LinksEscolaEditor links={linksEscola} onChange={setLinksEscola} />
              </div>
            )}
            </Aba>

            <Aba id="escola" atual={aba} ativo={usaAbas}>
            {/* Color picker */}
            <ColorPicker value={corDestaque} onChange={setCorDestaque} />

            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl><Input placeholder="Seu nome" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {ehProf && (
              <div className="space-y-1.5">
                <Label>Título profissional</Label>
                <Input
                  value={tituloProf}
                  maxLength={80}
                  onChange={(e) => setTituloProf(e.target.value)}
                  placeholder="Ex.: Professor de Vôlei de Praia"
                />
                <p className="text-xs text-muted-foreground">Aparece sob o seu nome, como o título do LinkedIn. Em branco, o app monta um pelo tipo e modalidade.</p>
              </div>
            )}

            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem>
                <FormLabel>{ehProf ? 'Bio (curta, como no Instagram)' : 'Bio'}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={ehProf ? 'Ex.: Mais de 30 anos como treinador de vôlei de praia no Brasil e no exterior.' : 'Fale sobre você...'}
                    rows={ehProf ? 2 : 3}
                    {...field}
                  />
                </FormControl>
                {ehProf && (
                  <p className={`text-xs ${(field.value || '').length > MAX_BIO_PROFISSIONAL ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {(field.value || '').length > MAX_BIO_PROFISSIONAL
                      ? `Sua bio tem ${(field.value || '').length} caracteres (máximo ${MAX_BIO_PROFISSIONAL}). O texto completo foi copiado para "Sobre mim": resuma aqui.`
                      : `${(field.value || '').length}/${MAX_BIO_PROFISSIONAL} · Uma ou duas linhas que resumem quem você é. O texto longo vai em "Sobre mim".`}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {ehProf && (
              <div className="space-y-1.5">
                <Label>Sobre mim</Label>
                <Textarea
                  value={sobreMimProf}
                  maxLength={MAX_SOBRE_MIM}
                  rows={6}
                  onChange={(e) => setSobreMimProf(e.target.value)}
                  placeholder="Conte sua trajetória com mais detalhe: formação, experiências, filosofia de trabalho..."
                />
                <p className="text-xs text-muted-foreground">
                  {sobreMimProf.length}/{MAX_SOBRE_MIM} · Aparece no cartão "Sobre mim" da sua página, como a seção "Sobre" do LinkedIn.
                </p>
              </div>
            )}


            {/* Torcedor-specific: time and brasão */}
            {isTorcedor && (
              <>
                <FormField control={form.control} name="time_torcida" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time do Coração *</FormLabel>
                    <FormControl><Input placeholder="Ex: Flamengo" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-2">
                  <Label>Brasão do Time</Label>
                  <div className="flex items-center gap-3">
                    {brasaoUrl ? (
                      <img src={brasaoUrl} alt="Brasão" className="w-16 h-16 object-contain rounded border border-border bg-white p-0.5" />
                    ) : (
                      <div className="w-16 h-16 rounded border border-dashed border-border bg-muted flex items-center justify-center">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <label className="cursor-pointer">
                      <span className="text-sm text-primary hover:underline">
                        {brasaoUploading ? 'Enviando...' : brasaoUrl ? 'Trocar brasão' : 'Enviar brasão'}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleBrasaoUpload} disabled={brasaoUploading} />
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Contact & Social - show for all but simplified for torcedor */}
            {!isTorcedor && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Redes e contato</p>
                <FormField control={form.control} name="instagram" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><Instagram className="w-4 h-4" /> Instagram</FormLabel>
                    <FormControl><Input placeholder="@usuario" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="site" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> Site</FormLabel>
                    <FormControl><Input placeholder="https://seusite.com.br" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {ehProf && (
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-sm font-medium"><Linkedin className="w-4 h-4" /> LinkedIn</Label>
                    <Input
                      value={linkedinProf}
                      onChange={(e) => setLinkedinProf(e.target.value)}
                      placeholder="linkedin.com/in/seu-perfil"
                      inputMode="url"
                    />
                    {linkedinProf.trim() && normalizarLinkedin(linkedinProf) === null && (
                      <p className="text-[11px] text-destructive">Use o endereço do seu perfil no LinkedIn (linkedin.com/in/...).</p>
                    )}
                  </div>
                )}

                <FormField control={form.control} name="telefone_whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> WhatsApp</FormLabel>
                    <FormControl>
                      <TelefoneInput value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="whatsapp_publico" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value ?? false}
                        onChange={field.onChange}
                        className="rounded border-border"
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer text-sm">
                      Exibir WhatsApp publicamente
                    </FormLabel>
                  </FormItem>
                )} />
              </div>
            )}

            {/* Disponível para oportunidades — estilo "Open to Work" do LinkedIn */}
            {!['pai_responsavel', 'torcedor', 'influenciador', 'atleta_filho'].includes(tipo) && (
              <div className="rounded-lg border border-border p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="disponivel-trabalho"
                    checked={disponivelTrabalho}
                    onChange={(e) => setDisponivelTrabalho(e.target.checked)}
                    className="rounded border-border"
                  />
                  <Label htmlFor="disponivel-trabalho" className="font-normal cursor-pointer text-sm">
                    Disponível para oportunidades de trabalho
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mostra um selo no seu perfil sinalizando que você está aberto a propostas — igual ao "Open to Work" do LinkedIn.
                </p>
              </div>
            )}

            </Aba>

            <Aba id="conta" atual={aba} ativo={usaAbas}>
            {/* Dados Privados */}
            <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Lock className="w-4 h-4" />
                Dados da conta (privados)
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm"><Mail className="w-4 h-4" /> E-mail</Label>
                <Input
                  type="email"
                  value={contaEmail}
                  onChange={(e) => setContaEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={loadingConta}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm"><Phone className="w-4 h-4" /> Telefone da conta</Label>
                <Input
                  value={contaTelefone}
                  onChange={(e) => setContaTelefone(formatPhone(e.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  disabled={loadingConta}
                />
              </div>

              {canUseCnpj && (
                <div className="space-y-2">
                  <Label className="text-sm">Tipo de documento</Label>
                  <Select value={tipoDoc} onValueChange={(value) => {
                    form.setValue('tipo_documento', value as 'cpf' | 'cnpj');
                    form.setValue('cpf_cnpj', '');
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <FormField control={form.control} name="cpf_cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>{tipoDoc === 'cnpj' ? 'CNPJ' : 'CPF'}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={tipoDoc === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(formatDoc(e.target.value, tipoDoc as 'cpf' | 'cnpj'))}
                      maxLength={tipoDoc === 'cnpj' ? 18 : 14}
                    />
                  </FormControl>
                </FormItem>
              )} />
            </div>

            </Aba>

            <Aba id="escola" atual={aba} ativo={usaAbas}>
            {/* ── Dynamic profile-type-specific fields ── */}
            {dynamicFields.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <p className="text-sm font-medium text-foreground">Informações do perfil</p>
                {dynamicFields.filter((f) => !textoSubstituido(f.key)).map(renderDynField)}
              </div>
            )}

            </Aba>

            <Aba id="links" atual={aba} ativo={usaAbas}>
            {/* Unidades (filiais) - only for dono_escola */}
            {isDono && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Filiais / Unidades</Label>
                  {unidades.length < 5 && (
                    <Button type="button" variant="outline" size="sm" onClick={addUnidade} className="gap-1 h-7 text-xs">
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Adicione unidades da sua escolinha (ex: filiais em diferentes bairros)
                </p>
                {unidades.map((unidade, idx) => (
                  <div key={idx} className="space-y-2 rounded-md border border-border/60 p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Unidade {idx + 1}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeUnidade(idx)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Input value={unidade.nome} onChange={(e) => updateUnidade(idx, 'nome', e.target.value)} placeholder="Nome (ex: Unidade Tijuca)" maxLength={100} />
                    <Input value={unidade.endereco || ''} onChange={(e) => updateUnidade(idx, 'endereco', e.target.value)} placeholder="Endereço (ex: Rua das Flores, 123)" maxLength={200} />
                    <Input value={unidade.bairro} onChange={(e) => updateUnidade(idx, 'bairro', e.target.value)} placeholder="Bairro" maxLength={100} />
                    <Input value={unidade.referencia} onChange={(e) => updateUnidade(idx, 'referencia', e.target.value)} placeholder="Referência / local no mapa (ex: Praça Central)" maxLength={200} />
                    <Input value={unidade.link_mapa || ''} onChange={(e) => updateUnidade(idx, 'link_mapa', e.target.value)} placeholder="Link do Google Maps (opcional)" inputMode="url" maxLength={500} />
                    {!!unidade.link_mapa?.trim() && !normalizarUrl(unidade.link_mapa) && (
                      <p className="text-[11px] text-destructive">Link inválido. Cole o endereço completo, começando com https://</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      {unidade.logoPreview ? (
                        <img src={unidade.logoPreview} alt="Logo da unidade" className="w-10 h-10 rounded object-cover border border-border" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <span className="text-xs text-primary hover:underline">
                          {unidade.logoPreview ? 'Trocar logo desta unidade' : 'Logo desta unidade (opcional)'}
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUnidadeLogoChange(idx, e)} />
                      </label>
                    </div>
                  </div>
                ))}
                {unidades.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Nenhuma unidade adicionada</p>
                )}
              </div>
            )}

            </Aba>

            <Aba id="equipe" atual={aba} ativo={usaAbas}>
            {isDono && perfil?.id && <EquipeEscolaEditor escolaPerfilId={perfil.id} />}
            </Aba>

            <Aba id="curriculo" atual={aba} ativo={usaAbas}>
            {ehProf && (
              <CurriculoEditor
                certificacoes={certificacoesProf}
                onCertificacoes={setCertificacoesProf}
                idiomas={idiomasProf}
                onIdiomas={setIdiomasProf}
                conquistas={conquistasProf}
                onConquistas={setConquistasProf}
              />
            )}
            </Aba>

            <div className={usaAbas ? 'sticky bottom-0 z-10 -mx-6 -mb-6 flex justify-end gap-2 border-t bg-background px-6 pb-6 pt-3' : 'flex gap-2 justify-end pt-4'}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar Alterações'}
              </Button>
            </div>

            <Aba id="conta" atual={aba} ativo={usaAbas}>
            <Separator className="my-4" />
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar minha conta
              </Button>
            </div>
            </Aba>
          </form>
        </Form>

        <DeleteAccountDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          perfilId={perfil?.id}
          perfilTable="perfis_rede"
        />
      </DialogContent>
    </Dialog>
  );
}
