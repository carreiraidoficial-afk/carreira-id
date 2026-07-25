import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, User, Mail, Phone } from 'lucide-react';
import { validateEmail, validatePhone, formatPhoneMask } from '@/lib/form-validators';
import { ColaboradoresTab } from './ColaboradoresTab';

interface EditContaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditContaDialog({ open, onOpenChange }: EditContaDialogProps) {
  const { user, refreshUser } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingData(true);
    supabase
      .from('profiles')
      .select('nome, email, telefone')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setNome(data.nome || '');
          setEmail(data.email || '');
          setTelefone(data.telefone || '');
        }
        setLoadingData(false);
      });
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    if (nome.trim().length < 2) {
      toast.error('Nome deve ter pelo menos 2 caracteres');
      return;
    }
    if (email.trim() && !validateEmail(email.trim())) {
      toast.error('Email inválido. Verifique o endereço digitado.');
      return;
    }
    const cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone && !validatePhone(cleanPhone)) {
      toast.error('Número de telefone inválido. Use um número real com DDD.');
      return;
    }

    setIsLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // If email changed, update auth email too
      if (email.trim() !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email.trim(),
        });
        if (emailError) {
          toast.error('Erro ao atualizar email: ' + emailError.message);
          setIsLoading(false);
          return;
        }
        toast.info('Um email de confirmação foi enviado para o novo endereço');
      }

      await refreshUser();
      toast.success('Dados atualizados com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Minha Conta</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="conta">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="conta">Conta</TabsTrigger>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="conta">
            {loadingData ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="conta-nome">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="conta-nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="pl-10"
                      placeholder="Seu nome"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conta-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="conta-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conta-telefone">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="conta-telefone"
                      value={telefone}
                      onChange={(e) => setTelefone(formatPhoneMask(e.target.value))}
                      className="pl-10"
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="usuarios" className="pt-2">
            {user && <ColaboradoresTab userId={user.id} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
