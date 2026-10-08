import type { RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from './supabase';

export type BackendPlayer = { id:string; name:string; avatar:string; ready:boolean; connected:boolean; score:number; isHost:boolean };
export type BackendSnapshot = {
  room:{ id:string; code:string; status:string; maxPlayers:number; questionsPerPlayer:number; roundSeconds:number; category:string; version:number; isHost:boolean };
  selfMemberId:string;
  players:BackendPlayer[];
  game:null|{ id:string; status:string; currentRound:number; totalRounds:number };
  round:null|{ id:string; number:number; status:string; subjectMemberId:string; startsAt:string; deadlineAt:string; answerCount:number; myAnswer:number|null; question:{id:string;text:string;options:string[];category:string}; reveal:null|{subjectOption:number|null;skipped:boolean;answers:Array<{memberId:string;selectedOption:number;correct:boolean|null;points:number}>} };
};

let client: SupabaseClient | null = null;
let sessionPromise: Promise<Session> | null = null;
export const backendConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function supabase() { client ??= getSupabaseBrowserClient(); if (!client) throw new Error('Supabase is not configured.'); return client; }

export async function ensureGuestSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const sb = supabase();
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session;
    const created = await sb.auth.signInAnonymously();
    if (created.error || !created.data.session) throw new Error(created.error?.message ?? 'Could not start a guest session.');
    return created.data.session;
  })();
  try { return await sessionPromise; }
  catch (error) { sessionPromise = null; throw error; }
}

export async function gameAction(action:string,payload:Record<string,unknown>={}):Promise<BackendSnapshot> {
  await ensureGuestSession();
  const { data, error } = await supabase().rpc('game_action_client',{action,payload});
  if (error) throw new Error(messageFor(normalizeDatabaseError(error.message)));
  return data as BackendSnapshot;
}

export function subscribeToRoom(roomId:string,onChange:()=>void|Promise<void>,onPresence:(online:number)=>void) {
  const sb=supabase();
  let refreshTimer:ReturnType<typeof setTimeout>|null=null;
  let refreshing=false;
  let refreshQueued=false;
  const refresh=()=>{
    if(refreshTimer)return;
    refreshTimer=setTimeout(async()=>{
      refreshTimer=null;
      if(refreshing){refreshQueued=true;return;}
      refreshing=true;
      try{await onChange();}finally{
        refreshing=false;
        if(refreshQueued){refreshQueued=false;refresh();}
      }
    },60);
  };
  const channel=sb.channel(`room:${roomId}:game`,{config:{private:true,presence:{key:crypto.randomUUID()}}})
    .on('broadcast',{event:'state_changed'},refresh)
    .on('presence',{event:'sync'},()=>onPresence(Object.keys(channel.presenceState()).length))
    .subscribe(async status=>{ if(status==='SUBSCRIBED') await channel.track({online_at:new Date().toISOString()}); });
  return ()=>{ if(refreshTimer)clearTimeout(refreshTimer); void sb.removeChannel(channel as RealtimeChannel); };
}

export const actions = {
  create:(payload:Record<string,unknown>)=>gameAction('create_room',payload),
  join:(payload:Record<string,unknown>)=>gameAction('join_room',payload),
  snapshot:(roomId:string)=>gameAction('snapshot',{roomId}),
  ready:(roomId:string,ready:boolean)=>gameAction('ready',{roomId,ready}),
  start:(roomId:string)=>gameAction('start',{roomId}),
  answer:(roundId:string,option:number)=>gameAction('answer',{roundId,option}),
  advance:(roomId:string)=>gameAction('advance',{roomId}),
  leave:(roomId:string)=>gameAction('leave',{roomId}),
  remove:(roomId:string,memberId:string)=>gameAction('remove_player',{roomId,memberId}),
  heartbeat:(roomId:string)=>gameAction('heartbeat',{roomId}),
  rematch:(roomId:string)=>gameAction('rematch',{roomId}),
};

function normalizeDatabaseError(message:string){return message.split('\n')[0].replace(/^.*?: /,'').trim()}
function messageFor(code:string){return ({room_unavailable:'That room is unavailable or has already started.',room_full:'That room is full.',display_name_taken:'That name is already in use in this room.',players_not_ready:'Every connected player must be ready before starting.',answer_already_submitted:'Your answer is already locked.',round_closed:'This round has ended.',host_only:'Only the host can do that.',rate_limited:'Too many attempts. Please wait a moment.',insufficient_questions:'This question pack does not have enough questions.'} as Record<string,string>)[code]??code.replaceAll('_',' ')}
