import { ttsSave } from 'edge-tts';

const text =
  'In this part, you are going to hear a dialogue or exchange, after the exchange, there will be a question. After each question, you have 5 seconds to think and choose the correct answer. You will hear each question only once.';

async function main() {
  await ttsSave(text, 'public/part1_directions.mp3', {
    voice: 'en-US-AriaNeural',
    rate: '-10%',
  });
  console.log('Generated public/part1_directions.mp3');
}

main().catch((err) => {
  console.error('Failed to generate audio:', err);
  process.exit(1);
});
