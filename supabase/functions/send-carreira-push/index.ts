import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- Base64url helpers ----
function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createVapidJwt(audience: string, subject: string, privateKeyB64url: string, publicKeyB64url: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pubBytes = base64urlToUint8Array(publicKeyB64url);
  const x = uint8ArrayToBase64url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(pubBytes.slice(33, 65));

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateKeyB64url, x, y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsignedToken)
    )
  );

  const rawSig = derToRaw(signature);
  const sigB64 = uint8ArrayToBase64url(rawSig);
  return `${unsignedToken}.${sigB64}`;
}

function derToRaw(derSig: Uint8Array): Uint8Array {
  if (derSig.length === 64) return derSig;
  let offset = 2;
  if (derSig[1] & 0x80) offset += (derSig[1] & 0x7f);
  offset++;
  const rLen = derSig[offset++];
  const rStart = offset;
  offset += rLen;
  offset++;
  const sLen = derSig[offset++];
  const sStart = offset;
  const r = derSig.slice(rStart, rStart + rLen);
  const s = derSig.slice(sStart, sStart + sLen);
  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

async function hkdfExtractAndExpand(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
  const infoWithCounter = concatUint8Arrays(info, new Uint8Array([1]));
  const expandKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, infoWithCounter));
  return result.slice(0, length);
}

async function encryptPayload(payload: string, p256dhB64url: string, authB64url: string) {
  const clientPublicKeyBytes = base64urlToUint8Array(p256dhB64url);
  const authSecret = base64urlToUint8Array(authB64url);
  const localKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clientPublicKey = await crypto.subtle.importKey('raw', clientPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPublicKey }, localKeyPair.privateKey, 256));
  const localPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', localKeyPair.publicKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const ikmInfo = new TextEncoder().encode('WebPush: info\0');
  const ikm = await hkdfExtractAndExpand(authSecret, sharedSecret, concatUint8Arrays(ikmInfo, clientPublicKeyBytes, localPublicKey), 32);
  const cek = await hkdfExtractAndExpand(salt, ikm, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExtractAndExpand(salt, ikm, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  const paddedPayload = concatUint8Arrays(new TextEncoder().encode(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, paddedPayload));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concatUint8Arrays(salt, rs, new Uint8Array([localPublicKey.length]), localPublicKey, encrypted);
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey);
  const vapidPubBytes = base64urlToUint8Array(vapidPublicKey);
  const vapidKeyB64 = uint8ArrayToBase64url(vapidPubBytes);
  const ciphertext = await encryptPayload(payload, subscription.p256dh, subscription.auth);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidKeyB64}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
    },
    body: ciphertext,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error: any = new Error(`Push failed: ${response.status} ${errorBody}`);
    error.statusCode = response.status;
    throw error;
  }
  return response;
}

// ---- Main handler ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user_ids, title, body, url, tag, destinatario_tipo, destinatario_filtro, category } = await req.json();

    // Categoria (opcional) -> respeita os toggles de /carreira/admin/push.
    // Sem 'category', o push segue direto (usado por fluxos que não têm toggle
    // dedicado ali, ex: confirmação de pagamento, lembrete de trial).
    if (category) {
      const { data: configRow } = await supabase
        .from('saas_config')
        .select('valor')
        .eq('chave', 'carreira_push_config')
        .maybeSingle();
      let pushConfig: Record<string, boolean> = {};
      try { pushConfig = configRow?.valor ? JSON.parse(configRow.valor) : {}; } catch { /* usa default abaixo */ }
      const masterOn = pushConfig.push_ativo !== false;
      const categoryOn = pushConfig[category] !== false;
      if (!masterOn || !categoryOn) {
        return new Response(JSON.stringify({ sent: 0, skipped: true, reason: `categoria '${category}' desativada em /carreira/admin/push` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Determine target user_ids
    let targetUserIds: string[] = user_ids || [];

    if (!user_ids && destinatario_tipo) {
      // Resolve user IDs from destinatário filter
      if (destinatario_tipo === 'todos') {
        const { data: allSubs } = await supabase
          .from('carreira_push_subscriptions')
          .select('user_id');
        targetUserIds = [...new Set((allSubs || []).map((s: any) => s.user_id))];
      } else if (destinatario_tipo === 'tipo_perfil' && destinatario_filtro?.tipos) {
        // Get user_ids from perfis_rede matching tipos + perfil_atleta for atleta_filho
        const tipos = destinatario_filtro.tipos as string[];
        const redeTypes = tipos.filter((t: string) => t !== 'atleta_filho');
        const includeAtleta = tipos.includes('atleta_filho');

        const userIdSet = new Set<string>();

        if (redeTypes.length > 0) {
          const { data: redeProfiles } = await supabase
            .from('perfis_rede')
            .select('user_id')
            .in('tipo', redeTypes);
          (redeProfiles || []).forEach((p: any) => userIdSet.add(p.user_id));
        }

        if (includeAtleta) {
          const { data: atletaProfiles } = await supabase
            .from('perfil_atleta')
            .select('user_id');
          (atletaProfiles || []).forEach((p: any) => userIdSet.add(p.user_id));
        }

        targetUserIds = [...userIdSet];
      } else if (destinatario_tipo === 'individual' && destinatario_filtro?.user_id) {
        targetUserIds = [destinatario_filtro.user_id];
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No target users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get subscriptions from carreira table
    const { data: subscriptions, error: subError } = await supabase
      .from('carreira_push_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({
      title: title || 'Carreira ID',
      body: body || '',
      url: url || '/carreira',
      tag: tag || 'carreira',
      icon: '/carreira-icon-512.png',
    });

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];
    const details: any[] = [];

    for (const sub of subscriptions) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          'mailto:contato@carreiraid.com.br'
        );
        sent++;
        details.push({ endpoint_tail: sub.endpoint.slice(-12), ok: true });
      } catch (err: any) {
        console.error(`Push failed for ${sub.endpoint}:`, err.message);
        failed++;
        details.push({ endpoint_tail: sub.endpoint.slice(-12), ok: false, statusCode: err.statusCode, message: String(err.message).slice(0, 300) });
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('carreira_push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, failed, expired: expiredEndpoints.length, total_subs: subscriptions.length, details }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Carreira push error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
