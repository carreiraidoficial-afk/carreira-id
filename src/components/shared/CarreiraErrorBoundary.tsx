import { Component, ErrorInfo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

// Dedup em memoria -- evita inundar a tabela se o mesmo erro disparar em
// loop (ex: um componente que remonta e crasha repetidamente).
const reportedSignatures = new Set<string>();

export async function reportClientError(message: string, stack?: string, componentStack?: string) {
  const signature = `${message}::${(stack || '').slice(0, 200)}`;
  if (reportedSignatures.has(signature)) return;
  reportedSignatures.add(signature);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('carreira_client_errors' as any).insert({
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 5000) : null,
      component_stack: componentStack ? componentStack.slice(0, 5000) : null,
      url: window.location.href,
      user_id: session?.user?.id || null,
      user_agent: navigator.userAgent,
    });
  } catch {
    // Log de erro nao pode derrubar mais nada -- falha silenciosa.
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class CarreiraErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error.message, error.stack, info.componentStack || undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6 text-center" data-theme="dark-orange">
          <h1 className="text-xl font-bold">Ops, algo deu errado</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            Encontramos um problema ao carregar esta página. Já registramos o ocorrido — tente recarregar.
          </p>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Recarregar página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
