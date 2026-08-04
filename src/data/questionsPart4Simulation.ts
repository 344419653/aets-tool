import type { SimulationMaterial, SimulationRound } from '@/types/exam';
import { PART4_KEYWORDS } from '@/data/part4Keywords';

// 支持的模拟场景
export const SIMULATION_SCENARIOS = ['sim1', 'sim2', 'sim3', 'sim4', 'sim5'] as const;
export type SimulationScenario = typeof SIMULATION_SCENARIOS[number];

// 动态导入音频（Vite 的 import.meta.glob）
const audioModules = import.meta.glob<string>('/src/assets/audio/part4_lib/*/*.m4a', {
  eager: true,
  import: 'default',
});

/** 获取音频路径 */
const getAudioPath = (scenario: SimulationScenario, filename: string): string => {
  const path = `/src/assets/audio/part4_lib/${scenario}/${filename}`;
  return audioModules[path] || '';
};

/** manifest.json 分段记录 */
interface ManifestSeg {
  seg: number;
  type: 'pilot' | 'prompt';
  text: string;
  tts_text?: string;
  file: string;
  reference_answer?: string;
}

/** 从 manifest.json 构建 rounds */
const buildRoundsFromManifest = (scenario: SimulationScenario, manifest: ManifestSeg[]): SimulationRound[] => {
  const rounds: SimulationRound[] = [];
  let currentRound: Partial<SimulationRound> = {
    pilotAudios: [],
    pilotScripts: [],
  };
  let roundIndex = 1;

  const pushRound = (backgroundAudio: string, referenceAnswer: string, context?: string) => {
    if (!currentRound.pilotAudios || currentRound.pilotAudios.length === 0) return;
    rounds.push({
      roundIndex: roundIndex++,
      pilotAudios: currentRound.pilotAudios,
      backgroundAudio,
      pilotScripts: currentRound.pilotScripts || [],
      referenceAnswer,
      context: context || (currentRound.pilotScripts || []).join(' '),
      // 关键词在 loadScenario 阶段从 PART4_KEYWORDS 合并，这里先占位
      keywords: [],
    });
    currentRound = {
      pilotAudios: [],
      pilotScripts: [],
    };
  };

  for (const seg of manifest) {
    const audioPath = getAudioPath(scenario, seg.file);

    if (seg.type === 'pilot') {
      // 连续的 pilot 语音合并到同一轮，提示音出现后才算一轮结束
      currentRound.pilotAudios = [...(currentRound.pilotAudios || []), audioPath];
      currentRound.pilotScripts = [...(currentRound.pilotScripts || []), seg.text];
    } else if (seg.type === 'prompt') {
      pushRound(audioPath, seg.reference_answer || '', seg.text);
    }
  }

  return rounds;
};

// 缓存加载的场景数据
const scenarioCache = new Map<SimulationScenario, SimulationMaterial>();

/** 加载指定场景 */
export const loadScenario = async (scenario: SimulationScenario): Promise<SimulationMaterial> => {
  // 检查缓存
  if (scenarioCache.has(scenario)) {
    return scenarioCache.get(scenario)!;
  }

  // 动态加载 manifest.json（使用相对路径以支持 Vite 变量动态导入）
  const manifestModule = await import(`../assets/audio/part4_lib/${scenario}/manifest.json`);
  const manifest = manifestModule.default || manifestModule;

  const rounds = buildRoundsFromManifest(scenario, manifest);
  // 合并关键词数据（scripts/generate-part4-keywords.mjs 生成）
  const kwMap = PART4_KEYWORDS[scenario] ?? {};
  for (const round of rounds) {
    round.keywords = kwMap[round.roundIndex] ?? [];
  }

  const material: SimulationMaterial = {
    id: SIMULATION_SCENARIOS.indexOf(scenario) + 1,
    title: `Simulation ${scenario.toUpperCase()}`,
    introAudio: '', // 暂无 intro
    outroAudio: '', // 暂无 outro
    rounds,
  };

  scenarioCache.set(scenario, material);
  return material;
};

/** 获取所有场景列表 */
export const getScenarioList = () => SIMULATION_SCENARIOS.map((id, index) => ({
  id,
  name: `模拟通话 ${index + 1}`,
  description: `第 ${index + 1} 套模拟通话场景`,
}));

// 默认导出（兼容旧代码）
export const simulationMaterial: SimulationMaterial = {
  id: 1,
  title: 'Simulation Test 1',
  introAudio: '',
  outroAudio: '',
  rounds: [],
};