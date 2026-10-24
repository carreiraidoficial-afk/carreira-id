import { FileText, ChevronRight, Mail, MessageCircle } from 'lucide-react';
import { PRECO_PREMIUM, PRECO_PREMIUM_ANUAL } from '@/config/carreiraPlanos';
import { SUPPORT_WHATSAPP_URL } from '@/lib/form-validators';

const brl = (v: number) => v.toFixed(2).replace('.', ',');

/** Resumo das condições da assinatura na aba Assinatura (as completas ficam nos Termos de Uso, seção 9). */
export function CondicoesAssinaturaCard() {
  return (
    <div className="mt-3 rounded-lg border p-3 space-y-2.5">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <FileText className="h-3.5 w-3.5" />
        Condições da assinatura
      </h4>
      <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
        <li>
          <strong className="text-foreground">Elite:</strong> R$ {brl(PRECO_PREMIUM)} por mês, ou R$ {brl(PRECO_PREMIUM_ANUAL)} por ano, à vista no PIX ou no cartão.
        </li>
        <li>
          <strong className="text-foreground">Renovação:</strong> o mensal no cartão renova sozinho todo mês; o mensal no PIX gera um novo PIX a cada mês; o anual é um pagamento único de 365 dias e não renova.
        </li>
        <li>
          <strong className="text-foreground">Cancelar:</strong> quando quiser, sem multa, aqui mesmo nesta aba. Você continua com o Elite até o fim do período já pago.
        </li>
        <li>
          <strong className="text-foreground">Garantia de 7 dias:</strong> desista em até 7 dias da contratação e receba o valor de volta, em até 10 dias, pelo mesmo meio de pagamento.
        </li>
        <li>
          <strong className="text-foreground">Atendimento:</strong> segunda a sexta, das 9h às 17h.
        </li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <a
          href="mailto:contato@carreiraid.com.br?subject=Assinatura%20Elite%20-%20Carreira%20ID"
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
        >
          <Mail className="h-3.5 w-3.5" /> contato@carreiraid.com.br
        </a>
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5 text-green-600" /> WhatsApp
        </a>
      </div>
      <a
        href="/termos-de-uso#assinatura"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
      >
        Ler as condições completas (Termos de Uso, seção 9)
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </a>
    </div>
  );
}
