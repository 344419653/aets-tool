import type { OPIQuestion } from '@/types/exam';

// ===== OPI 考官语音导入 =====
import {
  // Warm-up
  opening_greeting,
  warmup_daily,
  warmup_hobby,
  warmup_family,
  // Level Checks
  transition_to_topic,
  topic_duty,
  topic_shift,
  topic_teamwork,
  topic_career,
  topic_challenge,
  topic_weather,
  topic_tech,
  topic_emergency,
  topic_pilot_comm,
  topic_safety,
  topic_flow,
  topic_airport_ops,
  topic_training,
  // Picture
  transition_to_picture,
  pic_apron,
  pic_takeoff,
  pic_weather,
  pic_emergency,
  pic_tower,
  // Probes
  transition_to_opinion,
  transition_to_situ,
  topic_balance,
  topic_language,
  topic_automation,
  topic_culture,
  topic_env,
  topic_future,
  situ_pilot,
  situ_hydraulic,
  situ_delay,
  situ_incursion,
  situ_medical,
  situ_lostcomm,
  // Wind-down
  closing_feedback,
} from '@/assets/audio/part5';

/** OPI 考试题目集（含考官语音） */
export const opiQuestions: OPIQuestion[] = [
  // ===== 阶段1: Warm-up 热身 =====
  {
    id: 1,
    phase: 'warmup',
    question: "Hello, I'm your OPI examiner today. Can you tell me your name and your ID number?",
    questionCn: "你好，我是你今天的OPI考官。请告诉我你的姓名和身份证号。",
    audio: opening_greeting,
    prepareTime: 5,
    answerTime: 30,
  },
  {
    id: 2,
    phase: 'warmup',
    question: "Can you tell me a little about yourself? What do you usually do in your daily life?",
    questionCn: "请简单介绍一下你自己。你日常生活中通常做什么？",
    audio: warmup_daily,
    prepareTime: 5,
    answerTime: 45,
  },
  {
    id: 3,
    phase: 'warmup',
    question: "What do you like to do in your free time? Do you have any hobbies?",
    questionCn: "你空闲时间喜欢做什么？有什么爱好吗？",
    audio: warmup_hobby,
    prepareTime: 5,
    answerTime: 45,
  },
  {
    id: 4,
    phase: 'warmup',
    question: "Tell me about your family.",
    questionCn: "谈谈你的家庭。",
    audio: warmup_family,
    prepareTime: 5,
    answerTime: 45,
  },

  // ===== 阶段2: Level Checks 程度检验 =====
  {
    id: 5,
    phase: 'levelcheck',
    question: "Now let's move on to some topics. Tell me about your job as an air traffic controller. What are your main duties?",
    questionCn: "现在我们来谈谈一些话题。说说你作为空中交通管制员的工作。你的主要职责是什么？",
    audio: transition_to_topic,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 6,
    phase: 'levelcheck',
    question: "What are your main duties as an air traffic controller?",
    questionCn: "你作为空中交通管制员的主要职责是什么？",
    audio: topic_duty,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 7,
    phase: 'levelcheck',
    question: "Do you work shifts? Tell me about your shift schedule.",
    questionCn: "你轮班工作吗？说说你的轮班安排。",
    audio: topic_shift,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 8,
    phase: 'levelcheck',
    question: "How do you work with your team? Tell me about teamwork in your workplace.",
    questionCn: "你如何与团队合作？说说你工作场所的团队合作情况。",
    audio: topic_teamwork,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 9,
    phase: 'levelcheck',
    question: "What are your career plans? Where do you see yourself in five years?",
    questionCn: "你的职业规划是什么？你预计未来五年自己会在哪里？",
    audio: topic_career,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 10,
    phase: 'levelcheck',
    question: "What is the biggest challenge in your job?",
    questionCn: "你工作中最大的挑战是什么？",
    audio: topic_challenge,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 11,
    phase: 'levelcheck',
    question: "How does weather affect your work as an air traffic controller?",
    questionCn: "天气如何影响你作为空中交通管制员的工作？",
    audio: topic_weather,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 12,
    phase: 'levelcheck',
    question: "What technology do you use in your work? How has technology changed air traffic control?",
    questionCn: "你在工作中使用什么技术？技术如何改变了空中交通管制？",
    audio: topic_tech,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 13,
    phase: 'levelcheck',
    question: "Have you ever dealt with an emergency situation? Tell me about it.",
    questionCn: "你有没有处理过紧急情况？说说看。",
    audio: topic_emergency,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 14,
    phase: 'levelcheck',
    question: "How do you communicate with pilots? What is important in pilot-controller communication?",
    questionCn: "你如何与飞行员沟通？在飞行员与管制员通信中什么很重要？",
    audio: topic_pilot_comm,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 15,
    phase: 'levelcheck',
    question: "What is the most important thing for safety in air traffic control?",
    questionCn: "空中交通管制中安全最重要的是什么？",
    audio: topic_safety,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 16,
    phase: 'levelcheck',
    question: "How do you manage traffic flow during peak hours?",
    questionCn: "高峰时段你如何管理交通流量？",
    audio: topic_flow,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 17,
    phase: 'levelcheck',
    question: "Tell me about airport operations. What do you know about how airports work?",
    questionCn: "说说机场运行。你对机场如何运作了解多少？",
    audio: topic_airport_ops,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 18,
    phase: 'levelcheck',
    question: "What kind of training have you received? How do you keep your skills up to date?",
    questionCn: "你接受过什么样的培训？你如何保持技能更新？",
    audio: topic_training,
    prepareTime: 10,
    answerTime: 60,
  },

  // ===== 阶段3: Picture Description 看图说话 =====
  {
    id: 19,
    phase: 'picture',
    question: "Now, I'm going to show you a picture. Please describe it in as much detail as possible. What do you see?",
    questionCn: "现在我要给你看一张图片。请尽可能详细地描述它。你看到了什么？",
    audio: transition_to_picture,
    prepareTime: 10,
    answerTime: 60,
  },
  {
    id: 20,
    phase: 'picture',
    question: "Look at this picture of an airport apron. Describe what you see in detail.",
    questionCn: "看这张机场停机坪的图片。详细描述你看到了什么。",
    audio: pic_apron,
    prepareTime: 10,
    answerTime: 90,
  },
  {
    id: 21,
    phase: 'picture',
    question: "This picture shows an aircraft taking off. Describe the scene and what might be happening.",
    questionCn: "这张图片显示一架飞机正在起飞。描述场景以及可能发生的情况。",
    audio: pic_takeoff,
    prepareTime: 10,
    answerTime: 90,
  },
  {
    id: 22,
    phase: 'picture',
    question: "Look at this weather-related picture. Describe the weather conditions and their impact on aviation.",
    questionCn: "看这张与天气相关的图片。描述天气条件及其对航空的影响。",
    audio: pic_weather,
    prepareTime: 10,
    answerTime: 90,
  },
  {
    id: 23,
    phase: 'picture',
    question: "This picture shows an emergency situation. Describe what you see and what actions should be taken.",
    questionCn: "这张图片显示了一个紧急情况。描述你看到了什么以及应该采取什么行动。",
    audio: pic_emergency,
    prepareTime: 10,
    answerTime: 90,
  },
  {
    id: 24,
    phase: 'picture',
    question: "Look at this picture of a control tower. Describe what you see and how it relates to your work.",
    questionCn: "看这张塔台的图片。描述你看到了什么以及它与你工作的关系。",
    audio: pic_tower,
    prepareTime: 10,
    answerTime: 90,
  },

  // ===== 阶段4: Probes 能力侦测 =====
  {
    id: 25,
    phase: 'probe',
    question: "Now I'd like to hear your opinion on some topics. What do you think about the use of AI in air traffic control?",
    questionCn: "现在我想听听你对一些话题的看法。你如何看待人工智能在空中交通管制中的应用？",
    audio: transition_to_opinion,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 26,
    phase: 'probe',
    question: "How do you balance work and life? What do you do to relax after work?",
    questionCn: "你如何平衡工作与生活？下班后你做什么来放松？",
    audio: topic_balance,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 27,
    phase: 'probe',
    question: "Why is English important in aviation? What are the challenges of using English as a global language in ATC?",
    questionCn: "为什么英语在航空中很重要？在空中交通管制中使用英语作为全球语言有什么挑战？",
    audio: topic_language,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 28,
    phase: 'probe',
    question: "What do you think about automation in air traffic control? Will controllers be replaced by machines?",
    questionCn: "你如何看待空中交通管制的自动化？管制员会被机器取代吗？",
    audio: topic_automation,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 29,
    phase: 'probe',
    question: "How do cultural differences affect communication in aviation? Give me an example.",
    questionCn: "文化差异如何影响航空通信？给我一个例子。",
    audio: topic_culture,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 30,
    phase: 'probe',
    question: "What are the environmental challenges facing aviation today? How can the industry reduce its carbon footprint?",
    questionCn: "当今航空业面临哪些环境挑战？该行业如何减少碳足迹？",
    audio: topic_env,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 31,
    phase: 'probe',
    question: "What do you think air traffic control will look like in the future? What changes do you expect?",
    questionCn: "你认为未来的空中交通管制会是什么样子？你预期会有什么变化？",
    audio: topic_future,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 32,
    phase: 'probe',
    question: "Now let's discuss some situations. You are the controller and a pilot reports a hydraulic failure. What would you do?",
    questionCn: "现在我们来讨论一些情境。你是管制员，一名飞行员报告液压故障。你会怎么做？",
    audio: transition_to_situ,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 33,
    phase: 'probe',
    question: "A pilot reports hydraulic failure. What actions would you take as a controller?",
    questionCn: "飞行员报告液压故障。作为管制员你会采取什么行动？",
    audio: situ_hydraulic,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 34,
    phase: 'probe',
    question: "There is a significant delay at your airport. How would you manage the situation and communicate with the pilots?",
    questionCn: "你的机场出现严重延误。你会如何管理这种情况并与飞行员沟通？",
    audio: situ_delay,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 35,
    phase: 'probe',
    question: "You suspect a runway incursion. What are your immediate actions?",
    questionCn: "你怀疑发生了跑道入侵。你的即时行动是什么？",
    audio: situ_incursion,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 36,
    phase: 'probe',
    question: "A passenger on board has a medical emergency. How would you handle this situation?",
    questionCn: "机上乘客有医疗紧急情况。你会如何处理这种情况？",
    audio: situ_medical,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 37,
    phase: 'probe',
    question: "An aircraft has lost communication. What procedures would you follow?",
    questionCn: "一架飞机失去通信。你会遵循什么程序？",
    audio: situ_lostcomm,
    prepareTime: 15,
    answerTime: 90,
  },
  {
    id: 38,
    phase: 'probe',
    question: "A pilot is disoriented and doesn't follow instructions. How would you handle this?",
    questionCn: "一名飞行员迷失方向且不遵循指令。你会如何处理？",
    audio: situ_pilot,
    prepareTime: 15,
    answerTime: 90,
  },

  // ===== 阶段5: Wind-down 结束 =====
  {
    id: 39,
    phase: 'winddown',
    question: "Thank you for your answers. Do you have any feedback about this interview? That concludes our interview. Good luck!",
    questionCn: "感谢你的回答。你对这次面试有什么反馈吗？面试到此结束。祝你好运！",
    audio: closing_feedback,
    prepareTime: 5,
    answerTime: 30,
  },
];

/** 获取各阶段题目 */
export const getQuestionsByPhase = (phase: OPIQuestion['phase']) =>
  opiQuestions.filter((q) => q.phase === phase);

/** 阶段显示名称 */
export const phaseLabels: Record<OPIQuestion['phase'], string> = {
  warmup: '热身',
  levelcheck: '程度检验',
  picture: '看图说话',
  probe: '能力侦测',
  winddown: '结束',
};

/** 各阶段说明 */
export const phaseDescriptions: Record<OPIQuestion['phase'], string> = {
  warmup: '简单的自我介绍和日常话题，帮助你放松并建立交流',
  levelcheck: '检验你的基础语言能力，包括描述、比较和叙述',
  picture: '描述图片内容并表达观点，检验你的观察和表达能力',
  probe: '深度能力侦测，涉及航空专业话题和抽象讨论',
  winddown: '轻松结束对话',
};

/** 每次考试从题库中抽取的题目数量配置 */
const EXAM_CONFIG: Record<OPIQuestion['phase'], number> = {
  warmup: 2,
  levelcheck: 4,
  picture: 3,
  probe: 5,
  winddown: 1,
};

/** 从题库中随机抽取指定数量的题目 */
const shuffleArray = <T>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/** 生成考试题目（固定15题，从39题题库中抽取） */
export const generateExamQuestions = (): OPIQuestion[] => {
  const exam: OPIQuestion[] = [];

  for (const [phase, count] of Object.entries(EXAM_CONFIG) as [OPIQuestion['phase'], number][]) {
    const pool = opiQuestions.filter((q) => q.phase === phase);
    // 如果该阶段有过渡语音（transition_开头），优先放入第一题
    const transitionQ = pool.find((q) =>
      q.audio?.includes('transition')
    );
    const nonTransitionPool = pool.filter((q) =>
      !q.audio?.includes('transition')
    );

    const selected: OPIQuestion[] = [];

    // 如果有过渡语音且需要多道题，先放入过渡语音
    if (transitionQ && count >= 2) {
      selected.push(transitionQ);
      const remaining = shuffleArray(nonTransitionPool).slice(0, count - 1);
      selected.push(...remaining);
    } else {
      const shuffled = shuffleArray(pool);
      selected.push(...shuffled.slice(0, count));
    }

    exam.push(...selected);
  }

  return exam;
};
