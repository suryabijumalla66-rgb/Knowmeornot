import type { GameQuestion } from './game';

const prompts = [
  ['Classic Preferences', 'What would {player_name} choose as a dream gift?', ['A surprise trip', 'The latest tech', 'Something handmade', 'A shopping spree']],
  ['Classic Preferences', "What is {player_name}'s ideal way to recharge?", ['A long nap', 'Time outdoors', 'A movie marathon', 'Meeting friends']],
  ['Classic Preferences', 'Which treat would {player_name} save for last?', ['Chocolate cake', 'Spicy snacks', 'Ice cream', 'Fresh fruit']],
  ['Classic Preferences', 'Which view would {player_name} wake up to?', ['Ocean waves', 'Mountain peaks', 'City lights', 'A quiet garden']],
  ['Situational Questions', 'If {player_name} won a free flight tonight, where would they go?', ['A tropical island', 'A famous city', 'A mountain town', 'Wherever friends choose']],
  ['Situational Questions', 'If the power went out all evening, what would {player_name} do?', ['Tell stories', 'Go for a walk', 'Sleep early', 'Find a board game']],
  ['Situational Questions', 'What would {player_name} rescue first from a very messy room?', ['Their phone', 'A favorite outfit', 'Important documents', 'The snacks']],
  ['Situational Questions', 'If {player_name} became famous tomorrow, what would it be for?', ['A creative talent', 'A brave idea', 'A funny moment', 'Helping people']],
  ['Funny & Chaotic', 'Which harmless supervillain plan suits {player_name}?', ['Ban early alarms', 'Replace rain with confetti', 'Make snacks free', 'Declare every Friday a holiday']],
  ['Funny & Chaotic', 'Which animal would {player_name} trust as a personal assistant?', ['A clever crow', 'A loyal dog', 'A calm capybara', 'A dramatic cat']],
  ['Funny & Chaotic', 'What would {player_name} do first during a zombie-free fake apocalypse?', ['Raid the snack aisle', 'Build a blanket fort', 'Take a selfie', 'Create a team plan']],
  ['Funny & Chaotic', 'Which weird contest could {player_name} secretly win?', ['Fastest nap', 'Best excuse', 'Loudest laugh', 'Most tabs open']],
  ['This or That', 'What would {player_name} pick for a spontaneous weekend?', ['Road trip', 'Staycation', 'Festival', 'Nature escape']],
  ['This or That', 'Which everyday luxury matters more to {player_name}?', ['Fast Wi-Fi', 'Great coffee', 'Soft pillows', 'Zero traffic']],
  ['This or That', 'Which power would {player_name} rather have?', ['Teleportation', 'Mind reading', 'Time pause', 'Perfect memory']],
  ['This or That', 'What schedule would {player_name} choose?', ['Early bird', 'Night owl', 'Four-day week', 'No schedule at all']],
  ['Friends', 'What makes {player_name} feel most appreciated by friends?', ['A thoughtful message', 'Quality time', 'Practical help', 'A surprise plan']],
  ['Friends', 'What role does {player_name} play in a group trip?', ['The planner', 'The navigator', 'The entertainer', 'The snack manager']],
  ['Friends', 'What would {player_name} remember from a great party?', ['The conversations', 'The music', 'The food', 'One hilarious moment']],
  ['Friends', 'How would {player_name} cheer up a friend?', ['Listen quietly', 'Send memes', 'Plan an outing', 'Bring food']],
  ['Couples', 'Which date would {player_name} enjoy most?', ['Cozy dinner', 'Adventure activity', 'Live show', 'Sunset walk']],
  ['Couples', 'Which small gesture would charm {player_name}?', ['A favorite snack', 'A handwritten note', 'A planned surprise', 'A perfect playlist']],
  ['Family', 'What is {player_name} most likely to bring to a family gathering?', ['A signature dish', 'A game', 'Family gossip', 'A last-minute excuse']],
  ['Family', 'Which family tradition would {player_name} happily lead?', ['Holiday cooking', 'Photo day', 'Game night', 'Travel planning']],
  ['Office', 'What is {player_name} secretly best at during meetings?', ['Finding solutions', 'Reading the room', 'Taking clear notes', 'Keeping everyone awake']],
  ['Office', 'Which desk upgrade would {player_name} choose?', ['A standing desk', 'A coffee machine', 'A giant monitor', 'A cozy chair']],
  ['Office', 'How would {player_name} celebrate finishing a huge project?', ['Team dinner', 'A day off', 'Quiet satisfaction', 'An elaborate victory dance']],
  ['Office', 'Which work message describes {player_name}?', ['Already done', 'Quick question', 'Let’s simplify', 'Coffee first']],
  ['Mixed', 'What would {player_name} buy first if money were no object?', ['A dream home', 'A world tour', 'A luxury car', 'A creative studio']],
  ['Mixed', 'Which word best describes {player_name} on a good day?', ['Curious', 'Reliable', 'Playful', 'Ambitious']],
] as const;

const twists = ['', ' — no overthinking!', ' if they had to decide today?', ' when nobody is judging?'];

export const questions: GameQuestion[] = prompts.flatMap(([category, text, options], promptIndex) =>
  twists.map((twist, twistIndex) => ({
    id: `q-${promptIndex + 1}-${twistIndex + 1}`,
    category,
    text: `${text}${twist}`,
    options: [...options] as [string, string, string, string],
  })),
);
