import type { Question } from '@/types/exam';
import { dialoguePart2, q6, q7, q8 } from '@/assets/audio';

export const dialogueAudio = dialoguePart2;

export const questionsPart2: Question[] = [
  {
    id: 6,
    dialogue: `P: Tower, JAL406, ready.\nC: JAL406, cleared for takeoff, RWY18, surface wind calm, after airborne, contact Departure on 124.75.\nP: Cleared for takeoff, Dep 124.75, JAL406.\nP: Tower, JAL406, 300m climbing. We had a bird strike and the co-pilot is injured, request return to land.\nC: JAL406, roger, continue runway heading, turn right after 900m, do you need any assistance?\nP: Continue runway heading, turn right after 900m, request a doctor upon landing, JAL406.\nC: Roger, JAL406, doctor will be ready for you. Contact Approach 127.35.\nP: Approach, 127.35, thanks, JAL406.`,
    question: 'What is the wind condition when JAL406 takes off?',
    audio: q6,
    options: [
      { label: 'A', text: 'Variable.' },
      { label: 'B', text: 'Not clear.' },
      { label: 'C', text: 'Tailwind.' },
      { label: 'D', text: 'No wind.' },
    ],
    correctAnswer: 'D',
    explanation: 'The controller said "surface wind calm", which means no wind.',
  },
  {
    id: 7,
    dialogue: '(same as Question 6)',
    question: 'What happened to JAL406 during takeoff?',
    audio: q7,
    options: [
      { label: 'A', text: 'Bird Ingestion.' },
      { label: 'B', text: 'Bird Strike.' },
      { label: 'C', text: 'Pilot incapacitated.' },
      { label: 'D', text: 'Not sure.' },
    ],
    correctAnswer: 'B',
    explanation: 'The pilot reported "We had a bird strike and the co-pilot is injured".',
  },
  {
    id: 8,
    dialogue: '(same as Question 6)',
    question: 'Which frequency should JAL406 call finally?',
    audio: q8,
    options: [
      { label: 'A', text: '121.5.' },
      { label: 'B', text: '124.85.' },
      { label: 'C', text: '132.35.' },
      { label: 'D', text: '127.35.' },
    ],
    correctAnswer: 'D',
    explanation: 'The controller instructed "Contact Approach 127.35" and the pilot read back "Approach, 127.35".',
  },
];

export const ANSWER_TIME_PART2 = 5;
