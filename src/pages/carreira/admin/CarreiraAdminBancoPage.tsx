import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, RefreshCw, CheckCircle2, Clock, AlertTriangle, Landmark } from 'lucide-react';
import DocumentUploadCarreira from '@/components/carreira/admin/DocumentUploadCarreira';

const INCOME_RANGES = [
  { value: '1000', label: 'Até R$ 1.000', num: 1000 },
  { value: '5000', label: 'R$ 1.001 a R$ 5.000', num: 5000 },
  { value: '10000', label: 'R$ 5.001 a R$ 10.000', num: 10000 },
  { value: '50000', label: 'R$ 10.001 a R$ 50.000', num: 50000 },
  { value: '100000', label: 'Acima de R$ 50.000', num: 100000 },
];

const schema = z.object({
  tipoPessoa: z.enum(['cpf', 'cnpj']),
  nome: z.string().min(3, 'Nome obrigatório'),
  cpfCnpj: z.string().min(11, 'CPF/CNPJ obrigatório'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(1, 'Telefone obrigatório'),
  dataNascimento: z.string().optional(),
  incomeValue: z.string().min(1, 'Faturamento obrigatório'),
  cep: z.string().min(1, 'CEP obrigatório'),
  rua: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().min(1),
  banco: z.string().min(1, 'Código do banco (ex: 001, 237, 336)'),
  agencia: z.string().min(1),
  conta: z.string().min(1),
  tipoConta: z.enum(['corrente', 'poupanca']),
});
type FormData = z.infer<typeof schema>;

function StatusPill({ status }: { status: string | null | undefined }) {
  const map: Record<string, { label: string; icon: any; cls: string }> = {
    approved: { label: 'Aprovado', icon: CheckCircle2, cls: 'text-green-500' },
    pending: { label: 'Em análise', icon: Clock, cls: 'text-yellow-500' },
    pending_approval: { label: 'Aguardando aprovação', icon: Clock, cls: 'text-yellow-500' },
    awaiting_action: { label: 'Ação necessária', icon: AlertTriangle, cls: 'text-orange-500' },
    rejected: { label: 'Rejeitado', icon: AlertTriangle, cls: 'text-destructive' },
  };
  const s = status ? map[status] : null;
  if (!s) return <span className="text-muted-foreground text-sm">Não enviado</span>;
  const Icon = s.icon;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${s.cls}`}>
      <Icon className="w-4 h-4" /> {s.label}
    </span>
  );
}

async function extractFunctionError(error: unknown, fallback = 'Erro ao executar função') {
  const context = (error as any)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      return payload?.error || payload?.message || fallback;
    } catch {
      try {
        const text = await context.clone().text();
        return text || fallback;
      } catch {
        return fallback;
      }
    }
  }
  return (error as Error)?.message || fallback;
}

export default function CarreiraAdminBancoPage() {
  const qc = useQueryClient();
  const [submitFeedback, setSubmitFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const { data: cadastro, isLoading } = useQuery({
    queryKey: ['carreira-cadastro-bancario'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_cadastro_bancario')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  // Sugestão: dados da escola raiz Atleta ID para pré-preencher
  const { data: atletaBase } = useQuery({
    queryKey: ['carreira-atleta-base'],
    queryFn: async () => {
      const { data } = await supabase
        .from('escola_cadastro_bancario')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !cadastro,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ['carreira-documentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('carreira_documentos').select('id, tipo_documento, nome_arquivo');
      if (error) throw error;
      return data as Array<{ id: string; tipo_documento: string; nome_arquivo: string }>;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoPessoa: 'cnpj',
      nome: '',
      cpfCnpj: '',
      email: 'contato@carreiraid.com.br',
      telefone: '21969622045',
      dataNascimento: '',
      incomeValue: '',
      cep: '',
      rua: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      banco: '',
      agencia: '',
      conta: '',
      tipoConta: 'corrente',
    },
  });

  useEffect(() => {
    if (cadastro) {
      const inc = INCOME_RANGES.find((r) => r.num === cadastro.income_value)?.value ?? '';
      form.reset({
        tipoPessoa: cadastro.tipo_pessoa,
        nome: cadastro.nome,
        cpfCnpj: cadastro.cpf_cnpj ?? '',
        email: cadastro.email,
        telefone: cadastro.telefone ?? '',
        dataNascimento: cadastro.data_nascimento ?? '',
        incomeValue: inc,
        cep: cadastro.cep ?? '',
        rua: cadastro.rua ?? '',
        numero: cadastro.numero ?? '',
        complemento: cadastro.complemento ?? '',
        bairro: cadastro.bairro ?? '',
        cidade: cadastro.cidade ?? '',
        estado: cadastro.estado ?? '',
        banco: cadastro.banco,
        agencia: cadastro.agencia,
        conta: cadastro.conta,
        tipoConta: cadastro.tipo_conta,
      });
    } else if (atletaBase) {
      const inc = INCOME_RANGES.find((r) => r.num === atletaBase.income_value)?.value ?? '';
      form.reset({
        tipoPessoa: 'cnpj',
        nome: atletaBase.nome ?? '',
        cpfCnpj: '',
        email: 'contato@carreiraid.com.br',
        telefone: '21969622045',
        dataNascimento: '',
        incomeValue: inc,
        cep: atletaBase.cep ?? '',
        rua: atletaBase.rua ?? '',
        numero: atletaBase.numero ?? '',
        complemento: atletaBase.complemento ?? '',
        bairro: atletaBase.bairro ?? '',
        cidade: atletaBase.cidade ?? '',
        estado: atletaBase.estado ?? '',
        banco: atletaBase.banco ?? '',
        agencia: atletaBase.agencia ?? '',
        conta: atletaBase.conta ?? '',
        tipoConta: atletaBase.tipo_conta ?? 'corrente',
      });
    }
  }, [cadastro, atletaBase]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async (d: FormData) => {
      const income = INCOME_RANGES.find((r) => r.value === d.incomeValue)?.num ?? null;
      const payload = {
        tipo_pessoa: d.tipoPessoa,
        nome: d.nome,
        cpf_cnpj: d.cpfCnpj.replace(/\D/g, ''),
        email: d.email,
        telefone: d.telefone,
        data_nascimento: d.dataNascimento || null,
        income_value: income,
        cep: d.cep,
        rua: d.rua,
        numero: d.numero,
        complemento: d.complemento || null,
        bairro: d.bairro,
        cidade: d.cidade,
        estado: d.estado,
        banco: d.banco,
        agencia: d.agencia,
        conta: d.conta,
        tipo_conta: d.tipoConta,
      };
      if (cadastro) {
        const { error } = await supabase.from('carreira_cadastro_bancario').update(payload).eq('id', cadastro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carreira_cadastro_bancario').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Cadastro salvo');
      qc.invalidateQueries({ queryKey: ['carreira-cadastro-bancario'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      setSubmitFeedback(null);
      const { data, error } = await supabase.functions.invoke('carreira-asaas-submit-registration', { body: {} });
      if (error) throw new Error(await extractFunctionError(error, 'Erro ao enviar cadastro ao Asaas'));
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro');
      return data;
    },
    onSuccess: async (data: any) => {
      const message = data?.message || 'Enviado ao Asaas';
      setSubmitFeedback({ type: 'success', message });
      toast.success(message);
      await qc.invalidateQueries({ queryKey: ['carreira-cadastro-bancario'] });
      await qc.refetchQueries({ queryKey: ['carreira-cadastro-bancario'], type: 'active' });
    },
    onError: (e: Error) => {
      setSubmitFeedback({ type: 'error', message: e.message });
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ['carreira-cadastro-bancario'] });
    },
  });

  const check = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('carreira-asaas-check-account-status', { body: {} });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Erro');
      return data;
    },
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['carreira-cadastro-bancario'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <CarreiraAdminLayout>
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </CarreiraAdminLayout>
    );
  }

  const tipoPessoa = form.watch('tipoPessoa');
  const requiredDocs = tipoPessoa === 'cnpj'
    ? [
        { key: 'contrato_social', label: 'Contrato Social' },
        { key: 'documento_responsavel_pj', label: 'Documento do responsável' },
      ]
    : [{ key: 'documento_foto_pf', label: 'Documento com foto' }];

  const pendingItems = (() => {
    const items: string[] = [];
    if (!cadastro) {
      items.push('Salve o cadastro bancário antes de enviar.');
      return items;
    }

    const requiredFields: Array<[string, unknown]> = [
      ['CPF/CNPJ', cadastro.cpf_cnpj],
      ['Nome / Razão Social', cadastro.nome],
      ['Email', cadastro.email],
      ['Telefone', cadastro.telefone],
      ['Faturamento mensal', cadastro.income_value],
      ['CEP', cadastro.cep],
      ['Rua', cadastro.rua],
      ['Número', cadastro.numero],
      ['Bairro', cadastro.bairro],
      ['Cidade', cadastro.cidade],
      ['UF', cadastro.estado],
      ['Banco', cadastro.banco],
      ['Agência', cadastro.agencia],
      ['Conta', cadastro.conta],
    ];
    if (cadastro.tipo_pessoa === 'cpf') requiredFields.push(['Data de nascimento', cadastro.data_nascimento]);

    requiredFields.forEach(([label, value]) => {
      if (value === null || value === undefined || String(value).trim() === '') items.push(`Preencha: ${label}.`);
    });

    requiredDocs.forEach((doc) => {
      if (!docs.some((d) => d.tipo_documento === doc.key)) items.push(`Envie o documento: ${doc.label}.`);
    });

    return items;
  })();

  return (
    <CarreiraAdminLayout>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Banco — Subconta Asaas Carreira ID</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Status da subconta</span>
              <StatusPill status={cadastro?.asaas_status} />
            </CardTitle>
            <CardDescription>
              {cadastro?.asaas_account_id ? `Asaas ID: ${cadastro.asaas_account_id}` : 'Subconta ainda não criada'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pendingItems.length > 0 && (
              <div className="w-full rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Antes de enviar, ajuste:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {pendingItems.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {submitFeedback && (
              <div className={`w-full rounded-md border p-3 text-sm ${submitFeedback.type === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-primary'}`}>
                {submitFeedback.message}
              </div>
            )}
            <Button
              onClick={() => {
                if (pendingItems.length > 0) {
                  const message = 'Existem pendências no cadastro antes do envio.';
                  setSubmitFeedback({ type: 'error', message });
                  toast.error(message);
                  return;
                }
                submit.mutate();
              }}
              disabled={submit.isPending || !cadastro}
            >
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar para validação
            </Button>
            <Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending || !cadastro?.asaas_account_id}>
              {check.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Consultar status no Asaas
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro bancário</CardTitle>
            <CardDescription>Dados usados para criar a subconta Asaas do Carreira ID (mesmo CNPJ do Atleta ID).</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => save.mutate(d))} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="tipoPessoa" render={({ field }) => (
                    <FormItem><FormLabel>Tipo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="cpf">CPF</SelectItem></SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cpfCnpj" render={({ field }) => (
                    <FormItem><FormLabel>CPF/CNPJ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Nome / Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="telefone" render={({ field }) => (
                    <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  {tipoPessoa === 'cpf' && (
                    <FormField control={form.control} name="dataNascimento" render={({ field }) => (
                      <FormItem><FormLabel>Data de nascimento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="incomeValue" render={({ field }) => (
                    <FormItem><FormLabel>Faturamento mensal</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                        <SelectContent>{INCOME_RANGES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-base font-semibold">Endereço</Label>
                  <div className="grid md:grid-cols-3 gap-4 mt-3">
                    <FormField control={form.control} name="cep" render={({ field }) => (<FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="rua" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Rua</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="numero" render={({ field }) => (<FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="complemento" render={({ field }) => (<FormItem><FormLabel>Complemento</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="bairro" render={({ field }) => (<FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="cidade" render={({ field }) => (<FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="estado" render={({ field }) => (<FormItem><FormLabel>UF</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Label className="text-base font-semibold">Dados bancários</Label>
                  <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <FormField control={form.control} name="banco" render={({ field }) => (<FormItem><FormLabel>Banco (código)</FormLabel><FormControl><Input placeholder="Ex: 336" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tipoConta" render={({ field }) => (
                      <FormItem><FormLabel>Tipo de conta</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupanca">Poupança</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="agencia" render={({ field }) => (<FormItem><FormLabel>Agência</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="conta" render={({ field }) => (<FormItem><FormLabel>Conta (com dígito, ex: 12345-6)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar cadastro
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documentos</CardTitle></CardHeader>
          <CardContent><DocumentUploadCarreira tipoPessoa={tipoPessoa} /></CardContent>
        </Card>
      </div>
    </CarreiraAdminLayout>
  );
}