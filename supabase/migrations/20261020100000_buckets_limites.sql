-- Limites de tamanho e tipo de arquivo nos buckets (antes só a tela limitava; quem chamasse a API direto podia subir qualquer coisa).
-- SVG fica de fora dos buckets de usuário (pode carregar script); só o bucket de assets do admin aceita.

update storage.buckets set file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/bmp','image/tiff']
 where id = 'atleta-fotos';

update storage.buckets set file_size_limit = 100 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif','image/bmp','image/tiff',
                             'video/mp4','video/quicktime','video/webm','video/x-m4v','video/x-msvideo','video/x-matroska']
 where id in ('atleta-posts', 'jornada-midias');

update storage.buckets set file_size_limit = 25 * 1024 * 1024,
  allowed_mime_types = array['application/json','text/plain','image/jpeg','image/png','image/webp','image/svg+xml','image/gif']
 where id = 'carreira-assets';

update storage.buckets set file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'atividade-externa-fotos';

update storage.buckets set file_size_limit = 10 * 1024 * 1024,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif']
 where id = 'carreira-asaas-documentos';
