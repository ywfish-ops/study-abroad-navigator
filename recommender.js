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

  /** 梯队配置 */
  const TIER_CONFIG = {
    safe:   { label: '保', className: 'tier-safe',   order: 0 },
    target: { label: '稳', className: 'tier-target',  order: 1 },
    reach:  { label: '冲', className: 'tier-reach',   order: 2 },
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

    if (curriculum === 'ap') {
      if (school.sat_range) {
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
        const gap = userScore - schoolReq;
        if (gap >= 1) base = 40;
        else if (gap === 0) base = 28;
        else if (gap === -1) base = 16;
        else base = 6;
      } else {
        // 无 A-Level 要求数据（非英国院校或数据缺失），用录取率代理
        base = rateScore(school.acceptance_rate);
      }
    } else { // ib
      const ib = score_ib || 30;
      const rate = school.acceptance_rate;
      if (ib >= 38) {
        base = rate <= 0.15 ? 10 : rate <= 0.30 ? 28 : 38;
      } else if (ib >= 32) {
        base = rate <= 0.25 ? 28 : rate <= 0.50 ? 33 : 38;
      } else {
        base = rate <= 0.50 ? 20 : 38;
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
    return Math.max(0, base + penalty);
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

  /** 梯队判定 */
  function getTier(score) {
    if (score >= 72) return 'safe';
    if (score >= 52) return 'target';
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
  function runMatch() {
    const results = [];
    for (const school of state.schools) {
      if (!isEligible(school, state.profile)) continue;
      const matchScore = calcMatchScore(school, state.profile);
      const tier = getTier(matchScore);
      results.push({ school, matchScore, tier });
    }
    // 排序：先梯队（safe→target→reach），同梯队内按分数降序
    const TIER_ORDER = { safe: 0, target: 1, reach: 2 };
    results.sort((a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.matchScore - a.matchScore
    );
    return results;
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

            <!-- 课外活动 -->
            <div class="rec-field-group">
              <div class="rec-label">课外活动水平</div>
              <div class="rec-chip-group rec-chip-group--col">
                ${[
                  { v: 'strong', l: '强势', sub: '国际竞赛 / 科研 / 创业' },
                  { v: 'good',   l: '良好', sub: '省级 / 校级荣誉' },
                  { v: 'basic',  l: '一般', sub: '普通参与' },
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
        ${['safe','target','reach'].map(tier => byTier[tier].length ? `
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
  };

})();

window.RecommenderModule = RecommenderModule;
