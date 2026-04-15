/**
 * quiz.js — 模块 1A：学术定位测试
 * 负责：算分逻辑、画像匹配、结果生成
 */

'use strict';

// ─── 维度子键分组 ────────────────────────────────────────────────────────────

/** 每个维度包含的原始分 key，用于归组归一化和雷达图汇总 */
const DIMENSION_GROUPS = {
  DRIVE: ['D_INT', 'D_EXT', 'D_DEPTH', 'D_POLISH', 'D_SOC', 'D_CRED', 'D_STRUCT', 'D_APPLY', 'D_INTERACT'],
  ENV:   ['E_URBAN', 'E_CAMPUS', 'E_COLLAB', 'E_SOLO', 'E_SMALL', 'E_LARGE', 'E_PEER',
          'E_SOC_HIGH', 'E_SOC_MED', 'E_SOC_LOW', 'E_COMP_OK', 'E_COMP_AVOID'],
  RISK:  ['R_HIGH', 'R_MED', 'R_LOW', 'R_DEFER', 'R_FLEXIBLE', 'R_REGRET',
          'R_CREATIVE', 'R_INFORMED', 'R_CONSERVATIVE', 'R_ADAPT_HIGH', 'R_ADAPT_LOW'],
  CAREER: ['C_ACADEMIC', 'C_INDUSTRY', 'C_CORP', 'C_STARTUP', 'C_RETURN', 'C_GLOBAL',
           'C_PHD', 'C_RESEARCH_INST', 'C_BRAND', 'C_LIFESTYLE', 'C_NETWORK', 'C_EXPLORE'],
  IDENTITY: ['I_GLOBAL', 'I_GLOBAL_FULL', 'I_BRIDGE', 'I_HOME_BASED',
             'I_AUTONOMOUS', 'I_FAMILY', 'I_UNCERTAIN', 'I_PRESENT', 'I_CLEAR'],
};

// ─── 8 种画像的原型向量 ──────────────────────────────────────────────────────

/**
 * 每个画像的理想向量（prototype），key 为子维度代号，value 为 0-100 的期望分值。
 * 未列出的 key 默认视为 0（在距离计算时不参与，或视为中性）。
 * 依据：module-1A-dev-spec.md §4 画像类型定义
 */
const ARCHETYPES = {

  SCHOLAR_PIONEER: {
    label: '学术先锋',
    emoji: '🔬',
    D_INT: 85, D_DEPTH: 80,
    R_HIGH: 70, R_CREATIVE: 65,
    C_ACADEMIC: 90, C_PHD: 75,
    E_CAMPUS: 60,
    I_BRIDGE: 65,
  },

  CAREER_ARCHITECT: {
    label: '职业建筑师',
    emoji: '🏗️',
    D_EXT: 80, D_CRED: 60,
    R_MED: 75, R_INFORMED: 65,
    C_INDUSTRY: 85, C_CORP: 75, C_NETWORK: 70,
    E_LARGE: 65, E_COMP_OK: 60,
    I_BRIDGE: 50,
  },

  GLOBAL_NOMAD: {
    label: '全球游牧者',
    emoji: '🌍',
    D_INT: 65, D_SOC: 60,
    R_HIGH: 65, R_ADAPT_HIGH: 85,
    C_GLOBAL: 85, C_LIFESTYLE: 70,
    E_URBAN: 75, E_SOC_HIGH: 70,
    I_GLOBAL: 80, I_GLOBAL_FULL: 75,
  },

  HOME_ANCHOR: {
    label: '归根者',
    emoji: '🏠',
    D_EXT: 60, D_CRED: 65,
    R_LOW: 75, R_ADAPT_LOW: 60, R_CONSERVATIVE: 65,
    C_RETURN: 85, C_INDUSTRY: 60,
    E_SMALL: 60,
    I_HOME_BASED: 80, I_FAMILY: 55,
  },

  EXPLORER_BETA: {
    label: '探索者β',
    emoji: '🧭',
    D_INT: 55, D_SOC: 50,
    R_MED: 60,
    C_EXPLORE: 80, C_LIFESTYLE: 60,
    E_COLLAB: 65, E_SOC_MED: 60,
    I_UNCERTAIN: 70, I_BRIDGE: 55,
  },

  BRAND_HUNTER: {
    label: '品牌猎手',
    emoji: '🏆',
    D_CRED: 85, D_EXT: 70,
    R_DEFER: 75, R_LOW: 60,
    C_BRAND: 85, C_INDUSTRY: 65,
    E_LARGE: 70,
    I_FAMILY: 70, I_UNCERTAIN: 55,
  },

  RISK_HEDGER: {
    label: '风险对冲者',
    emoji: '🛡️',
    D_EXT: 55,
    R_LOW: 85, R_ADAPT_LOW: 70, R_REGRET: 75, R_CONSERVATIVE: 80,
    C_INDUSTRY: 60, C_RETURN: 55,
    E_SMALL: 65,
    I_HOME_BASED: 55, I_FAMILY: 50,
  },

  HYBRID_IDENTITY: {
    label: '双轨探索者',
    emoji: '🔄',
    D_INT: 60, D_EXT: 55,
    R_MED: 65,
    C_ACADEMIC: 50, C_INDUSTRY: 50, C_EXPLORE: 65,
    E_COLLAB: 60,
    I_BRIDGE: 80, I_UNCERTAIN: 65,
  },
};

// ─── 触发特殊标注的阈值 ──────────────────────────────────────────────────────

/** 若 BRAND_HUNTER 距离最近且置信度 > 此值，触发品牌警示提示 */
const BRAND_HUNTER_ALERT_CONFIDENCE = 55;

/** 若 EXPLORER_BETA 或 HYBRID_IDENTITY 为主画像，触发方向澄清对话 */
const DIRECTION_UNCLEAR_ARCHETYPES = new Set(['EXPLORER_BETA', 'HYBRID_IDENTITY']);

/** 两个最近画像距离差小于此值时，触发"混合型"标注 */
const HYBRID_DISTANCE_THRESHOLD = 15;

// ─── 核心算分函数 ────────────────────────────────────────────────────────────

/**
 * 从用户答案中累计各子维度原始分。
 *
 * @param {Object} answers - { questionId: answer }，answer 视题型不同为字符串/数字/数组
 * @param {Array}  questions - quiz-questions.json 中的 questions 数组
 * @returns {Object} rawScores - { D_INT: 4, D_EXT: 2, ... }
 */
function calculateRawScores(answers, questions) {
  const raw = {};

  /** 将一道题的得分对象累加到 raw */
  const accumulate = (scores) => {
    for (const [key, val] of Object.entries(scores)) {
      raw[key] = (raw[key] || 0) + val;
    }
  };

  for (const q of questions) {
    const answer = answers[q.id];
    if (answer === undefined || answer === null) continue;

    switch (q.type) {

      case 'single':
      case 'image_single': {
        const opt = q.options.find(o => o.id === answer);
        if (opt) accumulate(opt.scores);
        break;
      }

      case 'multi_select': {
        // answer 为选中 id 数组
        if (Array.isArray(answer)) {
          for (const optId of answer) {
            const opt = q.options.find(o => o.id === optId);
            if (opt) accumulate(opt.scores);
          }
        }
        break;
      }

      case 'slider': {
        // answer 为数值
        const val = Number(answer);
        for (const rule of q.scoring) {
          const [lo, hi] = rule.range;
          if (val >= lo && val <= hi) {
            accumulate(rule.scores);
            break;
          }
        }
        break;
      }

      case 'scale': {
        // answer 为数值（1-5 或 1-7）
        const val = Number(answer);
        for (const rule of q.scoring) {
          const [lo, hi] = rule.range;
          if (val >= lo && val <= hi) {
            accumulate(rule.scores);
            break;
          }
        }
        break;
      }

      case 'this_or_that': {
        // answer 为 { round1: 'A'|'B', round2: 'A'|'B', ... }
        if (typeof answer !== 'object') break;
        for (const round of q.rounds) {
          const roundKey = `round${round.round}`;
          const choice = answer[roundKey];
          if (!choice) continue;

          // C1 的第二轮有分支逻辑
          if (round.branchCondition) {
            const prevChoice = answer['round1'];
            const branchKey = prevChoice === 'A' ? 'round1_A' : 'round1_B';
            const branchRounds = round.branchCondition[branchKey];
            if (branchRounds && branchRounds[0]) {
              const opt = choice === 'A' ? branchRounds[0].optionA : branchRounds[0].optionB;
              if (opt) accumulate(opt.scores);
            }
          } else {
            const opt = choice === 'A' ? round.optionA : round.optionB;
            if (opt) accumulate(opt.scores);
          }
        }
        break;
      }
    }
  }

  return raw;
}

/**
 * 对单个维度内的子键做 min-max 标准化，返回 0-100 的连续分。
 * 若所有值相等，统一返回 50（中性）。
 *
 * @param {Object} scores - { key: rawValue, ... }
 * @returns {Object} - 同结构，值已归一化为 0-100 整数
 */
function normalizeDimension(scores) {
  const keys = Object.keys(scores);
  if (keys.length === 0) return {};

  const vals = Object.values(scores);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min;

  if (range === 0) {
    // 全部相同，视为中性 50
    return Object.fromEntries(keys.map(k => [k, 50]));
  }

  return Object.fromEntries(
    keys.map(k => [k, Math.round((scores[k] - min) / range * 100)])
  );
}

/**
 * 对全部5个维度的原始分做归一化。
 * 缺失题目（跳题）用同维度其他已有题的平均值补全对应 key。
 *
 * @param {Object} rawScores - calculateRawScores 的输出
 * @returns {Object} normalizedVector - 所有子键归一化后的完整向量
 */
function normalizeAllDimensions(rawScores) {
  const normalized = {};

  for (const [dim, keys] of Object.entries(DIMENSION_GROUPS)) {
    // 取本维度已有分值的均值，用于补全缺失项
    const present = keys.filter(k => rawScores[k] !== undefined);
    const avg = present.length > 0
      ? present.reduce((sum, k) => sum + rawScores[k], 0) / present.length
      : 0;

    // 构建本维度完整得分对象（缺失键用均值补全）
    const dimScores = {};
    for (const k of keys) {
      dimScores[k] = rawScores[k] !== undefined ? rawScores[k] : avg;
    }

    Object.assign(normalized, normalizeDimension(dimScores));
  }

  return normalized;
}

/**
 * 计算雷达图使用的5维汇总分（每维一个 0-100 数值）。
 * 策略：取该维度所有归一化子键的最大值，代表"该维度最突出的特征强度"。
 *
 * @param {Object} normalizedVector - normalizeAllDimensions 的输出
 * @returns {Object} - { DRIVE, ENV, RISK, CAREER, IDENTITY }，各为 0-100 整数
 */
function computeRadarScores(normalizedVector) {
  const radar = {};
  for (const [dim, keys] of Object.entries(DIMENSION_GROUPS)) {
    const vals = keys
      .filter(k => normalizedVector[k] !== undefined)
      .map(k => normalizedVector[k]);
    radar[dim] = vals.length > 0 ? Math.max(...vals) : 50;
  }
  return radar;
}

// ─── 画像匹配 ────────────────────────────────────────────────────────────────

/**
 * 计算两个向量间的欧氏距离。
 * 只考虑 prototype 中明确定义的 key（其余维度不参与计算）。
 *
 * @param {Object} userVector   - 归一化后的用户向量
 * @param {Object} prototype    - 画像原型向量（不含 label/emoji 等元信息）
 * @returns {number} 欧氏距离
 */
function euclideanDistance(userVector, prototype) {
  let sumSq = 0;
  for (const [key, protoVal] of Object.entries(prototype)) {
    if (key === 'label' || key === 'emoji') continue;
    const userVal = userVector[key] || 0;
    sumSq += (userVal - protoVal) ** 2;
  }
  return Math.sqrt(sumSq);
}

/**
 * 将用户向量与全部画像原型做匹配，返回最佳画像及置信度。
 *
 * @param {Object} userVector - normalizeAllDimensions 的输出
 * @returns {{
 *   primary: string,
 *   confidence: number,
 *   secondary: string,
 *   secondaryDistance: number,
 *   isHybrid: boolean,
 *   allDistances: Object
 * }}
 */
function matchArchetype(userVector) {
  const distances = {};

  for (const [name, prototype] of Object.entries(ARCHETYPES)) {
    distances[name] = euclideanDistance(userVector, prototype);
  }

  // 按距离升序排列
  const sorted = Object.entries(distances).sort((a, b) => a[1] - b[1]);
  const [primaryName, primaryDist] = sorted[0];
  const [secondaryName, secondaryDist] = sorted[1];

  // 距离转置信度：距离越小越高，上限 100
  const confidence = Math.round(Math.max(0, 100 - primaryDist / 2));

  // 两个最近画像距离差 < 阈值 → 混合型
  const isHybrid = (secondaryDist - primaryDist) < HYBRID_DISTANCE_THRESHOLD;

  return {
    primary: primaryName,
    confidence,
    secondary: secondaryName,
    secondaryDistance: Math.round(secondaryDist - primaryDist),
    isHybrid,
    allDistances: Object.fromEntries(sorted.map(([k, v]) => [k, Math.round(v)])),
  };
}

// ─── 特殊标注检测 ────────────────────────────────────────────────────────────

/**
 * 根据答案和画像匹配结果，检测需要触发的特殊标注。
 *
 * @param {Object} answers      - 原始答案
 * @param {Object} matchResult  - matchArchetype 的输出
 * @returns {{
 *   familyDriven: boolean,
 *   directionUnclear: boolean,
 *   brandHunterAlert: boolean,
 *   needsDirectionDialog: boolean
 * }}
 */
function detectFlags(answers, matchResult) {
  // 家庭主导：I3 选 D
  const familyDriven = answers['I3'] === 'D';

  // 方向不明确：主画像为探索型
  const directionUnclear = DIRECTION_UNCLEAR_ARCHETYPES.has(matchResult.primary);

  // 品牌导向警示：主画像为 BRAND_HUNTER 且置信度够高
  const brandHunterAlert =
    matchResult.primary === 'BRAND_HUNTER' &&
    matchResult.confidence >= BRAND_HUNTER_ALERT_CONFIDENCE;

  // 触发方向澄清对话
  const needsDirectionDialog = directionUnclear;

  return { familyDriven, directionUnclear, brandHunterAlert, needsDirectionDialog };
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────

/**
 * 根据用户答案计算完整的测试结果档案。
 * 这是模块对外暴露的核心函数。
 *
 * @param {Object} answers   - { questionId: answer }
 * @param {Array}  questions - quiz-questions.json 的 questions 数组
 * @returns {Object} profile - 符合 globalStudy_profile_v1 schema 的 quiz1A 字段
 */
function computeQuizResult(answers, questions) {
  // 1. 原始分累计
  const rawScores = calculateRawScores(answers, questions);

  // 2. 归一化
  const normalizedVector = normalizeAllDimensions(rawScores);

  // 3. 雷达图5维汇总分
  const radarScores = computeRadarScores(normalizedVector);

  // 4. 画像匹配
  const archetypeResult = matchArchetype(normalizedVector);

  // 5. 特殊标注
  const flags = detectFlags(answers, archetypeResult);

  return {
    completedAt: new Date().toISOString(),
    rawAnswers: answers,
    rawScores,
    normalizedVector,
    radarScores,
    archetypeResult: {
      primary: archetypeResult.primary,
      primaryLabel: ARCHETYPES[archetypeResult.primary].label,
      primaryEmoji: ARCHETYPES[archetypeResult.primary].emoji,
      confidence: archetypeResult.confidence,
      secondary: archetypeResult.secondary,
      secondaryLabel: ARCHETYPES[archetypeResult.secondary].label,
      secondaryDistance: archetypeResult.secondaryDistance,
      isHybrid: archetypeResult.isHybrid,
    },
    flags,
  };
}

// ─── localStorage 读写 ───────────────────────────────────────────────────────

const STORAGE_KEYS = {
  PROFILE:   'globalStudy_profile_v1',
  PROGRESS:  'globalStudy_quiz_progress_v1',
  SESSION:   'globalStudy_session_v1',
};

/** 保存答题进度（断点续答，有效期24小时） */
function saveProgress(currentQuestion, answers) {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({
    currentQuestion,
    answers,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  }));
}

/**
 * 读取断点续答进度。若进度已过期或不存在，返回 null。
 *
 * @returns {{ currentQuestion: number, answers: Object } | null}
 */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (new Date(data.expiresAt) < new Date()) {
      localStorage.removeItem(STORAGE_KEYS.PROGRESS);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** 清除答题进度（完成测试或用户选择重新开始时调用） */
function clearProgress() {
  localStorage.removeItem(STORAGE_KEYS.PROGRESS);
}

/** 将完整档案写入 localStorage */
function saveProfile(quiz1AResult) {
  let profile;
  try {
    profile = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE)) || {};
  } catch {
    profile = {};
  }

  const now = new Date().toISOString();
  profile.schemaVersion = '1.0';
  profile.createdAt = profile.createdAt || now;
  profile.updatedAt = now;
  profile.quiz1A = quiz1AResult;
  profile.quiz1B = profile.quiz1B || null;
  profile.quiz1C = profile.quiz1C || null;
  profile.metadata = profile.metadata || {
    deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    entrySource: new URLSearchParams(location.search).get('src') || 'direct',
  };

  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  return profile;
}

/** 读取已保存的完整档案，不存在时返回 null */
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE)) || null;
  } catch {
    return null;
  }
}

// ─── 对外导出 ────────────────────────────────────────────────────────────────

// 兼容直接 <script> 引入（无 bundler）的挂载方式
window.QuizEngine = {
  computeQuizResult,
  calculateRawScores,
  normalizeAllDimensions,
  computeRadarScores,
  matchArchetype,
  detectFlags,
  saveProgress,
  loadProgress,
  clearProgress,
  saveProfile,
  loadProfile,
  ARCHETYPES,
  DIMENSION_GROUPS,
  STORAGE_KEYS,
};
