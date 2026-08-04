import type { Question } from '@/types/exam';
import { q1, q2, q3, q4, q5 } from '@/assets/audio';

export const questionsPart1: Question[] = [
  {
    id: 1,
    dialogue: `P: Delivery, CCA273, confirm frequency for airport service, we need re-catering.\nC: CCA273, Delivery, contact Apron on 119.25.`,
    question: 'What service does CCA273 need?',
    audio: q1,
    options: [
      { label: 'A', text: 'Refueling.' },
      { label: 'B', text: 'Mechanical service.' },
      { label: 'C', text: 'Food delivery.' },
      { label: 'D', text: 'Medical.' },
    ],
    correctAnswer: 'C',
    explanation: 'CCA273 said "we need re-catering", which means they need food delivery service.',
  },
  {
    id: 2,
    dialogue: `C: N204DT, Wuhan GND, you are on the wrong taxiway, continue taxi and via R5, C8, K to holding point of RWY05L.\nP: Continue taxi, via R5, C8 and K to holding point, RWY05L, N204DT`,
    question: 'How should N204DT taxi?',
    audio: q2,
    options: [
      { label: 'A', text: 'R8, C5, K to holding point, RWY05R' },
      { label: 'B', text: 'R5, C8, K to holding point, RWY05R' },
      { label: 'C', text: 'R8, K5, C to holding point, RWY05L' },
      { label: 'D', text: 'R5, C8, K to holding point, RWY05L' },
    ],
    correctAnswer: 'D',
    explanation: 'The controller instructed "via R5, C8, K to holding point of RWY05L" and the pilot correctly read back.',
  },
  {
    id: 3,
    dialogue: `P: PANPAN, PANPAN, PANPAN, control, DLH975, we have a passenger had a stroke, we've managed to stabilize his condition, but we need to divert immediately.\nC: DLH975, control, roger PANPAN, say your intentions.\nP: Request divert to Wuhan, DLH975.`,
    question: 'Why is DLH975 making an urgency call?',
    audio: q3,
    options: [
      { label: 'A', text: 'Because a passenger is stabilized.' },
      { label: 'B', text: 'Because a passenger had a stroke.' },
      { label: 'C', text: 'Because a passenger is dying.' },
      { label: 'D', text: 'Because a passenger is suffocating.' },
    ],
    correctAnswer: 'B',
    explanation: 'The pilot reported "we have a passenger had a stroke" as the reason for the PANPAN urgency call.',
  },
  {
    id: 4,
    dialogue: `C: NWA441, Wuhan app, radar contact, follow XSH-02 Arrival, expect ILS approach, RWY36R, descent to 3600m, Info U.\nP: Roger, XSH-01 Arrival, ILS approach, say again after RWY36R. NWA441.\nC: NWA441, XSH-02 Arrival, descend to 3600m, Info U.`,
    question: 'What mistake did the pilot make during the readback?',
    audio: q4,
    options: [
      { label: 'A', text: 'Wrong about Arrival and missed altitude and Info.' },
      { label: 'B', text: 'Wrong about callsign and missed altitude and Arrival.' },
      { label: 'C', text: 'Wrong about altitude and Info.' },
      { label: 'D', text: 'Wrong about Arrival and missed Info.' },
    ],
    correctAnswer: 'A',
    explanation: 'The pilot said "XSH-01" instead of "XSH-02" (wrong Arrival) and missed "descent to 3600m" and "Info U".',
  },
  {
    id: 5,
    dialogue: `P: Control, CES8801, we have traffic indication at 1 o'clock, 12nm, 600m below us, it's climbing rapidly, confirm.\nC: CES8801, it's a military aircraft, reduce speed to 270knots, maintain 8900m.`,
    question: 'Where is the military aircraft?',
    audio: q5,
    options: [
      { label: 'A', text: "900m below, 2 o'clock, 12nm, climbing." },
      { label: 'B', text: "600m below, 1 o'clock, 12nm, descending." },
      { label: 'C', text: "1 o'clock, 12nm, 600m below, climbing." },
      { label: 'D', text: "1 o'clock, 12nm, 600m above, climbing." },
    ],
    correctAnswer: 'C',
    explanation: 'The pilot reported traffic at "1 o\'clock, 12nm, 600m below us, climbing rapidly".',
  },
];

export const ANSWER_TIME_PART1 = 5;
export const AUDIO_DELAY = 1.5;
