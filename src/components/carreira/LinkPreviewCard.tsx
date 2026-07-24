import { VideoEmbedCard, isVideoUrl } from './VideoEmbedCard';
import { Instagram } from 'lucide-react';

interface LinkPreview {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
  type?: string | null;
  /** false when the author's plan doesn't include the YouTube/video embed feature */
  video_embed_allowed?: boolean;
}

interface LinkPreviewCardProps {
  preview: LinkPreview;
}

export function LinkPreviewCard({ preview }: LinkPreviewCardProps) {
  if (!preview.title && !preview.description && !preview.image) return null;

  // Render embed for video URLs, unless the author's plan disallows it
  if (isVideoUrl(preview.url) && preview.video_embed_allowed !== false) {
    return <VideoEmbedCard url={preview.url} title={preview.title} />;
  }

  const domain = (() => {
    try { return new URL(preview.url).hostname.replace('www.', ''); } catch { return ''; }
  })();

  const isInstagram = preview.type === 'instagram' || /instagram\.com/i.test(preview.url);

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-muted/30"
    >
      {preview.image ? (
        <div className="aspect-[2/1] overflow-hidden bg-muted">
          <img
            src={preview.image}
            alt={preview.title || ''}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      ) : isInstagram ? (
        <div className="aspect-[2/1] overflow-hidden bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
          <Instagram className="w-16 h-16 text-white/90" />
        </div>
      ) : null}
      <div className="p-3 space-y-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
          {preview.site_name || domain}
        </p>
        {preview.title && (
          <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {preview.title}
          </h4>
        )}
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
