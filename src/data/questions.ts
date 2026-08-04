import type { Question } from '@/types/exam';

// 共用对话音频（对话 + q13 合并，避免切换刷新）
export const dialogueAudio = '/dialogue_q13_merged.mp3';

// 13-15题
export const questions: Question[] = [
  {
    id: 13,
    dialogue: `P: Wuhan Tower, CSN803, 12nm final, established ILS, RWY36.\nC: CSN803, Wuhan Tower, continue approach, reduce speed to 150kts, report outer marker.\nP: Continue approach, speed 150kts, report outer marker, CSN803.\nC: CSN803, Tower, cleared to land, RWY36, wind 030, 7m/s, gusting up to 16m/s. QNH1032.\nP: Cleared to land, RWY36, QNH1032, thanks, CSN803.\nP: Tower, CSN803, we had a tail strike during landing due to unstable wind, APU and main gear damaged. Unable to vacate runway, Request a tug to tow us back.\nC: CSN803, roger, tug is on the way. Break Break. AFR123, go around, I say again, go around, runway occupied due to aircraft unable to vacate.\nP: Going around, AFR123.\nP: Tower, AFR123, we have 2 passengers injured during the missed approach, request an ambulance upon arrival.\nC: AFR123, roger, contact Wuhan Approach on 124.85.\nP: Approach, 124.85, AFR123.`,
    question: 'Why did CSN803 encounter a tail strike?',
    audio: '/q13.mp3',
    options: [
      { label: 'A', text: 'The gust was too strong.' },
      { label: 'B', text: 'The APU was failed.' },
      { label: 'C', text: 'The speed of the aircraft was too slow.' },
      { label: 'D', text: 'The surface wind was unstable.' },
    ],
    correctAnswer: 'D',
    explanation: 'The pilot said "we had a tail strike during landing due to unstable wind".',
  },
  {
    id: 14,
    dialogue: '(same as Question 13)',
    question: "What was the consequences of CSN 803's tail strike?",
    audio: '/q14.mp3',
    options: [
      { label: 'A', text: 'Landing gear failure, fire.' },
      { label: 'B', text: 'APU and main gear damage, unable to taxi.' },
      { label: 'C', text: 'Main gear damage and APU failure.' },
      { label: 'D', text: 'Passenger injuries.' },
    ],
    correctAnswer: 'B',
    explanation: 'The pilot reported "APU and main gear damaged. Unable to vacate runway".',
  },
  {
    id: 15,
    dialogue: '(same as Question 13)',
    question: "What was AFR123's request after the missed approach?",
    audio: '/q15.mp3',
    options: [
      { label: 'A', text: 'AFR123 requested to contact 124.85.' },
      { label: 'B', text: 'AFR123 requested medical service.' },
      { label: 'C', text: 'AFR123 requested a tug.' },
      { label: 'D', text: 'AFR123 requested another approach.' },
    ],
    correctAnswer: 'B',
    explanation: 'The pilot said "we have 2 passengers injured... request an ambulance upon arrival".',
  },
];

// 作答时间（秒）
export const ANSWER_TIME = 5;
