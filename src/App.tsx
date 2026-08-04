import { useState, useCallback, useRef } from 'react';
import StartScreen from '@/sections/StartScreen';
import Part1Screen from '@/sections/Part1Screen';
import Part2ShortAnswerScreen from '@/sections/Part2ShortAnswerScreen';
import ResultScreen from '@/sections/ResultScreen';
import NotebookScreen from '@/sections/NotebookScreen';
import FavoritesScreen from '@/sections/FavoritesScreen';
import type { ExamResult, ExamStatus, ShortAnswerResult, StoryTellingResult, SimulationResult, OPIResult, Part1Result, Part1Answer, Question } from '@/types/exam';
import Part3StoryScreen from '@/sections/Part3StoryScreen';
import Part4SimulationScreen from '@/sections/Part4SimulationScreen';
import Part5OPIScreen from '@/sections/Part5OPIScreen';
import { syncPart1Result } from '@/lib/persistence/notebook';
import { addHistoryRecord, clearInProgress, getInProgress, setInProgress } from '@/lib/persistence/history';

/** 完整的AETS考试流程阶段 */
type ExamPhase =
  | 'part1-listening'   // 第一部分：听力理解 (Q1-Q15)
  | 'part2-retelling'   // 第二部分：故事复述
  | 'part3-shortanswer' // 第三部分：听力简答
  | 'part4-simulation'  // 第四部分：模拟通话
  | 'part5-opi';        // 第五部分：口语面试

export default function App() {
  const [examStatus, setExamStatus] = useState<ExamStatus>('idle');
  const [examPhase, setExamPhase] = useState<ExamPhase>('part1-listening');
  // 首页之外的本地功能视图（错题本/收藏），不引入路由
  const [view, setView] = useState<'home' | 'notebook' | 'favorites'>('home');
  const [results, setResults] = useState<Record<string, ExamResult>>({} as Record<string, ExamResult>);
  const [finalResult, setFinalResult] = useState<ExamResult | null>(null);
  // Part 1 题目详情（对话原文/题目/选项），用于结果页答案解析展示
  const [part1Questions, setPart1Questions] = useState<Question[]>([]);
  // Part 1 原始作答明细（含 groupId/bankQNo/对话音频），用于结果页收藏与回放
  const [part1Answers, setPart1Answers] = useState<Part1Answer[]>([]);
  // 单独测试第一部分的标志
  const [isPart1Only, setIsPart1Only] = useState(false);
  // 保存第三部分（听力简答）的录音数据
  const [shortAnswerResult, setShortAnswerResult] = useState<ShortAnswerResult | null>(null);
  // 保存第二部分（故事复述）的录音数据（通过 setter 存入，提交时读取）
  const storyTellingRef = useRef<StoryTellingResult | null>(null);
  // Part 1 考试说明音频（在 user gesture 中启动，跨组件传递）
  const directionsAudioRef = useRef<HTMLAudioElement | null>(null);

  // 开始完整考试（第一部分 Q1-Q15）
  const handleStartFull = useCallback(() => {
    // 开始新考试即放弃旧的续做快照
    clearInProgress();
    setView('home');
    setExamStatus('playing');
    setExamPhase('part1-listening');
    setIsPart1Only(false);
    setResults({});
    setFinalResult(null);
    setPart1Answers([]);
    setShortAnswerResult(null);
    storyTellingRef.current = null;
    // 在 user gesture 内启动 Part 1 考试说明音频
    directionsAudioRef.current?.pause();
    const audio = new Audio('/part1_directions.mp3');
    directionsAudioRef.current = audio;
    audio.play().catch(() => {});
  }, []);

  // 仅测试第一部分：听力理解
  const handleStartPart1Only = useCallback(() => {
    clearInProgress();
    setView('home');
    setExamStatus('playing');
    setExamPhase('part1-listening');
    setIsPart1Only(true);
    setResults({});
    setFinalResult(null);
    setPart1Answers([]);
    directionsAudioRef.current?.pause();
    const audio = new Audio('/part1_directions.mp3');
    directionsAudioRef.current = audio;
    audio.play().catch(() => {});
  }, []);

  // 仅测试第二部分：故事复述
  const handleStartPart2Only = useCallback(() => {
    clearInProgress();
    setView('home');
    setExamStatus('playing');
    setExamPhase('part2-retelling');
    setResults({});
    setFinalResult(null);
  }, []);

  // 仅测试第三部分：听力简答
  const handleStartPart3Only = useCallback(() => {
    clearInProgress();
    setView('home');
    setExamStatus('playing');
    setExamPhase('part3-shortanswer');
    setResults({});
    setFinalResult(null);
  }, []);

  // 仅测试第四部分：模拟通话
  const handleStartPart4Only = useCallback(() => {
    clearInProgress();
    setView('home');
    setExamStatus('playing');
    setExamPhase('part4-simulation');
    setResults({});
    setFinalResult(null);
  }, []);

  // 仅测试第五部分：OPI
  const handleStartPart5Only = useCallback(() => {
    clearInProgress();
    setView('home');
    setExamStatus('playing');
    setExamPhase('part5-opi');
    setResults({});
    setFinalResult(null);
  }, []);

  // ===== 第五部分：OPI =====
  const handleOPICComplete = useCallback((result: OPIResult) => {
    console.log('OPI完成:', result);
    // 历史记录（单项·第五部分）
    const opiAssessments = Object.values(result.assessments ?? {});
    addHistoryRecord({
      mode: '单项·第五部分 口语面试',
      summaries: [
        { label: '完成', value: `${result.completedQuestions}/${result.totalQuestions} 题` },
        ...(opiAssessments.length > 0
          ? [{ label: '总分', value: `${opiAssessments.reduce((s, a) => s + a.totalScore, 0)}/${opiAssessments.length * 25}` }]
          : []),
      ],
    });
    setExamStatus('submitted');
    setFinalResult({
      totalQuestions: result.totalQuestions,
      correctCount: result.completedQuestions,
      score: Math.round((result.completedQuestions / result.totalQuestions) * 100),
      answers: [],
    });
  }, []);

  // ===== 第一部分：听力理解 (Q1-Q15，从10套题中分层随机组卷) =====

  const handlePart1Submit = useCallback((result: Part1Result) => {
    // 进入下一部分前停止考试说明音频（防止仍播放）
    directionsAudioRef.current?.pause();
    directionsAudioRef.current = null;
    // 错题本同步：答错写入/更新，答对自动移出
    syncPart1Result(result.answers);
    // 转换为ExamResult格式存入results
    const examResult: ExamResult = {
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
      score: result.score,
      answers: result.answers.map((a) => ({
        questionId: a.qNo,
        selectedOption: a.userAnswer,
        correctOption: a.correctAnswer,
        isCorrect: a.isCorrect,
      })),
    };
    setResults((prev) => ({ ...prev, 'part1': examResult }));
    // 题目详情（对话原文/题目/选项），供结果页答案解析展示
    const questions: Question[] = result.answers.map((a) => ({
      id: a.qNo,
      dialogue: a.dialogue,
      question: a.questionText,
      audio: a.dialogueAudio ?? '',
      options: a.options.map((o) => ({ label: o.charAt(0), text: o.replace(/^[A-D]\.\s*/, '') })),
      correctAnswer: a.correctAnswer,
      explanation: a.explanation ?? '',
    }));
    setPart1Questions(questions);
    // 原始作答明细（含 groupId/bankQNo/对话音频），供结果页收藏与回放
    setPart1Answers(result.answers);

    if (isPart1Only) {
      // 单独测试第一部分：直接显示结果，并写入历史记录
      addHistoryRecord({
        mode: '单项·第一部分 听力理解',
        summaries: [{ label: '听力理解', value: `${result.correctCount}/${result.totalQuestions}` }],
      });
      setExamStatus('submitted');
      setFinalResult(examResult);
    } else {
      // 完整流程：写入中断续做快照（Part 1 完成，下次从 Part 2 继续）
      setInProgress({
        completedParts: 1,
        nextPhase: 'part2-retelling',
        savedAt: Date.now(),
        results: { part1: examResult },
        part1Questions: questions,
        storyTelling: null,
        shortAnswer: null,
      });
      setExamPhase('part2-retelling');
    }
  }, [isPart1Only]);

  // ===== 第二部分：故事复述 =====
  const handleStoryTellingComplete = useCallback((result: StoryTellingResult) => {
    storyTellingRef.current = result;
    // 更新续做快照（录音 Blob 不持久化，仅存文本与评分元数据）
    const stripped = { ...result };
    delete stripped.recordingBlob;
    setInProgress({
      completedParts: 2,
      nextPhase: 'part3-shortanswer',
      savedAt: Date.now(),
      results,
      part1Questions,
      storyTelling: stripped,
      shortAnswer: null,
    });
    // 进入第三部分：听力简答
    setExamPhase('part3-shortanswer');
  }, [results, part1Questions]);

  // ===== 第三部分：听力简答 =====
  const handleShortAnswerComplete = useCallback((result: ShortAnswerResult) => {
    setShortAnswerResult(result);
    // 更新续做快照（recordings 含 Blob，置空不持久化；故事复述的 recordingBlob 同样剔除）
    const sr = storyTellingRef.current;
    let strippedStory: Omit<StoryTellingResult, 'recordingBlob'> | null = null;
    if (sr) {
      const copy = { ...sr };
      delete copy.recordingBlob;
      strippedStory = copy;
    }
    setInProgress({
      completedParts: 3,
      nextPhase: 'part4-simulation',
      savedAt: Date.now(),
      results,
      part1Questions,
      storyTelling: strippedStory,
      shortAnswer: { ...result, recordings: [] },
    });
    // 进入第四部分：模拟通话
    setExamPhase('part4-simulation');
  }, [results, part1Questions]);

  // ===== 第四部分：模拟通话 =====
  const handleSimulationComplete = useCallback((result: SimulationResult) => {
    // 所有部分完成，提交全部数据
    submitAllResults(storyTellingRef.current, result);
  }, []);

  // ===== 提交所有考试结果（包括录音）=====
  const submitAllResults = useCallback((storyResult: StoryTellingResult | null, simResult: SimulationResult) => {
    setExamStatus('submitted');

    // 构建完整提交数据包
    const submission = {
      part1Listening: results,
      part2StoryTelling: storyResult,
      part3ShortAnswer: shortAnswerResult,
      part4Simulation: simResult,
    };

    console.log('=== 考试结果提交 ===', submission);
    console.log('Part 2 录音时长:', storyResult?.recordingDuration || 0);
    console.log('Part 3 录音数量:', shortAnswerResult?.recordings?.length || 0);
    console.log('Part 4 录音轮数:', simResult?.completedRounds || 0);

    // TODO: 实际项目中在这里调用 API 上传到服务器

    // 历史记录（完整考试）：各部分结果摘要
    const summaries: { label: string; value: string }[] = [];
    const p1 = results['part1'];
    if (p1) summaries.push({ label: '听力理解', value: `${p1.correctCount}/${p1.totalQuestions}` });
    if (storyResult?.assessment) summaries.push({ label: '故事复述', value: `${storyResult.assessment.totalScore}/25` });
    const p3Assessments = (shortAnswerResult?.materials ?? []).flatMap((m) => m.questions.map((q) => q.assessment).filter((a): a is NonNullable<typeof a> => !!a));
    if (p3Assessments.length > 0) {
      summaries.push({ label: '听力简答', value: `${p3Assessments.reduce((s, a) => s + a.totalScore, 0)}/${p3Assessments.length * 25}` });
    }
    const p4Assessments = Object.values(simResult.assessments ?? {});
    if (p4Assessments.length > 0) {
      summaries.push({ label: '模拟通话', value: `${p4Assessments.reduce((s, a) => s + a.totalScore, 0)}/${p4Assessments.length * 25}` });
    }
    addHistoryRecord({ mode: '完整考试', summaries });
    // 流程结束，清除续做快照
    clearInProgress();

    const correctCount = Object.values(results).reduce(
      (sum, r) => sum + (r?.correctCount || 0), 0
    );
    setFinalResult({
      totalQuestions: 15,
      correctCount,
      score: Math.round((correctCount / 15) * 100),
      answers: [],
    });
  }, [results, shortAnswerResult]);

  // ===== 继续上次考试（部分级快照续做：恢复已完成部分结果，进入下一未完成部分）=====
  const handleResumeExam = useCallback(() => {
    const snapshot = getInProgress();
    if (!snapshot) return;
    setResults(snapshot.results);
    setPart1Questions(snapshot.part1Questions);
    setPart1Answers([]);
    storyTellingRef.current = snapshot.storyTelling;
    setShortAnswerResult(snapshot.shortAnswer);
    setFinalResult(null);
    setIsPart1Only(false);
    setView('home');
    setExamPhase(snapshot.nextPhase);
    setExamStatus('playing');
  }, []);

  // ===== 结果显示 =====
  const handleRestart = useCallback(() => {
    directionsAudioRef.current?.pause();
    directionsAudioRef.current = null;
    setExamStatus('idle');
    setExamPhase('part1-listening');
    setIsPart1Only(false);
    setView('home');
    setResults({});
    setFinalResult(null);
    setPart1Questions([]);
    setPart1Answers([]);
    setShortAnswerResult(null);
    storyTellingRef.current = null;
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {examStatus === 'idle' && view === 'home' && (
        <StartScreen
          onStartFull={handleStartFull}
          onStartPart1Only={handleStartPart1Only}
          onStartPart2Only={handleStartPart2Only}
          onStartPart3Only={handleStartPart3Only}
          onStartPart4Only={handleStartPart4Only}
          onStartPart5Only={handleStartPart5Only}
          onOpenNotebook={() => setView('notebook')}
          onOpenFavorites={() => setView('favorites')}
          onResumeExam={handleResumeExam}
        />
      )}

      {/* 错题本 / 收藏（本地功能视图，从首页进入） */}
      {examStatus === 'idle' && view === 'notebook' && (
        <NotebookScreen onBack={() => setView('home')} />
      )}
      {examStatus === 'idle' && view === 'favorites' && (
        <FavoritesScreen onBack={() => setView('home')} />
      )}

      {/* 第一部分：听力理解 (Q1-Q15，从10套题中分层随机组卷) */}
      {examStatus === 'playing' && examPhase === 'part1-listening' && (
        <Part1Screen
          singleMode={isPart1Only}
          onComplete={handlePart1Submit}
          directionsAudio={directionsAudioRef.current}
        />
      )}

      {/* 第二部分：故事复述 */}
      {examStatus === 'playing' && examPhase === 'part2-retelling' && (
        <Part3StoryScreen key={`p2-${Date.now()}`} onComplete={handleStoryTellingComplete} />
      )}

      {/* 第三部分：听力简答 */}
      {examStatus === 'playing' && examPhase === 'part3-shortanswer' && (
        <Part2ShortAnswerScreen key={`p3-${Date.now()}`} onComplete={handleShortAnswerComplete} />
      )}

      {/* 第四部分：模拟通话 */}
      {examStatus === 'playing' && examPhase === 'part4-simulation' && (
        <Part4SimulationScreen onComplete={handleSimulationComplete} />
      )}

      {/* 第五部分：OPI */}
      {examStatus === 'playing' && examPhase === 'part5-opi' && (
        <Part5OPIScreen onComplete={handleOPICComplete} />
      )}

      {examStatus === 'submitted' && finalResult && (
        <ResultScreen result={finalResult} questions={part1Questions} part1Answers={part1Answers} onRestart={handleRestart} />
      )}
    </div>
  );
}
