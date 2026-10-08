import { describe, expect, it } from 'vitest';
import { buildRoundPlan, makeRoomCode, renderQuestion, scorePrediction } from './game';
import { questions } from './questions';

describe('game engine', () => {
  it('scores correct predictions and the five-second speed bonus', () => {
    expect(scorePrediction(true, 4999)).toBe(125);
    expect(scorePrediction(true, 5001)).toBe(100);
    expect(scorePrediction(false, 100)).toBe(0);
  });
  it('builds a fair ten-round plan for five players', () => {
    const players = Array.from({ length: 5 }, (_, id) => ({ id: String(id) }));
    const plan = buildRoundPlan(players, questions, 2, () => 0.42);
    expect(plan).toHaveLength(10);
    expect(new Set(plan.map((round) => round.question.id)).size).toBe(10);
    for (const player of players) expect(plan.filter((round) => round.subjectId === player.id)).toHaveLength(2);
  });
  it('supports two and eight players', () => {
    expect(buildRoundPlan([{ id: 'a' }, { id: 'b' }], questions, 1)).toHaveLength(2);
    expect(buildRoundPlan(Array.from({ length: 8 }, (_, i) => ({ id: String(i) })), questions, 5)).toHaveLength(40);
  });
  it('renders names and room codes safely', () => {
    expect(renderQuestion('What would {player_name} choose?', 'Mona')).toBe('What would Mona choose?');
    expect(makeRoomCode(() => 0)).toMatch(/^[A-Z2-9]{6}$/);
  });
});
