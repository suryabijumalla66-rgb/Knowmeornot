import { createClient } from 'npm:@supabase/supabase-js@2.76.1';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const allowed = new Set(['create_room','join_room','snapshot','ready','start','answer','advance','leave','remove_player','heartbeat','rematch']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response({ error: 'authentication_required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishable || !secret) return response({ error: 'server_not_configured' }, 500);

  const authClient = createClient(url, publishable, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return response({ error: 'invalid_session' }, 401);
  const body = await request.json().catch(() => ({}));
  if (!allowed.has(body.action)) return response({ error: 'unknown_action' }, 400);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc('game_action', { action: body.action, user_id: user.id, payload: body.payload ?? {} });
  if (error) return response({ error: normalize(error.message) }, error.code === '42501' ? 403 : 400);
  return response({ data });
});

function normalize(message: string) { return message.split('\n')[0].replace(/^.*?: /, '').slice(0, 120); }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
