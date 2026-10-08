'use client';
/* oxlint-disable react/react-compiler, react-hooks/exhaustive-deps -- realtime snapshots intentionally synchronize external server state */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Clock3, Copy, Crown, Gamepad2, Link2, LockKeyhole, PartyPopper, Play, Share2, ShieldCheck, Sparkles, Trophy, UserPlus, Users, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react';
import { buildRoundPlan, makeRoomCode, renderQuestion, scorePrediction, type GamePlayer } from '@/lib/game';
import { questions } from '@/lib/questions';
import { actions, backendConfigured, ensureGuestSession, subscribeToRoom, type BackendSnapshot } from '@/lib/backend';

type Screen = 'home' | 'create' | 'join' | 'lobby' | 'game' | 'reveal' | 'results';
const avatars = ['🛸', '🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🦉'];
const demoPlayers: GamePlayer[] = [
  { id: 'you', name: 'Player 1', avatar: '🛸', score: 0, correct: 0, answered: 0, ready: true, connected: true, isHost: true },
  { id: 'mona', name: 'Mona', avatar: '🦊', score: 250, correct: 2, answered: 2, ready: true, connected: true },
  { id: 'rahul', name: 'Rahul', avatar: '🐼', score: 100, correct: 1, answered: 2, ready: true, connected: true },
  { id: 'priya', name: 'Priya', avatar: '🦄', score: 225, correct: 2, answered: 2, ready: true, connected: true },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>('home');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(avatars[0]);
  const [roomCode, setRoomCode] = useState('');
  const [sound, setSound] = useState(true);
  const [online, setOnline] = useState(true);
  const [players, setPlayers] = useState(demoPlayers);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backend, setBackend] = useState<BackendSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [presenceCount, setPresenceCount] = useState(0);
  const plan = useMemo(() => buildRoundPlan(demoPlayers, questions, 2), []);
  const current = backend?.round ? { subjectId: backend.round.subjectMemberId, question: { id: backend.round.question.id, category: backend.round.question.category, text: backend.round.question.text, options: backend.round.question.options as [string,string,string,string] } } : plan[round % plan.length];
  const subject = players.find((player) => player.id === current.subjectId) ?? players[0];
  const revealOption = backend?.round?.reveal?.subjectOption ?? 2;
  const myReveal = backend?.round?.reveal?.answers.find((answer) => answer.memberId === backend.selfMemberId);
  const ranking = [...players].sort((a,b)=>b.score-a.score);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    addEventListener('online', sync); addEventListener('offline', sync);
    return () => { removeEventListener('online', sync); removeEventListener('offline', sync); };
  }, []);

  useEffect(() => {
    if (!backendConfigured) return;
    const invite = new URLSearchParams(location.search).get('room');
    if (invite) setRoomCode(invite.toUpperCase());
    const savedRoom = localStorage.getItem('kmn-room-id');
    void ensureGuestSession().then(async () => { if (savedRoom) setBackend(await actions.heartbeat(savedRoom)); }).catch(() => localStorage.removeItem('kmn-room-id'));
  }, []);

  useEffect(() => {
    if (!backend?.room.id) return;
    localStorage.setItem('kmn-room-id', backend.room.id);
    setRoomCode(backend.room.code);
    setPlayers(backend.players.map((p) => ({ id:p.id,name:p.name,avatar:p.avatar,score:p.score,correct:0,answered:0,ready:p.ready,connected:p.connected,isHost:p.isHost })));
    setScreen(backend.room.status === 'waiting' ? 'lobby' : backend.room.status === 'question_active' ? 'game' : backend.room.status === 'reveal' ? 'reveal' : backend.room.status === 'finished' ? 'results' : 'lobby');
    return subscribeToRoom(backend.room.id, () => { void actions.snapshot(backend.room.id).then(setBackend).catch((e) => setError(e.message)); }, setPresenceCount);
  }, [backend?.room.id, backend?.room.version]);

  useEffect(() => {
    if (!backend?.round?.deadlineAt || backend.round.status !== 'active') return;
    const delay=Math.max(250,new Date(backend.round.deadlineAt).getTime()-Date.now()+350);
    const timer=setTimeout(()=>{void actions.snapshot(backend.room.id).then(setBackend).catch((e)=>setError(e.message))},delay);
    return()=>clearTimeout(timer);
  },[backend?.round?.id,backend?.round?.deadlineAt,backend?.round?.status]);

  const createRoom = async () => { setError(''); if (!backendConfigured) { setRoomCode(makeRoomCode()); setPlayers((list) => list.map((p, i) => i ? p : { ...p, name, avatar })); setScreen('lobby'); return; } setBusy(true); try { setBackend(screen === 'join' ? await actions.join({code:roomCode,name,avatar}) : await actions.create({name,avatar,maxPlayers:8,questionsPerPlayer:2,roundSeconds:15,category:'Mixed'})); } catch(e){setError((e as Error).message)} finally{setBusy(false)} };
  const copyInvite = async () => { await navigator.clipboard?.writeText(`${location.origin}/?room=${roomCode}`); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const submit = async () => { if (selected === null || locked) return; setLocked(true); if ('vibrate' in navigator) navigator.vibrate(35); if (backend?.round) { try { setBackend(await actions.answer(backend.round.id,selected)); } catch(e){setError((e as Error).message);setLocked(false)} } };
  const reveal = () => { if (!locked) return; const correct = selected === 2; setPlayers((list) => list.map((p) => p.id === 'you' ? { ...p, score: p.score + scorePrediction(correct, 4200), answered: p.answered + 1, correct: p.correct + Number(correct) } : p)); setScreen('reveal'); };
  const nextRound = async () => { if (backend) { setBusy(true); try { setBackend(await actions.advance(backend.room.id)); setSelected(null); setLocked(false); } catch(e){setError((e as Error).message)} finally{setBusy(false)} return; } if (round >= 3) setScreen('results'); else { setRound((v) => v + 1); setSelected(null); setLocked(false); setScreen('game'); } };

  return <main className="app-shell">
    <div className="glow glow-one" /><div className="glow glow-two" />
    {!online && <div className="offline"><WifiOff size={16} /> You’re offline. We’ll reconnect your match automatically.</div>}
    <header className="topbar"><button className="brand" onClick={() => setScreen('home')} aria-label="Know Me or Not home"><Logo /><span>Know Me<br/><b>or Not?</b></span></button><button className="icon-button" onClick={() => setSound(!sound)} aria-label={sound ? 'Mute sound' : 'Turn sound on'}>{sound ? <Volume2 /> : <VolumeX />}</button></header>
    {error && <div className="game-error" role="alert">{error}<button onClick={()=>setError('')}><X /></button></div>}

    {screen === 'home' && <section className="hero screen enter"><div className="eyebrow"><Sparkles size={14} /> THE FRIENDSHIP GUESSING GAME</div><h1>How well do you<br/><span>really</span> know them?</h1><p className="hero-copy">Pick what your friends would choose. Read the room, trust your instincts, and claim the crown.</p><div className="hero-actions"><button className="primary giant" onClick={() => setScreen('create')}><Play fill="currentColor" /> Create a room</button><button className="secondary giant" onClick={() => setScreen('join')}><UserPlus /> Join with a code</button></div><div className="trust-row"><span><LockKeyhole /> Answers stay secret</span><span><Users /> 2–8 players</span><span><Clock3 /> 10–20 minutes</span></div><HowItWorks /></section>}

    {(screen === 'create' || screen === 'join') && <section className="form-screen screen enter"><button className="back" onClick={() => setScreen('home')}><ArrowLeft /> Back</button><div className="form-card"><div className="form-heading"><div className="round-icon">{screen === 'create' ? <PartyPopper /> : <Link2 />}</div><div><p>LET’S PLAY</p><h2>{screen === 'create' ? 'Create your room' : 'Join the party'}</h2></div></div>{screen === 'join' && <label>Room code<input className="code-input" value={roomCode} maxLength={6} placeholder="ABC123" onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} /></label>}<label>Your display name<input value={name} maxLength={24} placeholder="Name" onChange={(e) => setName(e.target.value)} /></label><fieldset><legend>Pick your player</legend><div className="avatar-grid">{avatars.map((item) => <button type="button" className={avatar === item ? 'avatar selected' : 'avatar'} key={item} onClick={() => setAvatar(item)} aria-label={`Choose avatar ${item}`}>{item}{avatar === item && <i><Check /></i>}</button>)}</div></fieldset>{screen === 'create' && <div className="settings-grid"><label>Question pack<select defaultValue="Mixed"><option>Mixed</option><option>Friends</option><option>Funny & Chaotic</option><option>Classic Preferences</option></select></label><label>Questions each<select defaultValue="2"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Answer timer<select defaultValue="15"><option>10 seconds</option><option>15 seconds</option><option>20 seconds</option><option>30 seconds</option></select></label><label>Max players<select defaultValue="8"><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option></select></label></div>}<button disabled={!name.trim() || (screen === 'join' && roomCode.length !== 6)} className="primary giant full" onClick={createRoom}>{screen === 'create' ? 'Create room' : 'Join room'} <ChevronRight /></button><p className="fineprint"><ShieldCheck /> No account needed. Your temporary seat is protected on this device.</p></div></section>}

    {screen === 'lobby' && <section className="screen lobby enter">
      <div className="lobby-head"><div><div className="live-pill"><span /> ROOM OPEN</div><p>YOUR ROOM CODE</p><button className="room-code" onClick={copyInvite}>{roomCode || 'KMN247'} <Copy /></button><small>{copied ? 'Invite copied!' : 'Tap to copy invite link'}</small></div><div className="ready-orbit"><b>{players.filter(p => p.ready).length}</b><span>READY</span></div></div>
      <div className="lobby-layout"><div className="panel"><div className="panel-title"><h2>Players</h2><span>{players.length} / 8</span></div><div className="player-list">{players.map((player, i) => <div className="player-row" key={player.id}><div className={`avatar mini c${i}`}>{player.avatar}</div><div className="player-name"><b>{player.name}</b><span>{player.isHost && <Crown />} {player.isHost ? 'Host' : 'Player'}</span></div>{player.id === backend?.selfMemberId && !player.isHost ? <button className="ready" onClick={async()=>{try{setBackend(await actions.ready(backend.room.id,!player.ready))}catch(e){setError((e as Error).message)}}}>{player.ready && <Check />} {player.ready?'Ready':'Tap when ready'}</button> : <div className="ready">{player.ready && <Check />} {player.ready?'Ready':'Not ready'}</div>}{i > 0 && backend?.room.isHost && <button className="kick" onClick={async()=>{try{setBackend(await actions.remove(backend.room.id,player.id))}catch(e){setError((e as Error).message)}}} aria-label={`Remove ${player.name}`}><X /></button>}</div>)}</div></div>
      <aside className="panel game-settings"><div className="panel-title"><h2>Game setup</h2></div><Setting label="Pack" value={backend?.room.category ?? 'Mixed bag'} icon="🎲"/><Setting label="Rounds" value={`${players.length * (backend?.room.questionsPerPlayer ?? 2)} total`} icon="⚡"/><Setting label="Timer" value={`${backend?.room.roundSeconds ?? 15} seconds`} icon="⏱️"/><button className="secondary full" onClick={copyInvite}><Share2 /> Invite friends</button></aside></div>
      <div className="lobby-bottom"><p><Wifi /> {backend ? `${presenceCount || players.filter(p=>p.connected).length} connected · ` : ''}Everyone’s here. Let the mind-reading begin.</p><button className="primary giant" disabled={busy || Boolean(backend && !backend.room.isHost)} onClick={async()=>{if(!backend){setScreen('game');return}setBusy(true);try{setBackend(await actions.start(backend.room.id))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}><Gamepad2 /> {backend && !backend.room.isHost?'Waiting for host':'Start game'}</button></div>
    </section>}

    {screen === 'game' && <section className="game screen enter"><div className="game-meta"><div><span>ROUND {backend?.game?.currentRound ?? round + 1} OF {backend?.game?.totalRounds ?? plan.length}</span><div className="progress"><i style={{width: `${((backend?.game?.currentRound ?? round + 1) / (backend?.game?.totalRounds ?? plan.length)) * 100}%`}} /></div></div><div className="connection"><Wifi /> Live</div></div><div className="question-wrap"><div className="subject"><div className="avatar subject-avatar">{subject.avatar}</div><div><p>READING THE MIND OF</p><h2>{subject.name}</h2></div></div><Countdown deadline={backend?.round?.deadlineAt}/><h1>{renderQuestion(current.question.text, subject.name)}</h1><p className="instruction">{subject.id === (backend?.selfMemberId ?? 'you') ? 'Choose your real answer. Everyone else is guessing.' : `Which answer will ${subject.name} choose?`}</p><div className="answers">{current.question.options.map((option, index) => <button disabled={locked || backend?.round?.myAnswer != null} className={`${selected === index || backend?.round?.myAnswer === index ? 'answer picked' : 'answer'} a${index}`} key={option} onClick={() => setSelected(index)}><span>{String.fromCharCode(65 + index)}</span><b>{option}</b>{(selected === index || backend?.round?.myAnswer === index) && <Check />}</button>)}</div><button className="primary giant submit" disabled={selected === null || locked || backend?.round?.myAnswer != null} onClick={submit}>{locked || backend?.round?.myAnswer != null ? <><LockKeyhole /> Answer locked</> : 'Lock it in'}</button>{!backend && locked && <button className="text-button" onClick={reveal}>Demo: show reveal <ChevronRight /></button>}<div className="answer-status"><div className="faces">{players.slice(0,3).map(p=><span key={p.id}>{p.avatar}</span>)}</div><b>{backend?.round?.answerCount ?? (locked ? 4 : 3)} of {players.length} answered</b><span>Waiting for everyone…</span></div></div></section>}

    {screen === 'reveal' && <section className="screen reveal enter"><div className="confetti" aria-hidden="true">✦　●　◆　✦　▲　●　✦</div><p className="eyebrow">THE ANSWER WAS</p><div className="reveal-answer"><span>{String.fromCharCode(65+revealOption)}</span><h1>{backend?.round?.reveal?.skipped?'Round skipped':current.question.options[revealOption]}</h1></div><div className="subject reveal-subject"><div className="avatar subject-avatar">{subject.avatar}</div><div><h2>{backend?.round?.reveal?.skipped?`${subject.name} ran out of time`:`${subject.name} has spoken!`}</h2><p>{backend?.round?.reveal?.skipped?'No points were awarded.':'No hesitation. That’s the real pick.'}</p></div></div><div className="result-card"><PartyPopper /><div><h2>{(myReveal?.correct ?? selected === 2) ? `You know ${subject.name}!` : `${subject.name} kept you guessing!`}</h2><p>{(myReveal?.correct ?? selected === 2) ? 'Correct prediction · Points awarded' : 'Good guess — the next mind is waiting.'}</p></div><b className="points">+{myReveal?.points ?? (selected === 2 ? 125 : 0)}</b></div><div className="mini-board"><h3>Round standings</h3>{[...players].sort((a,b)=>b.score-a.score).map((p,i)=><div key={p.id}><span className="rank">{i+1}</span><span>{p.avatar}</span><b>{p.name}</b><em>{p.score} pts</em></div>)}</div><button className="primary giant" disabled={busy || Boolean(backend && !backend.room.isHost)} onClick={nextRound}>{backend && !backend.room.isHost?'Waiting for host':(backend?.game && backend.game.currentRound>=backend.game.totalRounds) || round >= 3 ? 'See final results' : 'Next question'} <ChevronRight /></button></section>}

    {screen === 'results' && <section className="screen results enter"><div className="winner-glow"><Trophy /><p>GAME COMPLETE</p><h1>{ranking[0]?.name ?? 'The winner'} reads the room!</h1><span>Mind Reader of the night</span></div><div className="podium">{ranking.slice(0,3).map((player,index)=><div className={index===0?'first':''} key={player.id}>{index===0&&<Crown/>}<span>{index+1}</span><div>{player.avatar}</div><b>{player.name}</b><em>{player.score}</em></div>)}</div><div className="insight-grid"><article><b>🧠 Mind Reader</b><span>{ranking[0]?.name} · highest score</span></article><article><b>🕵️ Best Detective</b><span>{ranking[1]?.name ?? ranking[0]?.name} · close challenger</span></article><article><b>🌙 Most Mysterious</b><span>{ranking.at(-1)?.name} · kept friends guessing</span></article></div><p className="stats-note">Playful stats based on this game’s eligible answered questions—not a scientific measure.</p><div className="hero-actions"><button className="primary giant" disabled={busy || Boolean(backend && !backend.room.isHost)} onClick={async()=>{if(backend){setBusy(true);try{setBackend(await actions.rematch(backend.room.id));setSelected(null);setLocked(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}else{setRound(0);setSelected(null);setLocked(false);setScreen('lobby')}}}><Play /> {backend && !backend.room.isHost?'Waiting for host':'Play again'}</button><button className="secondary giant" onClick={()=>setScreen('home')}>Home</button></div></section>}
    <footer><span>Guest play · Minimal data · Rooms expire automatically</span><span>Privacy · How to play · v1.0</span></footer>
  </main>;
}

function Logo(){return <span className="logo"><span>?</span><span>!</span></span>}
function Setting({label,value,icon}:{label:string;value:string;icon:string}){return <div className="setting"><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>}
function HowItWorks(){return <div className="how"><div><span>1</span><b>Gather your people</b><p>Share a six-character room code. No signup required.</p></div><div><span>2</span><b>Guess their answer</b><p>Everyone picks privately. The subject’s truth decides it.</p></div><div><span>3</span><b>Prove you know them</b><p>Score points, earn awards, and settle the debate.</p></div></div>}
function Countdown({deadline}:{deadline?:string}){const [seconds,setSeconds]=useState(15);useEffect(()=>{if(!deadline)return;const tick=()=>setSeconds(Math.max(0,Math.ceil((new Date(deadline).getTime()-Date.now())/1000)));tick();const timer=setInterval(tick,250);return()=>clearInterval(timer)},[deadline]);return <div className="timer" aria-label={`${seconds} seconds remaining`}><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18"/><circle className="timer-progress" cx="22" cy="22" r="18"/></svg><b>{deadline?seconds:11}</b></div>}
