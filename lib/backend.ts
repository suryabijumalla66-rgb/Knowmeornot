import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
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
export const backendConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

function supabase() { client ??= getSupabaseBrowserClient(); if (!client) throw new Error('Supabase is not configured.'); return client; }

export async function ensureGuestSession() {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session;
  const created = await sb.auth.signInAnonymously();
  if (created.error || !created.data.session) throw new Error(created.error?.message ?? 'Could not start a guest session.');
  return created.data.session;
}

export async function gameAction(action:string,payload:Record<string,unknown>={}):Promise<BackendSnapshot> {
  await ensureGuestSession();
  const { data, error } = await supabase().functions.invoke('game-api',{ body:{action,payload} });
  if (error) throw new Error(await readableFunctionError(error));
  if (data?.error) throw new Error(messageFor(data.error));
  return data.data as BackendSnapshot;
}

export function subscribeToRoom(roomId:string,onChange:()=>void,onPresence:(online:number)=>void) {
  const sb=supabase();
  const channel=sb.channel(`room:${roomId}:game`,{config:{private:true,presence:{key:crypto.randomUUID()}}})
    .on('broadcast',{event:'state_changed'},onChange)
    .on('presence',{event:'sync'},()=>onPresence(Object.keys(channel.presenceState()).length))
    .subscribe(async status=>{ if(status==='SUBSCRIBED') await channel.track({online_at:new Date().toISOString()}); });
  return ()=>{ void sb.removeChannel(channel as RealtimeChannel); };
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

async function readableFunctionError(error:unknown){
  const context=(error as {context?:unknown})?.context;
  if(context && typeof (context as {json?:unknown}).json === 'function'){
    const body=await (context as Response).json().catch(()=>null) as {error?:string;message?:string}|null;
    if(body?.error)return messageFor(body.error);
    if(body?.message)return body.message;
  }
  if(context instanceof Error && context.message)return context.message;
  return (error as Error)?.message ?? 'The game server could not complete that action.';
}
function messageFor(code:string){return ({room_unavailable:'That room is unavailable or has already started.',room_full:'That room is full.',display_name_taken:'That name is already in use in this room.',players_not_ready:'Every connected player must be ready before starting.',answer_already_submitted:'Your answer is already locked.',round_closed:'This round has ended.',host_only:'Only the host can do that.',rate_limited:'Too many attempts. Please wait a moment.',insufficient_questions:'This question pack does not have enough questions.'} as Record<string,string>)[code]??code.replaceAll('_',' ')}
