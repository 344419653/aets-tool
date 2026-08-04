import type { Question } from '@/types/exam';
import { dialoguePart3, q9, q10, q11, q12 } from '@/assets/audio';

export const dialogueAudio = dialoguePart3;

export const questionsPart3: Question[] = [
  {
    id: 9,
    dialogue: `C: BAW533, Wuhan control, due traffic, offset 4nm left of track, expect rejoin the route at ZF.\nP: Roger, offset 4nm left of track, BAW533.\nP: Control, BAW 533, we have weather indication 25nm ahead of us, request deviate to the left for 11nm.\nC: BAW 533, negative due to prohibited area, can you accept deviation to the right?\nP: Affirm, we need a heading of 150 for 18nm, BAW533.\nC: BAW 533, turn right heading 150, report clear of weather.\nP: Right heading 150, wilco, BAW533.\nP: MAYDAY, MAYDAY, MAYDAY, Wuhan control, BAW533, we encountered lightning strike, and starboard engine is leaking fuel. We are emergency descending to 3600m.\nC: BAW533, Wuhan control, roger MAYDAY, report reaching. Break Break. All stations, Wuhan control, emergency descent between DA and TM, all aircraft below 8200m, leave the route to the west.`,
    question: 'How can BAW533 avoid the weather according to the pilot?',
    audio: q9,
    options: [
      { label: 'A', text: 'Deviate to the left side for 11nm.' },
      { label: 'B', text: 'Deviate to the left side for 25nm.' },
      { label: 'C', text: 'Deviate to the right side for 18nm.' },
      { label: 'D', text: 'Heading 150 for 11nm.' },
    ],
    correctAnswer: 'C',
    explanation: 'The pilot accepted deviation to the right with heading 150 for 18nm after the controller denied left deviation due to prohibited area.',
  },
  {
    id: 10,
    dialogue: '(same as Question 9)',
    question: "Why can't BAW533 detour the weather from the left side?",
    audio: q10,
    options: [
      { label: 'A', text: 'Because there is a restricted area.' },
      { label: 'B', text: 'Because there is a prohibited area.' },
      { label: 'C', text: 'Because there is military activity.' },
      { label: 'D', text: 'Because there is a lightning strike.' },
    ],
    correctAnswer: 'B',
    explanation: "The controller said 'negative due to prohibited area'.",
  },
  {
    id: 11,
    dialogue: '(same as Question 9)',
    question: 'What happened to BAW 533?',
    audio: q11,
    options: [
      { label: 'A', text: 'BAW533 encountered fuel leakage due to lightning strike.' },
      { label: 'B', text: 'BAW533 encountered lightning strike and engine fire.' },
      { label: 'C', text: 'BAW533 encountered port engine failure.' },
      { label: 'D', text: 'BAW533 encountered emergency descent.' },
    ],
    correctAnswer: 'A',
    explanation: 'The pilot reported "we encountered lightning strike, and starboard engine is leaking fuel".',
  },
  {
    id: 12,
    dialogue: '(same as Question 9)',
    question: 'Where is BAW 533 when he started emergency descent?',
    audio: q12,
    options: [
      { label: 'A', text: '15nm right of the route at 8200m.' },
      { label: 'B', text: 'Between DA and TM at 8200m.' },
      { label: 'C', text: 'West of DA and TM at 3600m.' },
      { label: 'D', text: 'Between DA and TM at 3600m.' },
    ],
    correctAnswer: 'B',
    explanation: "The controller announced 'emergency descent between DA and TM'. BAW533 was between DA and TM before descending to 3600m.",
  },
];

export const ANSWER_TIME_PART3 = 5;
