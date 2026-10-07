import { Card } from '@/components/ui/card';
import { User } from 'lucide-react';

interface Props {
  bio: string | null | undefined;
  accentColor?: string;
}

/** Bio completa do profissional (no cartão lateral ela fica resumida). */
export function SobreMimCard({ bio, accentColor = '#3b82f6' }: Props) {
  if (!bio?.trim()) return null;
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
        <User className="w-4 h-4" style={{ color: accentColor }} />
        Sobre mim
      </h2>
      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{bio}</p>
    </Card>
  );
}
