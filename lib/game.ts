export type GamePlayer = {
  id: string;
  name: string;
  avatar: string;
  score: number;
  correct: number;
  answered: number;
  ready: boolean;
  connected: boolean;
  isHost?: boolean;
};

export type GameQuestion = {
  id: string;
  category: string;
  text: string;
  options: [string, string, string, string];
};

export type RoundPlan = { subjectId: string; question: GameQuestion };

export function scorePrediction(correct: boolean, receivedInMs: number) {
  if (!correct) return 0;
  return receivedInMs <= 5_000 ? 125 : 100;
}

export function buildRoundPlan(
  players: Pick<GamePlayer, 'id'>[],
  questions: GameQuestion[],
  questionsPerPlayer = 2,
  random = Math.random,
): RoundPlan[] {
  if (players.length < 2 || players.length > 8) throw new Error('Games require 2–8 players.');
  if (questionsPerPlayer < 1 || questionsPerPlayer > 5) throw new Error('Questions per player must be 1–5.');
  const needed = players.length * questionsPerPlayer;
  if (questions.length < needed) throw new Error(`At least ${needed} unique questions are required.`);

  const shuffled = [...questions].sort(() => random() - 0.5);
  const subjects: string[] = [];
  for (let pass = 0; pass < questionsPerPlayer; pass += 1) {
    const passPlayers = [...players].sort(() => random() - 0.5);
    if (subjects.at(-1) === passPlayers[0]?.id && passPlayers.length > 1) {
      [passPlayers[0], passPlayers[1]] = [passPlayers[1], passPlayers[0]];
    }
    subjects.push(...passPlayers.map((player) => player.id));
  }
  return subjects.map((subjectId, index) => ({ subjectId, question: shuffled[index] }));
}

export function renderQuestion(question: string, playerName: string) {
  return question.replaceAll('{player_name}', playerName);
}

export function makeRoomCode(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
}
