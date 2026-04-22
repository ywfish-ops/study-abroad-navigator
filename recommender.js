'use strict';

/**
 * 模块 1B — 联申定位器（Multi-Country Application Recommender）
 * 输入学生学术画像 → 输出多国院校推荐列表（冲/稳/保分层）
 */
const RecommenderModule = (() => {

  // ── 常量 ─────────────────────────────────────────────────────────────────

  /** 预算档上限（USD） */
  const BUDGET_MAX = { '<30k': 30000, '30–50k': 50000, '50–80k': 80000, '>80k': Infinity };

  /** 汇率换算为 USD（固定汇率，仅用于预算比较） */
  const FX = { USD: 1, GBP: 1.27, CAD: 0.73, AUD: 0.65, HKD: 0.128, SGD: 0.74 };

  /** A-Level 档位排名（数字越大越好） */
  const ALEVEL_RANK = { 'A*A*A*': 7, 'A*A*A': 6, 'A*AA': 5, 'AAA': 4, 'AAB': 3, 'ABB': 2, 'BBB': 1 };

  /** 专业分类映射 */
  const MAJOR_MAP = {
    cs:         { label: '计算机 / 数据科学', keywords: ['Computer Science','Data Science','Software','Computing','AI'] },
    engineering:{ label: '工程（非CS）',      keywords: ['Engineering','Electrical','Mechanical','Civil','Chemical','Aerospace'] },
    business:   { label: '商科 / 金融',       keywords: ['Business','Finance','Economics','Accounting','Commerce','Management'] },
    life_sci:   { label: '生命科学 / 医学',   keywords: ['Biology','Medicine','Biomedical','Life Sciences','Pre-med','Health'] },
    social_sci: { label: '社会科学 / 人文',   keywords: ['Psychology','Sociology','Political','History','Philosophy','Humanities'] },
    arts:       { label: '艺术 / 设计 / 传媒',keywords: ['Architecture','Design','Film','Media','Music','Arts'] },
    natural_sci:{ label: '理科（物化数）',     keywords: ['Physics','Chemistry','Mathematics','Statistics','Astronomy'] },
    law:        { label: '法律',              keywords: ['Laws','LLB','Legal'] },
  };

  /** 国家旗帜 */
  const COUNTRY_FLAG = { US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', SG: '🇸🇬', HK: '🇭🇰' };

  /**
   * 竞赛列表（面向中国学生可参加、英美认可度高的赛事）
   * tier: 4=顶尖科研级 3=顶尖竞赛 2=全国/知名竞赛 1=入门/参与级
   * hasMedal=true → 需选金/银/铜/荣誉；false → 入围/达到该级别即为成就
   * group: 用于下拉分组标题
   */
  const COMP_LIST = [
    // ── 数学 ──────────────────────────────────────────────────────────────
    { key: 'aime',        group: '数学',   label: 'AIME 美国数学邀请赛（晋级）',          tier: 3, hasMedal: false },
    { key: 'bmo',         group: '数学',   label: 'BMO 英国数学奥林匹克（晋级）',         tier: 3, hasMedal: false },
    { key: 'amc_hr',      group: '数学',   label: 'AMC 10/12 高分 / Honor Roll',          tier: 2, hasMedal: false },
    { key: 'smc_gold',    group: '数学',   label: 'SMC 英国高级数学测评（金奖）',          tier: 2, hasMedal: false },
    { key: 'euclid',      group: '数学',   label: 'Euclid 欧几里得数学竞赛（高分）',       tier: 2, hasMedal: false },
    { key: 'himcm',       group: '数学',   label: 'HiMCM 数学建模（Outstanding）',         tier: 2, hasMedal: false },
    { key: 'yau_math',    group: '数学',   label: '丘成桐中学科学奖（数学方向）',          tier: 4, hasMedal: true  },
    { key: 'amc10',       group: '数学',   label: 'AMC 10/12 参赛（普通分段）',            tier: 1, hasMedal: false },
    { key: 'smc_slv',     group: '数学',   label: 'SMC 英国高级数学测评（银奖及以下）',    tier: 1, hasMedal: false },
    // ── 物理 ──────────────────────────────────────────────────────────────
    { key: 'bpho_gold',   group: '物理',   label: 'BPhO 英国物理奥赛（金奖）',             tier: 3, hasMedal: false },
    { key: 'yau_phys',    group: '物理',   label: '丘成桐中学科学奖（物理方向）',          tier: 4, hasMedal: true  },
    { key: 'pupc',        group: '物理',   label: 'PUPC 普林斯顿物理竞赛（获奖）',         tier: 2, hasMedal: true  },
    { key: 'pbowl',       group: '物理',   label: 'PhysicsBowl 物理碗（全国前列）',        tier: 2, hasMedal: false },
    { key: 'asdan_phys',  group: '物理',   label: 'ASDAN Physics Challenge（高分）',       tier: 1, hasMedal: false },
    { key: 'bpho_slv',    group: '物理',   label: 'BPhO 英国物理奥赛（银奖及以下）',       tier: 1, hasMedal: false },
    // ── 化学 ──────────────────────────────────────────────────────────────
    { key: 'ukcho',       group: '化学',   label: 'UKChO 英国化学奥赛（金/银奖）',         tier: 3, hasMedal: true  },
    { key: 'yau_chem',    group: '化学',   label: '丘成桐中学科学奖（化学方向）',          tier: 4, hasMedal: true  },
    { key: 'ccc',         group: '化学',   label: 'CCC 加拿大化学竞赛',                    tier: 1, hasMedal: true  },
    { key: 'asoc',        group: '化学',   label: 'ASOC 澳大利亚化学奥赛',                 tier: 1, hasMedal: true  },
    { key: 'jcco',        group: '化学',   label: 'JCCO 加拿大初级化学奥赛',               tier: 1, hasMedal: true  },
    // ── 生物 ──────────────────────────────────────────────────────────────
    { key: 'usabo',       group: '生物',   label: 'USABO 美国生物奥赛（半决赛+）',         tier: 3, hasMedal: false },
    { key: 'yau_bio',     group: '生物',   label: '丘成桐中学科学奖（生物方向）',          tier: 4, hasMedal: true  },
    { key: 'bbo',         group: '生物',   label: 'BBO 英国生物奥赛（金奖）',              tier: 2, hasMedal: false },
    { key: 'hosa',        group: '生物',   label: 'HOSA 全美生物健康挑战（获奖）',         tier: 1, hasMedal: true  },
    { key: 'brain_bee',   group: '生物',   label: 'Brain Bee 脑科学竞赛',                  tier: 1, hasMedal: true  },
    // ── CS与机器人 ─────────────────────────────────────────────────────────
    { key: 'noi',         group: 'CS与机器人', label: 'NOI 全国信息学奥林匹克',            tier: 4, hasMedal: true  },
    { key: 'usaco_plat',  group: 'CS与机器人', label: 'USACO Platinum',                    tier: 3, hasMedal: false },
    { key: 'yau_cs',      group: 'CS与机器人', label: '丘成桐中学科学奖（计算机方向）',    tier: 4, hasMedal: true  },
    { key: 'usaco_gold',  group: 'CS与机器人', label: 'USACO Gold',                        tier: 2, hasMedal: false },
    { key: 'noip',        group: 'CS与机器人', label: 'NOIP 全国青少年信息学（省级一等）', tier: 2, hasMedal: false },
    { key: 'vex',         group: 'CS与机器人', label: 'VEX Robotics 机器人大赛（世锦赛+）', tier: 2, hasMedal: false },
    { key: 'frc',         group: 'CS与机器人', label: 'FRC FIRST机器人挑战赛（区域冠军+）', tier: 2, hasMedal: false },
    { key: 'usaco_silver',group: 'CS与机器人', label: 'USACO Silver',                      tier: 1, hasMedal: false },
    // ── 商科与经济 ─────────────────────────────────────────────────────────
    { key: 'yau_econ',    group: '商科经济', label: '丘成桐中学科学奖（经济金融方向）',    tier: 4, hasMedal: true  },
    { key: 'wharton',     group: '商科经济', label: 'Wharton 沃顿投资竞赛（Finalist）',    tier: 2, hasMedal: false },
    { key: 'nec',         group: '商科经济', label: 'NEC 全美经济学挑战赛（全国级）',      tier: 2, hasMedal: false },
    { key: 'ieo',         group: '商科经济', label: 'IEO 国际经济学奥林匹克（中国区）',   tier: 1, hasMedal: true  },
    { key: 'fbla',        group: '商科经济', label: 'FBLA 商业领袖挑战（全国/国际级）',   tier: 1, hasMedal: true  },
    { key: 'bpa',         group: '商科经济', label: 'BPA 商业全能挑战',                   tier: 1, hasMedal: true  },
    { key: 'sic',         group: '商科经济', label: 'SIC 中学生投资挑战',                  tier: 1, hasMedal: true  },
    // ── 人文社科与写作 ─────────────────────────────────────────────────────
    { key: 'john_locke',  group: '人文社科', label: 'John Locke 写作赛（Finalist/获奖）',  tier: 3, hasMedal: true  },
    { key: 'marshall',    group: '人文社科', label: 'Marshall Society 经济论文赛（获奖）',  tier: 3, hasMedal: true  },
    { key: 'nsda',        group: '人文社科', label: 'NSDA 演讲辩论（大区/全国级）',        tier: 2, hasMedal: false },
    { key: 'nhsdlc',      group: '人文社科', label: 'NHSDLC 中国高中美式辩论（冠军级）',   tier: 2, hasMedal: false },
    { key: 'nyt',         group: '人文社科', label: 'NYT Writing 纽约时报写作竞赛',        tier: 1, hasMedal: true  },
    // ── 综合科研 ──────────────────────────────────────────────────────────
    { key: 'isef_gd',     group: '综合科研', label: 'ISEF 大奖（Grand Award）',            tier: 4, hasMedal: true  },
    { key: 'isef_3rd',    group: '综合科研', label: 'ISEF 三等奖 / 特别奖',                tier: 3, hasMedal: false },
    { key: 'igem',        group: '综合科研', label: 'iGEM 国际遗传工程机器大赛（金牌）',   tier: 3, hasMedal: true  },
  ];

  /** 英国G5笔试信息（key → {label, desc}） */
  const UK_TEST_INFO = {
    tmua: { label: 'TMUA',  desc: '剑桥数学/经济、帝国理工 CS/数学' },
    esat: { label: 'ESAT',  desc: '剑桥工程/CS/自然科学/生命科学' },
    mat:  { label: 'MAT',   desc: '牛津数学/计算机' },
    pat:  { label: 'PAT',   desc: '牛津物理/工程' },
    step: { label: 'STEP',  desc: '剑桥数学 offer 条件（II/III级）' },
    lnat: { label: 'LNAT',  desc: '牛津 / UCL 法律' },
    tsa:  { label: 'TSA',   desc: '牛津 PPE / 经济 / 心理 / 地理' },
  };

  /** 笔试表现 → 学术分修正（满分40分制） */
  const UK_TEST_PERF_ADJ = { top: 8, strong: 4, average: 0, weak: -5, na: -3 };

  /** 根据竞赛+奖项计算学术强度加成（0–0.20；tier4金=+20，tier1=+5，hasMedal时×奖项系数） */
  function calcCompAdj(competition) {
    if (!competition?.comp) return 0;
    const info = COMP_LIST.find(c => c.key === competition.comp);
    if (!info) return 0;
    const tierBase = [0, 0.05, 0.10, 0.15, 0.20][info.tier] ?? 0;
    if (!info.hasMedal) return tierBase;
    const medalW = { gold: 1.0, silver: 0.7, bronze: 0.45, honor: 0.2 }[competition.medal] ?? 0;
    return tierBase * medalW;
  }

  /** 梯队配置 */
  const TIER_CONFIG = {
    reach:  { label: '冲', className: 'tier-reach',   order: 0 },
    target: { label: '稳', className: 'tier-target',  order: 1 },
    safe:   { label: '保', className: 'tier-safe',   order: 2 },
  };

  // ── 全局状态 ─────────────────────────────────────────────────────────────

  const state = {
    schools: [],        // 清洗后的院校数组
    loading: false,
    error: null,
    profile: {
      curriculum: 'ap',
      score_ap: null,
      score_ap_avg: '4',
      score_alevel: 'AAA',
      score_ib: null,
      gpa_us: null,
      english_test: 'ielts',
      english_score: null,
      ec_level: 'good',
      target_countries: ['US', 'GB'],
      major_interest: 'cs',
      budget_usd: '30–50k',
      priority: 'ranking',
      scholarship_only: false,
      test_optional_apply: false,          // 以免标化方式申请（不提交 SAT/ACT）
      uk_written_tests: { tmua:'na', esat:'na', mat:'na', pat:'na', step:'na', lnat:'na', tsa:'na' },
      competition: { comp: '', medal: '' },// 竞赛奖项
      research_exp: 'none',               // 研究经历: 'none' | 'basic' | 'strong'
      leadership: 'none',                 // 校内任职: 'none' | 'officer' | 'founder'
      community_service: 'none',          // 公益活动: 'none' | 'regular' | 'impact'
    },
    results: null,       // null=未计算; []=无结果; [...]=有结果
  };

  let initialized = false;

  // ── 工具函数 ─────────────────────────────────────────────────────────────

  /** 货币换算为 USD */
  function toUSD(amount, currency) {
    return Math.round(amount * (FX[currency] ?? 1));
  }

  /** 保存画像到 localStorage */
  function saveProfile(profile) {
    try {
      localStorage.setItem('1b_profile', JSON.stringify({ ...profile, _ts: Date.now() }));
    } catch (_) {}
  }

  /** 从 localStorage 恢复画像（7天有效） */
  function loadProfile() {
    try {
      const raw = localStorage.getItem('1b_profile');
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (Date.now() - p._ts > 7 * 86400 * 1000) return null;
      return p;
    } catch { return null; }
  }

  /** 更新状态并重渲染 */
  function updateState(patch) {
    Object.assign(state, patch);
    render();
  }

  /** 更新用户画像（同步到 state 和 localStorage） */
  function updateProfile(patch) {
    Object.assign(state.profile, patch);
    saveProfile(state.profile);
    // 若结果已显示，显示"已变更"提示
    if (state.results !== null) {
      const banner = document.getElementById('rec-change-banner');
      if (banner) banner.style.display = 'flex';
    }
    render();
  }

  // ── 算法：辅助函数 ──────────────────────────────────────────────────────

  /** 按 QS/USNews 排名打优先因子分 */
  function scoreByRank(school) {
    const rank = school.usnews_rank_2026 || school.qs_rank_2025;
    if (!rank) return 12;
    if (rank <= 20) return 25;
    if (rank <= 50) return 20;
    if (rank <= 100) return 15;
    if (rank <= 200) return 10;
    return 6;
  }

  /** 按工签时长打分 */
  function scoreByPSW(months) {
    if (months >= 36) return 25;
    if (months >= 24) return 18;
    if (months >= 12) return 12;
    return 5;
  }

  /** 按城市设置 + 华人社区打生活质量分 */
  function scoreByCity(setting, community) {
    let s = setting === 'urban' ? 12 : setting === 'suburban' ? 8 : 4;
    s += community === 'large' ? 13 : community === 'medium' ? 8 : 4;
    return s;
  }

  /** acceptance_rate 代理学术分 */
  function rateScore(rate) {
    if (!rate) return 20;
    if (rate > 0.50) return 38;
    if (rate > 0.30) return 28;
    if (rate > 0.15) return 18;
    return 10;
  }

  // ── 算法：成绩匹配分（40分） ────────────────────────────────────────────

  function calcAcademic(school, profile) {
    const { curriculum, score_ap, score_ap_avg, score_alevel, score_ib, gpa_us } = profile;
    let base = 0;

    const schoolIsTestOpt = (school.tags || []).includes('test-optional');

    if (curriculum === 'ap') {
      if (profile.test_optional_apply) {
        // 免标化申请：基础分来自 GPA，test-optional 学校额外加分，否则轻微扣分
        const gpaForBase = gpa_us || 3.5;
        const gpaBase = gpaForBase >= 3.9 ? 30 : gpaForBase >= 3.7 ? 24 : gpaForBase >= 3.5 ? 18 : 12;
        base = schoolIsTestOpt ? gpaBase + 6 : gpaBase - 4;
      } else if (school.sat_range) {
        const avgMap = { '3': 3, '4': 4, '5': 5 };
        const apAvg = avgMap[score_ap_avg] ?? 4;
        const satProxy = (score_ap || 5) * 50 + apAvg * 50;
        if (satProxy >= school.sat_range[1]) base = 40;
        else if (satProxy >= school.sat_range[0]) base = 28;
        else base = 12;
      } else {
        base = rateScore(school.acceptance_rate);
      }
    } else if (curriculum === 'alevel') {
      if (school.a_level_typical) {
        const schoolReq = ALEVEL_RANK[school.a_level_typical];
        const userScore = ALEVEL_RANK[score_alevel] ?? 2;
        const gap = userScore - (schoolReq ?? userScore); // schoolReq 未知时 gap=0
        if (gap >= 1) base = 40;
        else if (gap === 0) base = 28;
        else if (gap === -1) base = 16;
        else base = 6;

        // G5 笔试修正：按 school.admissions_tests[major_interest] 查对应笔试
        const testKey = (school.admissions_tests || {})[profile.major_interest];
        if (testKey) {
          const perf = (profile.uk_written_tests || {})[testKey] ?? 'na';
          base += UK_TEST_PERF_ADJ[perf] ?? 0;
        }
      } else {
        // 无 A-Level 要求数据（非英国院校）：按学生成绩估算，冲稳保由 getTier 单独判定
        const alevelBase = { 'A*A*A*': 38, 'A*A*A': 34, 'A*AA': 30, 'AAA': 26, 'AAB': 20, 'ABB': 15, 'BBB': 10 };
        base = alevelBase[score_alevel] ?? 20;
      }
    } else { // ib
      const ib = score_ib || 30;
      if (profile.test_optional_apply) {
        // 免标化：基础分来自 IB 分数，test-optional 学校额外加分
        const ibBase = ib >= 40 ? 36 : ib >= 37 ? 30 : ib >= 34 ? 24 : ib >= 31 ? 18 : 12;
        base = schoolIsTestOpt ? ibBase + 6 : ibBase - 4;
      } else {
        const rate = school.acceptance_rate;
        if (ib >= 38) {
          base = rate <= 0.15 ? 10 : rate <= 0.30 ? 28 : 38;
        } else if (ib >= 32) {
          base = rate <= 0.25 ? 28 : rate <= 0.50 ? 33 : 38;
        } else {
          base = rate <= 0.50 ? 20 : 38;
        }
      }
    }

    // GPA 修正（±5分）
    const gpa = gpa_us || 3.5;
    const gpaAdj = gpa >= 3.9 ? 4 : gpa >= 3.7 ? 2 : gpa >= 3.5 ? 0 : -3;

    return Math.max(0, Math.min(40, base + gpaAdj));
  }

  // ── 算法：专业匹配分（20分） ────────────────────────────────────────────

  function calcMajor(school, majorKey) {
    const keywords = MAJOR_MAP[majorKey]?.keywords ?? [];
    const hits = (school.popular_majors ?? []).filter(m =>
      keywords.some(k => m.toLowerCase().includes(k.toLowerCase()))
    ).length;
    return hits >= 2 ? 20 : hits === 1 ? 14 : 8;
  }

  // ── 算法：优先因子分（25分） ────────────────────────────────────────────

  function calcPriority(school, priority) {
    switch (priority) {
      case 'ranking':     return scoreByRank(school);
      case 'scholarship': return school.scholarship_intl ? 25 : 5;
      case 'coop':        return school.coop_available ? 25 : 5;
      case 'post_work':   return scoreByPSW(school.post_study_work);
      case 'life_quality':return scoreByCity(school.campus_setting, school.chinese_student_community);
      default:            return 12;
    }
  }

  // ── 算法：课外活动分（10分） ────────────────────────────────────────────

  function calcEC(school, profile) {
    const ecMap = { strong: 10, good: 7, basic: 4 };
    const base = ecMap[profile.ec_level] ?? 4;
    const penalty = (profile.ec_level !== 'strong' && (school.acceptance_rate ?? 1) < 0.15) ? -3 : 0;
    const adj = calcCompAdj(profile.competition);
    const compBonus  = adj >= 0.15 ? 3 : adj >= 0.10 ? 2 : adj >= 0.05 ? 1 : 0;
    const leadBonus  = profile.leadership === 'founder' ? 1 : 0;
    const csBonus    = profile.community_service === 'impact' ? 1 : 0;
    return Math.max(0, Math.min(10, base + penalty + compBonus + leadBonus + csBonus));
  }

  // ── 算法：语言舒适度分（5分） ────────────────────────────────────────────

  function calcLang(school, profile) {
    if (profile.english_test === 'native') return 5;
    // 统一换算为 IELTS 单位
    let ieltsScore = profile.english_score ?? 0;
    if (profile.english_test === 'toefl') ieltsScore = ieltsScore / 120 * 9;
    if (profile.english_test === 'duolingo') ieltsScore = ieltsScore / 160 * 9;
    const margin = ieltsScore - (school.ielts_min ?? 6.5);
    return margin >= 1.0 ? 5 : margin >= 0.5 ? 4 : margin >= 0 ? 3 : 0;
  }

  // ── 算法：综合评分 ───────────────────────────────────────────────────────

  function calcMatchScore(school, profile) {
    const academic = calcAcademic(school, profile);
    const major    = calcMajor(school, profile.major_interest);
    const priority = calcPriority(school, profile.priority);
    const ec       = calcEC(school, profile);
    const lang     = calcLang(school, profile);
    return Math.min(99, Math.round(academic + major + priority + ec + lang));
  }

  // ── 算法：冲稳保相对判定 ────────────────────────────────────────────────

  /**
   * 学生综合学术强度（0-100），与具体学校无关。
   * 用于与学校选择性做相对比较，实现「你的冲是别人的保」。
   */
  function calcStudentStrength(profile) {
    let pct = 0;

    if (profile.curriculum === 'ap') {
      const avgWeight = { '3': 0.35, '4': 0.60, '5': 0.88 };
      const avgPct   = avgWeight[profile.score_ap_avg] ?? 0.60;
      const countPct = Math.min(1.0, (profile.score_ap || 5) / 8);
      pct = avgPct * 0.70 + countPct * 0.30;
    } else if (profile.curriculum === 'alevel') {
      const rank = ALEVEL_RANK[profile.score_alevel] ?? 2;
      pct = (rank - 1) / 6;
    } else { // ib
      const ib = profile.score_ib || 30;
      pct = Math.max(0, Math.min(1, (ib - 24) / 21));
    }

    const gpa    = profile.gpa_us || 3.5;
    const gpaAdj = gpa >= 3.9 ? 0.08 : gpa >= 3.7 ? 0.04 : gpa >= 3.0 ? 0 : -0.08;
    const ecAdj  = profile.ec_level === 'strong' ? 0.05 : profile.ec_level === 'basic' ? -0.05 : 0;
    const compAdj   = calcCompAdj(profile.competition);
    const resAdj    = profile.research_exp === 'strong' ? 0.06 : profile.research_exp === 'basic' ? 0.02 : 0;
    const leadAdj   = profile.leadership === 'founder' ? 0.05 : profile.leadership === 'officer' ? 0.02 : 0;
    const csAdj     = profile.community_service === 'impact' ? 0.03 : profile.community_service === 'regular' ? 0.01 : 0;

    return Math.max(0, Math.min(100, (pct + gpaAdj + ecAdj + compAdj + resAdj + leadAdj + csAdj) * 100));
  }

  /**
   * 学校录取选择性（0-100，越高越难进）。
   * 优先级：SAT 中位数 > A-Level 要求 > 录取率代理。
   */
  function calcSchoolSelectivity(school, profile) {
    // AP / IB 申请美国学校：SAT 中位数最准确
    if (school.sat_range && profile.curriculum !== 'alevel') {
      const mid = (school.sat_range[0] + school.sat_range[1]) / 2;
      return Math.max(0, Math.min(100, (mid - 800) / 800 * 100));
    }

    // A-Level 学生 + 有 A-Level 要求数据：直接比较成绩要求
    if (profile.curriculum === 'alevel' && school.a_level_typical) {
      const req = ALEVEL_RANK[school.a_level_typical] ?? 3;
      return (req - 1) / 6 * 100;
    }

    // A-Level 学生 + 英国学校 + 无 A-Level 要求数据：
    // 英国大学录取率受申请量影响，不能反映难度（Oxford/Leeds 录取率相近但要求相差极大）
    // 用 50 作为保守中间值，避免误判
    if (profile.curriculum === 'alevel' && school.country === 'GB') {
      return 50;
    }

    // 其他情况（含非英国学校、IB/AP 申请无 SAT 数据的学校）：录取率代理
    const rate = school.acceptance_rate;
    if (rate == null) return 50;
    return Math.max(0, Math.min(100, (1 - rate) * 100));
  }

  /**
   * 冲稳保判定：gap = 学生强度 - 学校选择性
   *   gap ≥ 22 → 保；gap ≥ -8 → 稳；gap < -8 → 冲
   */
  function getTier(school, profile) {
    const gap = calcStudentStrength(profile) - calcSchoolSelectivity(school, profile);
    if (gap >= 22) return 'safe';
    if (gap >= -8) return 'target';
    return 'reach';
  }

  // ── 算法：雷达图五维数据 ────────────────────────────────────────────────

  function calcRadarData(school) {
    const ranking     = scoreByRank(school) / 25 * 100;
    const employ      = Math.min(100, (school.coop_available ? 15 : 0) + scoreByPSW(school.post_study_work) / 25 * 85);
    const scholarship = school.scholarship_intl ? 80 : 20;
    const language    = Math.min(100, Math.max(0, ((school.ielts_min ?? 6.5) - 6.0) / 1.5 * -50 + 80));
    const visa        = Math.min(100, scoreByPSW(school.post_study_work) * 4);
    return [ranking, employ, scholarship, language, visa];
  }

  // ── 硬性过滤 ─────────────────────────────────────────────────────────────

  /**
   * 检查院校是否通过所有硬性门槛
   * @param {object} school
   * @param {object} profile
   * @returns {boolean}
   */
  function isEligible(school, profile) {
    // ① 国家匹配
    if (!profile.target_countries.includes(school.country)) return false;

    // ② 预算匹配
    const budgetMax = BUDGET_MAX[profile.budget_usd] ?? Infinity;
    const tuitionUSD = toUSD(school.tuition_intl_annual ?? 0, school.tuition_currency ?? 'USD');
    const livingUSD  = toUSD(school.avg_living_cost_annual ?? 0, school.tuition_currency ?? 'USD');
    if (tuitionUSD + livingUSD > budgetMax) return false;

    // ③ 语言门槛（native 直接通过）
    if (profile.english_test !== 'native') {
      let ieltsScore = profile.english_score ?? 0;
      if (profile.english_test === 'toefl') ieltsScore = ieltsScore / 120 * 9;
      if (profile.english_test === 'duolingo') ieltsScore = ieltsScore / 160 * 9;
      const toeflScore = profile.english_test === 'toefl' ? (profile.english_score ?? 0) : 0;
      const passIelts = school.ielts_min ? ieltsScore >= school.ielts_min : true;
      const passToefl = school.toefl_min ? toeflScore >= school.toefl_min : true;
      if (!passIelts && !passToefl) return false;
    }

    // ④ 奖学金过滤
    if (profile.scholarship_only && !school.scholarship_intl) return false;

    return true;
  }

  // ── 主匹配函数 ───────────────────────────────────────────────────────────

  /**
   * 对所有院校执行匹配，返回排序后的结果数组
   * @returns {Array<{school, matchScore, tier}>}
   */
  // 每个梯队最多展示数量
  const TIER_CAP = { reach: 6, target: 8, safe: 5 };
  // 匹配分低于此值不展示（满分99，50分为基准线）
  const MIN_MATCH_SCORE = 50;

  function runMatch() {
    const candidates = [];
    for (const school of state.schools) {
      if (!isEligible(school, state.profile)) continue;
      const matchScore = calcMatchScore(school, state.profile);
      if (matchScore < MIN_MATCH_SCORE) continue;
      const tier = getTier(school, state.profile);
      candidates.push({ school, matchScore, tier });
    }
    // 同梯队内按综合匹配分降序
    candidates.sort((a, b) => b.matchScore - a.matchScore);
    // 每个梯队取前 N 所
    const count = { reach: 0, target: 0, safe: 0 };
    const filtered = candidates.filter(r => {
      if (count[r.tier] >= TIER_CAP[r.tier]) return false;
      count[r.tier]++;
      return true;
    });
    // 最终排序：冲 → 稳 → 保；同梯队内保持匹配分降序
    const TIER_ORDER = { reach: 0, target: 1, safe: 2 };
    filtered.sort((a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.matchScore - a.matchScore
    );
    return filtered;
  }

  // ── 数据加载 ─────────────────────────────────────────────────────────────

  async function loadSchools() {
    if (state.schools.length > 0) return; // 已加载
    updateState({ loading: true, error: null });
    try {
      const res = await fetch('./schools.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      const schools = raw.schools.filter(s => s && s.country && s.id && s.name_en);
      updateState({ schools, loading: false });
    } catch (e) {
      updateState({ loading: false, error: '数据加载失败，请刷新页面重试' });
    }
  }

  // ── 渲染：主入口 ─────────────────────────────────────────────────────────

  function render() {
    const root = document.getElementById('rec-root');
    if (!root) return;

    if (state.loading) {
      root.innerHTML = `<div class="rec-loading">加载院校数据中…</div>`;
      return;
    }
    if (state.error) {
      root.innerHTML = `<div class="rec-error">${state.error}</div>`;
      return;
    }

    // 只更新各区块，避免整体重渲丢失输入焦点
    renderForm();
    renderResults();
  }

  // ── 渲染：输入表单 ───────────────────────────────────────────────────────

  function renderForm() {
    // 用户正在文本框内输入时，不重建表单（避免丢失焦点）
    // 其他情况（点击 chip 等）允许重建，以确保选中状态正确刷新
    if (document.getElementById('rec-form')) {
      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (isTyping) {
        syncFormFields();
        return;
      }
    }

    const root = document.getElementById('rec-root');
    root.innerHTML = `
      <div class="rec-wrap">

        <!-- 变更提示 banner -->
        <div id="rec-change-banner" class="rec-banner" style="display:none;">
          偏好已变更 — <button onclick="RecommenderModule.generate()" class="rec-banner-btn">重新生成</button>
        </div>

        <!-- 表单 -->
        <form id="rec-form" onsubmit="return false;">

          <!-- Step 1：学术画像 -->
          <div class="rec-section">
            <div class="rec-step-label">Step 01</div>
            <div class="rec-section-title">学术画像</div>

            <!-- 课程体系 tabs -->
            <div class="rec-field-group">
              <div class="rec-label">就读课程体系</div>
              <div class="rec-chip-group" id="rec-curriculum-chips">
                ${['ap','alevel','ib'].map(c => `
                  <button type="button"
                    class="rec-chip${state.profile.curriculum === c ? ' active' : ''}"
                    onclick="RecommenderModule._setCurriculum('${c}')">
                    ${c === 'ap' ? 'AP' : c === 'alevel' ? 'A-Level' : 'IB'}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- AP 字段 -->
            <div id="rec-fields-ap" class="rec-curriculum-fields" style="${state.profile.curriculum !== 'ap' ? 'display:none' : ''}">
              <div class="rec-field-group">
                <label class="rec-label" for="rec-score-ap">AP 科目数量（≥3分）</label>
                <input id="rec-score-ap" class="rec-input" type="number" min="1" max="15"
                  placeholder="如：8" value="${state.profile.score_ap ?? ''}"
                  oninput="RecommenderModule._updateProfile({score_ap: this.value ? +this.value : null})">
              </div>
              <div class="rec-field-group">
                <div class="rec-label">AP 平均分</div>
                <div class="rec-chip-group">
                  ${['3','4','5'].map(v => `
                    <button type="button"
                      class="rec-chip${state.profile.score_ap_avg === v ? ' active' : ''}"
                      onclick="RecommenderModule._updateProfile({score_ap_avg: '${v}'})">
                      ${v}分
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- A-Level 字段 -->
            <div id="rec-fields-alevel" class="rec-curriculum-fields" style="${state.profile.curriculum !== 'alevel' ? 'display:none' : ''}">
              <div class="rec-field-group">
                <div class="rec-label">A-Level 预测成绩</div>
                <div class="rec-chip-group rec-chip-group--wrap">
                  ${['A*A*A*','A*A*A','A*AA','AAA','AAB','ABB','BBB'].map(v => `
                    <button type="button"
                      class="rec-chip${state.profile.score_alevel === v ? ' active' : ''}"
                      onclick="RecommenderModule._updateProfile({score_alevel: '${v}'})">
                      ${v}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- IB 字段 -->
            <div id="rec-fields-ib" class="rec-curriculum-fields" style="${state.profile.curriculum !== 'ib' ? 'display:none' : ''}">
              <div class="rec-field-group">
                <label class="rec-label" for="rec-score-ib">IB 预测总分</label>
                <input id="rec-score-ib" class="rec-input" type="number" min="24" max="45"
                  placeholder="如：38" value="${state.profile.score_ib ?? ''}"
                  oninput="RecommenderModule._updateProfile({score_ib: this.value ? +this.value : null})">
              </div>
            </div>

            <!-- GPA（共用） -->
            <div class="rec-field-group">
              <label class="rec-label" for="rec-gpa">GPA（4.0制）</label>
              <input id="rec-gpa" class="rec-input" type="number" min="2.0" max="4.0" step="0.1"
                placeholder="如：3.8" value="${state.profile.gpa_us ?? ''}"
                oninput="RecommenderModule._updateProfile({gpa_us: this.value ? +this.value : null})">
            </div>

            <!-- 英语成绩 -->
            <div class="rec-field-group">
              <div class="rec-label">英语成绩类型</div>
              <div class="rec-chip-group">
                ${[
                  { v: 'ielts', l: 'IELTS' },
                  { v: 'toefl', l: 'TOEFL' },
                  { v: 'duolingo', l: 'Duolingo' },
                  { v: 'native', l: '母语英语' },
                ].map(({ v, l }) => `
                  <button type="button"
                    class="rec-chip${state.profile.english_test === v ? ' active' : ''}"
                    onclick="RecommenderModule._setEnglishTest('${v}')">
                    ${l}
                  </button>
                `).join('')}
              </div>
            </div>

            ${state.profile.english_test !== 'native' ? `
              <div class="rec-field-group">
                <label class="rec-label" for="rec-english-score">
                  ${state.profile.english_test === 'ielts' ? 'IELTS 分数（4.0–9.0）'
                    : state.profile.english_test === 'toefl' ? 'TOEFL 分数（60–120）'
                    : 'Duolingo 分数（85–160）'}
                </label>
                <input id="rec-english-score" class="rec-input" type="number"
                  ${state.profile.english_test === 'ielts'    ? 'min="4" max="9" step="0.5" placeholder="如：7.0"'
                  : state.profile.english_test === 'toefl'   ? 'min="60" max="120" step="1" placeholder="如：100"'
                  : 'min="85" max="160" step="1" placeholder="如：120"'}
                  value="${state.profile.english_score ?? ''}"
                  oninput="RecommenderModule._updateProfile({english_score: this.value ? +this.value : null})">
              </div>
            ` : ''}

            <!-- 课外活动整体水平 -->
            <div class="rec-field-group">
              <div class="rec-label">课外活动整体水平</div>
              <div class="rec-chip-group rec-chip-group--col">
                ${[
                  { v: 'strong', l: '强势', sub: '多项亮眼成就，有独特故事线' },
                  { v: 'good',   l: '良好', sub: '参与多样，有若干荣誉' },
                  { v: 'basic',  l: '一般', sub: '普通参与，无突出亮点' },
                ].map(({ v, l, sub }) => `
                  <button type="button"
                    class="rec-chip rec-chip--row${state.profile.ec_level === v ? ' active' : ''}"
                    onclick="RecommenderModule._updateProfile({ec_level: '${v}'})">
                    <span class="rec-chip-main">${l}</span>
                    <span class="rec-chip-sub">${sub}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 竞赛奖项 -->
            <div class="rec-field-group">
              <div class="rec-label">竞赛奖项 <span class="rec-label-hint">（直接影响冲刺线）</span></div>
              <select class="rec-select" onchange="RecommenderModule._setComp(this.value)">
                <option value="">— 无竞赛奖项 —</option>
                ${(() => {
                  const groups = [...new Set(COMP_LIST.map(c => c.group))];
                  return groups.map(g => `
                    <optgroup label="${g}">
                      ${COMP_LIST.filter(c => c.group === g).map(c =>
                        `<option value="${c.key}" ${state.profile.competition.comp === c.key ? 'selected' : ''}>${
                          ['★','★★','★★★','★★★★'][c.tier - 1]
                        } ${c.label}</option>`
                      ).join('')}
                    </optgroup>
                  `).join('');
                })()}
              </select>
              ${(() => {
                const info = COMP_LIST.find(c => c.key === state.profile.competition.comp);
                if (!info) return '';
                const adj = calcCompAdj(state.profile.competition);
                const pts = Math.round(adj * 100);
                const medalHtml = info.hasMedal ? `
                  <div class="rec-chip-group" style="margin-top:8px;">
                    ${[
                      { v: 'gold',   l: '金牌 / 一等' },
                      { v: 'silver', l: '银牌 / 二等' },
                      { v: 'bronze', l: '铜牌 / 三等' },
                      { v: 'honor',  l: '荣誉奖' },
                    ].map(({ v, l }) => `
                      <button type="button"
                        class="rec-chip${state.profile.competition.medal === v ? ' active' : ''}"
                        onclick="RecommenderModule._setCompMedal('${v}')">
                        ${l}
                      </button>
                    `).join('')}
                  </div>` : '';
                return medalHtml + `<div style="font-size:11px;color:#6B7280;margin-top:6px;">
                  学术强度加成：+${pts} 分（满分100）
                </div>`;
              })()}
            </div>

            <!-- 科研经历 -->
            <div class="rec-field-group">
              <div class="rec-label">科研经历</div>
              <div class="rec-chip-group rec-chip-group--col">
                ${[
                  { v: 'none',   l: '无',   sub: '未参与正式科研' },
                  { v: 'basic',  l: '基础', sub: '夏校项目 / 实验室助理 / 课题组参与' },
                  { v: 'strong', l: '强势', sub: '有发表论文 / 专利 / 机构认证成果' },
                ].map(({ v, l, sub }) => `
                  <button type="button"
                    class="rec-chip rec-chip--row${state.profile.research_exp === v ? ' active' : ''}"
                    onclick="RecommenderModule._updateProfile({research_exp: '${v}'})">
                    <span class="rec-chip-main">${l}</span>
                    <span class="rec-chip-sub">${sub}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 校内任职 -->
            <div class="rec-field-group">
              <div class="rec-label">校内任职 / 领导力</div>
              <div class="rec-chip-group rec-chip-group--col">
                ${[
                  { v: 'none',    l: '无',     sub: '无任职或普通成员' },
                  { v: 'officer', l: '干部',   sub: '班委 / 社团干部 / 学生会成员' },
                  { v: 'founder', l: '领袖',   sub: '学生会主席 / 社团创始人 / 市级以上代表' },
                ].map(({ v, l, sub }) => `
                  <button type="button"
                    class="rec-chip rec-chip--row${state.profile.leadership === v ? ' active' : ''}"
                    onclick="RecommenderModule._updateProfile({leadership: '${v}'})">
                    <span class="rec-chip-main">${l}</span>
                    <span class="rec-chip-sub">${sub}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 公益服务 -->
            <div class="rec-field-group">
              <div class="rec-label">公益 / 社区服务</div>
              <div class="rec-chip-group rec-chip-group--col">
                ${[
                  { v: 'none',    l: '无',       sub: '未参与或零散参加' },
                  { v: 'regular', l: '定期参与', sub: '长期志愿者 / 公益组织成员' },
                  { v: 'impact',  l: '有影响力', sub: '主导项目 / 受益人显著 / 媒体报道' },
                ].map(({ v, l, sub }) => `
                  <button type="button"
                    class="rec-chip rec-chip--row${state.profile.community_service === v ? ' active' : ''}"
                    onclick="RecommenderModule._updateProfile({community_service: '${v}'})">
                    <span class="rec-chip-main">${l}</span>
                    <span class="rec-chip-sub">${sub}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 免标化申请 -->
            <div class="rec-field-group">
              <label class="rec-checkbox-label">
                <input type="checkbox" id="rec-test-optional"
                  ${state.profile.test_optional_apply ? 'checked' : ''}
                  onchange="RecommenderModule._updateProfile({test_optional_apply: this.checked})">
                以免标化方式申请（不提交 SAT / ACT，适用任何课程体系）
              </label>
            </div>
          </div>

          <!-- Step 2：申请偏好 -->
          <div class="rec-section">
            <div class="rec-step-label">Step 02</div>
            <div class="rec-section-title">申请偏好</div>

            <!-- 目标国家 -->
            <div class="rec-field-group">
              <div class="rec-label">目标国家 <span class="rec-label-hint">（可多选）</span></div>
              <div class="rec-chip-group" id="rec-country-chips">
                ${['US','GB','HK','SG','CA','AU'].map(c => `
                  <button type="button"
                    class="rec-chip${state.profile.target_countries.includes(c) ? ' active' : ''}"
                    onclick="RecommenderModule._toggleCountry('${c}')">
                    ${COUNTRY_FLAG[c]} ${c}
                  </button>
                `).join('')}
              </div>
              <div id="rec-err-country" class="rec-field-error" style="display:none;">请至少选择一个目标国家</div>
            </div>

            <!-- 英国G5笔试（仅选了GB时显示） -->
            ${state.profile.target_countries.includes('GB') ? `
            <div class="rec-field-group">
              <div class="rec-label">英国G5前置笔试（预估） <span class="rec-label-hint">（仅填你会参加的）</span></div>
              <div style="font-size:11px;color:#6B7280;margin-bottom:10px;">笔试通常在10月进行，此处填写<strong>预估表现</strong>，仅作参考定位，不影响实际申请结果。不参加或尚未确定选"—"。</div>
              ${Object.entries(UK_TEST_INFO).map(([key, info]) => `
                <div style="margin-bottom:12px;">
                  <div style="font-size:13px;font-weight:600;color:#1A1A2E;">${info.label}
                    <span style="font-size:11px;font-weight:400;color:#6B7280;margin-left:4px;">${info.desc}</span>
                  </div>
                  <div class="rec-chip-group" style="margin-top:5px;">
                    ${[
                      { v: 'na',      l: '—' },
                      { v: 'weak',    l: '预估偏弱' },
                      { v: 'average', l: '预估一般' },
                      { v: 'strong',  l: '预估良好' },
                      { v: 'top',     l: '预估Top 10%' },
                    ].map(({ v, l }) => `
                      <button type="button"
                        class="rec-chip${(state.profile.uk_written_tests[key] ?? 'na') === v ? ' active' : ''}"
                        onclick="RecommenderModule._setUKTest('${key}','${v}')">
                        ${l}
                      </button>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <!-- 意向专业 -->
            <div class="rec-field-group">
              <label class="rec-label" for="rec-major">意向专业</label>
              <select id="rec-major" class="rec-select"
                onchange="RecommenderModule._updateProfile({major_interest: this.value})">
                ${Object.entries(MAJOR_MAP).map(([k, v]) => `
                  <option value="${k}" ${state.profile.major_interest === k ? 'selected' : ''}>${v.label}</option>
                `).join('')}
              </select>
            </div>

            <!-- 年预算 -->
            <div class="rec-field-group">
              <div class="rec-label">年预算（学费+生活费，USD）</div>
              <div class="rec-chip-group rec-chip-group--wrap">
                ${['<30k','30–50k','50–80k','>80k'].map(v => `
                  <button type="button"
                    class="rec-chip${state.profile.budget_usd === v ? ' active' : ''}"
                    onclick="RecommenderModule._updateProfile({budget_usd: '${v}'})">
                    ${v}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 最重视因素 -->
            <div class="rec-field-group">
              <div class="rec-label">最重视因素</div>
              <div class="rec-chip-group rec-chip-group--col">
                ${[
                  { v: 'ranking',     l: '名校排名', sub: '以 QS / USNews 排名为优先' },
                  { v: 'scholarship', l: '奖学金',   sub: '国际生奖学金覆盖学费' },
                  { v: 'coop',        l: '带薪实习', sub: 'Co-op / 工作实习项目' },
                  { v: 'post_work',   l: '毕业工签', sub: '工作签证时长 OPT / PSW' },
                  { v: 'life_quality',l: '生活品质', sub: '城市活力 + 华人社区' },
                ].map(({ v, l, sub }) => `
                  <button type="button"
                    class="rec-chip rec-chip--row${state.profile.priority === v ? ' active' : ''}"
                    onclick="RecommenderModule._updateProfile({priority: '${v}'})">
                    <span class="rec-chip-main">${l}</span>
                    <span class="rec-chip-sub">${sub}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- 仅显示有奖学金院校 -->
            <div class="rec-field-group">
              <label class="rec-checkbox-label">
                <input type="checkbox" id="rec-scholarship-only"
                  ${state.profile.scholarship_only ? 'checked' : ''}
                  onchange="RecommenderModule._updateProfile({scholarship_only: this.checked})">
                仅显示有国际生奖学金的院校
              </label>
            </div>
          </div>

          <!-- 生成按钮 -->
          <button type="button" class="rec-submit-btn" onclick="RecommenderModule.generate()">
            生成定位方案 →
          </button>

        </form>

        <!-- 结果区（初始隐藏） -->
        <div id="rec-results-wrap" style="${state.results === null ? 'display:none' : ''}">
          ${renderResultsHTML()}
        </div>

      </div>
    `;
  }

  /** 仅同步联动字段（避免整体重建） */
  function syncFormFields() {
    // 课程体系字段显示/隐藏
    ['ap','alevel','ib'].forEach(c => {
      const el = document.getElementById(`rec-fields-${c}`);
      if (el) el.style.display = state.profile.curriculum === c ? '' : 'none';
    });
    // chip 选中状态同步（国家、课程体系等）
    // 已通过 onclick 动态更新 class，这里不需要额外处理
  }

  // ── 渲染：结果区 ─────────────────────────────────────────────────────────

  function renderResults() {
    const wrap = document.getElementById('rec-results-wrap');
    if (!wrap) return;
    if (state.results === null) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';
    wrap.innerHTML = renderResultsHTML();
  }

  function renderResultsHTML() {
    if (state.results === null) return '';
    if (state.results.length === 0) {
      return `
        <div class="rec-empty">
          <div class="rec-empty-icon">🔍</div>
          <div class="rec-empty-title">当前条件无匹配院校</div>
          <div class="rec-empty-hint">建议：放宽预算限制 / 增加目标国家 / 检查语言成绩是否满足最低要求</div>
          <button class="rec-reset-btn" onclick="RecommenderModule.reset()">重新调整条件</button>
        </div>
      `;
    }

    const byTier = { safe: [], target: [], reach: [] };
    for (const r of state.results) byTier[r.tier].push(r);

    const total = state.results.length;
    const safeN = byTier.safe.length, targetN = byTier.target.length, reachN = byTier.reach.length;

    return `
      <div class="rec-results">
        <!-- 摘要头 -->
        <div class="rec-summary">
          <div class="rec-summary-title">定位方案已生成 · 共匹配 ${total} 所院校</div>
          <div class="rec-summary-dist">
            保底 ${safeN} 所 &nbsp;/&nbsp; 目标 ${targetN} 所 &nbsp;/&nbsp; 冲刺 ${reachN} 所
          </div>
          <div class="rec-summary-actions">
            <button class="rec-reset-btn" onclick="RecommenderModule.reset()">重新填写</button>
          </div>
        </div>

        <!-- 梯队分组 -->
        ${['reach','target','safe'].map(tier => byTier[tier].length ? `
          <div class="rec-tier-group">
            <div class="rec-tier-header">
              <span class="rec-tier-chip ${TIER_CONFIG[tier].className}">${TIER_CONFIG[tier].label}</span>
              <span class="rec-tier-count">${byTier[tier].length} 所</span>
            </div>
            <div class="rec-card-list">
              ${byTier[tier].map(r => renderCardHTML(r)).join('')}
            </div>
          </div>
        ` : '').join('')}

        <!-- 免责声明 -->
        <div class="rec-disclaimer">
          数据截至 2025–2026 学年，仅供参考，不构成录取保证。学费、要求以官网为准。
          A-Level 要求仅覆盖 10/17 所英国院校，其余院校以录取率代理评分。
        </div>
      </div>
    `;
  }

  // ── 渲染：院校卡片 ───────────────────────────────────────────────────────

  function renderCardHTML({ school: s, matchScore, tier }) {
    const flag = COUNTRY_FLAG[s.country] ?? '';
    const rankStr = s.usnews_rank_2026
      ? `USNews #${s.usnews_rank_2026}`
      : (s.qs_rank_2025 ? `QS #${s.qs_rank_2025}` : '');
    const cityStr = s.city ? s.city.split(',')[0] : '';
    const typeStr = s.type === 'public' ? '公立' : s.type === 'private' ? '私立' : '';
    const meta = [cityStr, typeStr, rankStr].filter(Boolean).join(' · ');
    const pct = matchScore;

    return `
      <div class="rec-card" id="rec-card-${s.id}" onclick="RecommenderModule._toggleCard('${s.id}')">
        <div class="rec-card-header">
          <span class="rec-tier-chip ${TIER_CONFIG[tier].className} rec-tier-chip--sm">${TIER_CONFIG[tier].label}</span>
          <div class="rec-card-name">${flag} ${s.name_zh || s.name_en}</div>
        </div>
        ${meta ? `<div class="rec-card-meta">${meta}</div>` : ''}
        <div class="rec-score-row">
          <div class="rec-score-bar-wrap">
            <div class="rec-score-bar" style="width:0%" data-pct="${pct}%"></div>
          </div>
          <span class="rec-score-num">${pct}</span>
        </div>
        <!-- 展开区 -->
        <div class="rec-card-expanded" id="rec-exp-${s.id}" style="max-height:0;overflow:hidden;transition:max-height 300ms ease;">
          ${renderCardExpandedHTML(s)}
        </div>
        <div class="rec-card-toggle">展开详情 <span class="rec-toggle-icon" id="rec-icon-${s.id}">∨</span></div>
      </div>
    `;
  }

  function renderCardExpandedHTML(s) {
    const tuitionUSD = toUSD(s.tuition_intl_annual ?? 0, s.tuition_currency ?? 'USD');
    const livingUSD  = toUSD(s.avg_living_cost_annual ?? 0, s.tuition_currency ?? 'USD');
    const rateStr = s.acceptance_rate ? (s.acceptance_rate * 100).toFixed(0) + '%' : '—';
    const pswStr  = s.post_study_work ? s.post_study_work + ' 个月' : '—';
    const majorsStr = (s.popular_majors ?? []).slice(0, 5).join(' · ') || '—';
    const tagsHTML = (s.tags ?? []).map(t => `<span class="rec-tag">#${t}</span>`).join('');

    return `
      <div class="rec-expanded-inner" onclick="event.stopPropagation()">
        <!-- 4格指标 -->
        <div class="rec-metrics">
          <div class="rec-metric-card">
            <div class="rec-metric-val">$${(tuitionUSD / 1000).toFixed(0)}k</div>
            <div class="rec-metric-label">年学费</div>
          </div>
          <div class="rec-metric-card">
            <div class="rec-metric-val">$${(livingUSD / 1000).toFixed(0)}k</div>
            <div class="rec-metric-label">年生活费</div>
          </div>
          <div class="rec-metric-card">
            <div class="rec-metric-val">${rateStr}</div>
            <div class="rec-metric-label">录取率</div>
          </div>
          <div class="rec-metric-card">
            <div class="rec-metric-val">${pswStr}</div>
            <div class="rec-metric-label">工签时长</div>
          </div>
        </div>

        <!-- 雷达图 -->
        <div class="rec-radar-wrap">
          <canvas id="radar-${s.id}" role="img" aria-label="${s.name_zh || s.name_en} 五维评分雷达图"
            style="width:200px;height:180px;"></canvas>
        </div>

        <!-- 申请信息 -->
        <div class="rec-detail-rows">
          ${s.application_deadline_fall ? `<div class="rec-detail-row"><span>申请截止</span><span>${s.application_deadline_fall}</span></div>` : ''}
          ${s.application_system ? `<div class="rec-detail-row"><span>申请体系</span><span>${s.application_system}</span></div>` : ''}
          <div class="rec-detail-row">
            <span>语言要求</span>
            <span>
              ${s.ielts_min ? 'IELTS ' + s.ielts_min : ''}
              ${s.ielts_min && s.toefl_min ? ' / ' : ''}
              ${s.toefl_min ? 'TOEFL ' + s.toefl_min : ''}
              ${!s.ielts_min && !s.toefl_min ? '—' : ''}
            </span>
          </div>
          <div class="rec-detail-row"><span>热门专业</span><span class="rec-detail-majors">${majorsStr}</span></div>
        </div>

        ${s.special_notes ? `<div class="rec-special-notes">${s.special_notes}</div>` : ''}

        ${tagsHTML ? `<div class="rec-tags">${tagsHTML}</div>` : ''}

        <!-- 操作按钮 -->
        <div class="rec-card-actions">
          <button class="rec-action-btn rec-action-btn--primary"
            onclick="RecommenderModule._deepAnalyze('${s.id}')">
            深度分析 ↗
          </button>
        </div>
      </div>
    `;
  }

  // ── 交互：卡片展开/收起 ─────────────────────────────────────────────────

  function _toggleCard(id) {
    const exp = document.getElementById(`rec-exp-${id}`);
    const icon = document.getElementById(`rec-icon-${id}`);
    const card = document.getElementById(`rec-card-${id}`);
    if (!exp) return;

    const isOpen = exp.style.maxHeight !== '0px' && exp.style.maxHeight !== '';
    if (isOpen) {
      exp.style.maxHeight = '0';
      if (icon) icon.textContent = '∨';
      if (card) card.classList.remove('expanded');
    } else {
      exp.style.maxHeight = exp.scrollHeight + 'px';
      if (icon) icon.textContent = '∧';
      if (card) card.classList.add('expanded');
      // 延迟初始化雷达图，避免隐藏 canvas 尺寸计算错误
      const school = state.schools.find(s => s.id === id);
      if (school) {
        setTimeout(() => drawRadar(`radar-${id}`, school), 80);
      }
      // 触发进度条动画
      setTimeout(() => {
        const bar = exp.querySelector('.rec-score-bar');
        if (bar) bar.style.width = bar.dataset.pct;
      }, 50);
    }
  }

  // ── 交互：雷达图 ─────────────────────────────────────────────────────────

  function drawRadar(canvasId, school) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvasId);
    if (existing) existing.destroy();

    new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['排名', '就业', '奖学金', '语言友好', '签证'],
        datasets: [{
          data: calcRadarData(school),
          backgroundColor: 'rgba(29,158,117,0.10)',
          borderColor: '#1D9E75',
          pointBackgroundColor: '#1D9E75',
          pointRadius: 3,
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { display: false },
            grid: { color: 'rgba(128,128,128,0.12)' },
            angleLines: { color: 'rgba(128,128,128,0.08)' },
            pointLabels: {
              font: { size: 11, family: "'IBM Plex Mono', monospace" },
              color: '#888',
            },
          },
        },
      },
    });
  }

  // ── 交互：深度分析 ───────────────────────────────────────────────────────

  function _deepAnalyze(schoolId) {
    const school = state.schools.find(s => s.id === schoolId);
    if (!school) return;
    const p = state.profile;
    const scoreStr = p.curriculum === 'ap'
      ? `AP ${p.score_ap ?? '—'} 门（平均 ${p.score_ap_avg} 分）`
      : p.curriculum === 'alevel'
      ? `A-Level ${p.score_alevel}`
      : `IB ${p.score_ib ?? '—'} 分`;
    const prompt = `请详细分析 ${school.name_zh || school.name_en}（${school.name_en}）对以下学生的录取可能性与申请策略：
课程体系：${p.curriculum.toUpperCase()}，成绩：${scoreStr}
GPA：${p.gpa_us ?? '—'}，英语：${p.english_test.toUpperCase()} ${p.english_test !== 'native' ? p.english_score ?? '—' : '母语'}
意向专业：${MAJOR_MAP[p.major_interest]?.label ?? p.major_interest}
课外活动：${p.ec_level}`;

    if (typeof sendPrompt === 'function') {
      sendPrompt(prompt);
    } else {
      navigator.clipboard.writeText(prompt).then(() => {
        showToast('分析提示词已复制到剪贴板');
      });
    }
  }

  /** 简单 Toast 提示 */
  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'rec-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // ── 公开 API ─────────────────────────────────────────────────────────────

  /** 初始化（tab 切换时调用） */
  async function init() {
    if (!initialized) {
      // 尝试恢复历史画像
      const saved = loadProfile();
      if (saved) {
        const { _ts, ...profile } = saved;
        Object.assign(state.profile, profile);
      }
      initialized = true;
    }
    // 触发首次渲染（表单）
    render();
    // 异步加载数据
    await loadSchools();
    // 触发进度条动画（首屏可见卡片）
    triggerScoreBars();
  }

  /** 生成定位方案 */
  function generate() {
    // 验证：目标国家
    if (state.profile.target_countries.length === 0) {
      const err = document.getElementById('rec-err-country');
      if (err) err.style.display = 'block';
      return;
    }
    const err = document.getElementById('rec-err-country');
    if (err) err.style.display = 'none';

    // 隐藏变更 banner
    const banner = document.getElementById('rec-change-banner');
    if (banner) banner.style.display = 'none';

    if (state.schools.length === 0) {
      showToast('院校数据加载中，请稍候...');
      return;
    }

    const results = runMatch();
    updateState({ results });

    // 滚动到结果区
    const wrap = document.getElementById('rec-results-wrap');
    if (wrap) {
      wrap.style.display = '';
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 触发进度条动画
    setTimeout(triggerScoreBars, 100);
  }

  /** 触发所有可见进度条动画 */
  function triggerScoreBars() {
    document.querySelectorAll('.rec-score-bar[data-pct]').forEach(bar => {
      bar.style.transition = 'width 600ms ease';
      bar.style.width = bar.dataset.pct;
    });
  }

  /** 重置：清空结果，滚回表单顶部 */
  function reset() {
    updateState({ results: null });
    const wrap = document.getElementById('rec-root');
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── 内部事件处理（供 HTML 内联调用） ────────────────────────────────────

  function _setCurriculum(c) {
    updateProfile({ curriculum: c });
    // 更新 chip 选中状态
    document.querySelectorAll('#rec-curriculum-chips .rec-chip').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === c ||
        (c === 'alevel' && btn.textContent.trim() === 'A-Level') ||
        (c === 'ap' && btn.textContent.trim() === 'AP') ||
        (c === 'ib' && btn.textContent.trim() === 'IB'));
    });
    // 切换字段显示
    ['ap','alevel','ib'].forEach(tab => {
      const el = document.getElementById(`rec-fields-${tab}`);
      if (el) el.style.display = c === tab ? '' : 'none';
    });
  }

  function _setEnglishTest(v) {
    updateProfile({ english_test: v, english_score: null });
    // 英语成绩字段需要重建（因为 placeholder/step 变化），触发整体 re-render
    const root = document.getElementById('rec-root');
    if (root) {
      root.innerHTML = '';
      initialized = false; // 强制重建表单
    }
    render();
  }

  function _toggleCountry(c) {
    const countries = [...state.profile.target_countries];
    const idx = countries.indexOf(c);
    if (idx >= 0) {
      countries.splice(idx, 1);
    } else {
      countries.push(c);
    }
    updateProfile({ target_countries: countries });
    // 更新 chip 选中状态
    document.querySelectorAll('#rec-country-chips .rec-chip').forEach(btn => {
      const flag = btn.textContent.trim().split(' ')[1]; // "🇺🇸 US" → "US"
      btn.classList.toggle('active', countries.includes(flag));
    });
  }

  function _setUKTest(testKey, level) {
    updateProfile({ uk_written_tests: { ...state.profile.uk_written_tests, [testKey]: level } });
  }

  function _setComp(compKey) {
    updateProfile({ competition: { comp: compKey, medal: '' } });
  }

  function _setCompMedal(medal) {
    updateProfile({ competition: { ...state.profile.competition, medal } });
  }

  function _updateProfile(patch) {
    updateProfile(patch);
  }

  // ── 公开对象 ─────────────────────────────────────────────────────────────

  return {
    init,
    generate,
    reset,
    _toggleCard,
    _deepAnalyze,
    _setCurriculum,
    _setEnglishTest,
    _toggleCountry,
    _updateProfile,
    _setComp,
    _setCompMedal,
    _setUKTest,
  };

})();

window.RecommenderModule = RecommenderModule;
