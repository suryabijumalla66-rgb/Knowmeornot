import { createClient } from 'npm:@supabase/supabase-js@2.76.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const allowed = new Set(['create_room','join_room','snapshot','ready','start','answer','advance','leave','remove_player','heartbeat','rematch']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'authentication_required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) return response({ error: 'server_not_configured' }, 500);

  const token=authorization.slice(7);
  // Supabase's verify_jwt gateway validates the signature before this handler runs.
  const userId=userIdFromVerifiedJwt(token);
  if (!userId) return response({ error: 'invalid_session' }, 401);
  const body = await request.json().catch(() => ({}));
  if (!allowed.has(body.action)) return response({ error: 'unknown_action' }, 400);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc('game_action', { action: body.action, user_id: userId, payload: body.payload ?? {} });
  if (error) return response({ error: normalize(error.message) }, error.code === '42501' ? 403 : 400);
  return response({ data });
});

function normalize(message: string) { return message.split('\n')[0].replace(/^.*?: /, '').slice(0, 120); }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
function userIdFromVerifiedJwt(token:string){
  try{
    const encoded=token.split('.')[1];
    if(!encoded)return null;
    const base64=encoded.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(encoded.length/4)*4,'=');
    const claims=JSON.parse(atob(base64)) as {sub?:unknown};
    return typeof claims.sub==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sub)?claims.sub:null;
  }catch{return null;}
}
