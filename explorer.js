/**
 * explorer.js — 模块 0：选校探索
 *
 * 提供学校卡片浏览、多维度筛选、加入财务对比功能。
 * 依赖 Utils（utils.js 必须先加载）。
 */

const ExplorerModule = (() => {
  'use strict';

  // ─── 常量 ──────────────────────────────────────────────────────────────────

  const COMPARE_KEY = 'gs_explorer_compare_v1';
  const MAX_COMPARE = 5;

  const COUNTRY_LABELS = {
    US: { flag: '🇺🇸', name: '美国' },
    GB: { flag: '🇬🇧', name: '英国' },
    AU: { flag: '🇦🇺', name: '澳大利亚' },
    CA: { flag: '🇨🇦', name: '加拿大' },
    HK: { flag: '🇭🇰', name: '香港' },
    SG: { flag: '🇸🇬', name: '新加坡' },
  };

  const DIFFICULTY_CONFIG = {
    S: { label: 'S', color: '#7C3AED', bg: '#EDE9FE', desc: '顶尖选拔', maxRate: 0.10 },
    A: { label: 'A', color: '#1D4ED8', bg: '#DBEAFE', desc: '高度选拔', maxRate: 0.30 },
    B: { label: 'B', color: '#065F46', bg: '#D1FAE5', desc: '中度选拔', maxRate: 0.60 },
    C: { label: 'C', color: '#92400E', bg: '#FEF3C7', desc: '相对开放', maxRate: 1.01 },
  };

  // 专业分组关键词（大写匹配）
  const MAJOR_GROUPS = {
    business:   ['BUSINESS', 'FINANCE', 'ECONOMICS', 'ACCOUNTING', 'MANAGEMENT', 'COMMERCE', 'MARKETING'],
    cs_eng:     ['COMPUTER', 'ENGINEERING', 'DATA SCIENCE', 'COMPUTING', 'SOFTWARE', ' IT', 'INFORMATICS', 'AI &'],
    science:    ['BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'MATHEMATICS', 'STATISTICS', 'SCIENCE', 'BIOCHEMISTRY'],
    humanities: ['PHILOSOPHY', 'HISTORY', 'POLITICAL', 'INTERNATIONAL', 'GOVERNMENT', 'LAW', 'SOCIAL', 'LIBERAL ARTS'],
    arts_media: ['ARTS', 'FILM', 'DESIGN', 'MUSIC', 'MEDIA', 'COMMUNICATIONS', 'JOURNALISM', 'ARCHITECTURE'],
    health:     ['MEDICINE', 'HEALTH', 'NURSING', 'PHARMACY', 'BIOMEDICAL', 'PRE-MED'],
  };

  const MAJOR_GROUP_LABELS = {
    business:   '商科金融',
    cs_eng:     'CS / 工程',
    science:    '理科',
    humanities: '人文社科',
    arts_media: '艺术传媒',
    health:     '医学健康',
  };

  const SETTING_LABELS = {
    urban:    '城市',
    suburban: '郊区',
    rural:    '小镇',
  };

  // ─── 状态 ──────────────────────────────────────────────────────────────────

  let _schools = [];
  let _rates = {};
  let _initialized = false;

  const _filters = {
    search: '',
    countries: [],
    difficulties: [],
    major: '',
    budgetMax: 300,     // 万元 CNY，300 = 不限
    settings: [],
    types: [],          // 'public' | 'private'
    ieltsMax: 0,        // 0 = 不限；6.5 = 最低 ≤6.5；7 = 最低 ≤7.0
    scholarshipOnly: false,
    testOptional: false,   // true = 仅显示 test-optional 或 test-blind
    pswMin: 0,          // 0 = 不限；24 = 工签≥24个月；36 = ≥36个月
    chineseCommunity: [],  // 'large' | 'medium' | 'small'
  };

  // ─── 工具函数 ──────────────────────────────────────────────────────────────

  /** 根据录取率返回难度档位代码 */
  function getDifficulty(school) {
    const r = school.acceptance_rate;
    if (r == null) return null;
    if (r < 0.10) return 'S';
    if (r < 0.30) return 'A';
    if (r < 0.60) return 'B';
    return 'C';
  }

  /** 检查学校是否包含某专业分组 */
  function schoolMatchesMajorGroup(school, groupKey) {
    const majors = school.popular_majors || [];
    const keywords = MAJOR_GROUPS[groupKey] || [];
    return majors.some(m => {
      const upper = m.toUpperCase();
      return keywords.some(kw => upper.includes(kw));
    });
  }

  /** 获取标化考试政策：'blind'（不接受）| 'optional'（可选）| 'required'（必须） */
  function getTestPolicy(school) {
    const tags = school.tags || [];
    if (tags.includes('test-blind')) return 'blind';
    if (tags.includes('test-optional')) return 'optional';
    return 'required';
  }

  /**
   * 获取本科学制年数。
   * 苏格兰（4-year-degree tag）→ 4年；英格兰/威尔士 GB → 3年（BSc基准）；其他 → 4年。
   */
  function getStudyYears(school) {
    const tags = school.tags || [];
    if (tags.includes('4-year-degree')) return 4;
    if (tags.includes('3-year-degree')) return 3;
    return school.country === 'GB' ? 3 : 4;
  }

  /**
   * 英格兰/威尔士学校同时提供 BSc(3年) 和 MSci/MEng(4年) 两轨，
   * 需要显示双预算。苏格兰（有 4-year-degree tag）是单一4年制。
   */
  function isEnglandWales(school) {
    const tags = school.tags || [];
    return school.country === 'GB' && !tags.includes('4-year-degree');
  }

  /** 按指定年数计算本科总费用（CNY，万元） */
  function calcTotalCNY(school, years) {
    const tuition = school.tuition_intl_annual;
    const living = school.avg_living_cost_annual;
    if (!tuition) return null;
    const currency = school.tuition_currency || 'USD';
    const totalLocal = (tuition + (living || 0)) * years;
    const cnyRate = _rates['CNY'] || 7.25;
    const usdRate = _rates[currency] || 1;
    return Math.round((totalLocal / usdRate) * cnyRate / 10000); // 万元
  }

  /** 计算本科总费用（CNY，万元），用于筛选（英格兰/威尔士以BSc 3年为基准） */
  function calc4YearCNY(school) {
    return calcTotalCNY(school, getStudyYears(school));
  }

  /** 过滤学校列表 */
  function applyFilters(schools) {
    return schools.filter(s => {
      // 关键词搜索
      if (_filters.search) {
        const q = _filters.search.toLowerCase();
        const hit = (s.name_zh || '').includes(_filters.search)
          || (s.name_en || '').toLowerCase().includes(q)
          || (s.city || '').toLowerCase().includes(q)
          || (s.id || '').toLowerCase().includes(q);
        if (!hit) return false;
      }

      // 国家
      if (_filters.countries.length && !_filters.countries.includes(s.country)) return false;

      // 难度档位
      if (_filters.difficulties.length) {
        const d = getDifficulty(s);
        if (!d || !_filters.difficulties.includes(d)) return false;
      }

      // 专业方向
      if (_filters.major && !schoolMatchesMajorGroup(s, _filters.major)) return false;

      // 4年预算
      if (_filters.budgetMax < 300) {
        const budget = calc4YearCNY(s);
        if (budget != null && budget > _filters.budgetMax) return false;
      }

      // 城市规模
      if (_filters.settings.length && !_filters.settings.includes(s.campus_setting)) return false;

      // 学校性质（public/private 匹配 type 字段；lac 匹配 liberal-arts tag）
      if (_filters.types.length) {
        const tags = s.tags || [];
        const isLac = tags.includes('liberal-arts') || tags.includes('liberal-arts-focus');
        const typeMatch = _filters.types.includes(s.type);
        const lacMatch = _filters.types.includes('lac') && isLac;
        if (!typeMatch && !lacMatch) return false;
      }

      // IELTS 要求上限
      if (_filters.ieltsMax > 0 && s.ielts_min != null && s.ielts_min > _filters.ieltsMax) return false;

      // 仅显示有奖学金
      if (_filters.scholarshipOnly && !s.scholarship_intl) return false;

      // 仅显示 test-optional / test-blind
      if (_filters.testOptional && getTestPolicy(s) === 'required') return false;

      // 毕业后工签最短时长
      if (_filters.pswMin > 0 && (s.post_study_work == null || s.post_study_work < _filters.pswMin)) return false;

      // 中国学生社区
      if (_filters.chineseCommunity.length && !_filters.chineseCommunity.includes(s.chinese_student_community)) return false;

      return true;
    });
  }

  // ─── 渲染 ──────────────────────────────────────────────────────────────────

  /** 渲染难度标签 HTML */
  function renderDifficultyBadge(school) {
    const d = getDifficulty(school);
    if (!d) return '';
    const cfg = DIFFICULTY_CONFIG[d];
    return `<span style="font-size:11px; font-weight:700; padding:2px 7px; border-radius:4px;
      background:${cfg.bg}; color:${cfg.color};">${d} 档</span>`;
  }

  /** 渲染国旗 + 国家名 */
  function renderCountry(school) {
    const c = COUNTRY_LABELS[school.country] || { flag: '', name: school.country };
    return `<span style="font-size:13px;">${c.flag} ${c.name}</span>`;
  }

  /** 渲染本科总预算（英格兰/威尔士显示 BSc/MSci 双轨） */
  function renderBudget(school) {
    if (isEnglandWales(school)) {
      const bsc = calcTotalCNY(school, 3);
      const msci = calcTotalCNY(school, 4);
      if (bsc == null) return '<span style="color:#9CA3AF; font-size:12px;">费用待补充</span>';
      return `<span style="font-size:12px; color:#1A1A2E;">BSc 3年 <strong>¥${bsc}万</strong> / MSci 4年 <strong>¥${msci}万</strong></span>`;
    }
    const wan = calc4YearCNY(school);
    if (wan == null) return '<span style="color:#9CA3AF; font-size:12px;">费用待补充</span>';
    const years = getStudyYears(school);
    return `<span style="font-size:13px; color:#1A1A2E;">${years}年约 <strong>¥${wan}万</strong></span>`;
  }

  /** 渲染单张学校卡片（点击卡片主体弹出详情） */
  function renderCard(school) {
    const compareList = Utils.storage.get(COMPARE_KEY) || [];
    const inCompare = compareList.includes(school.id);
    const rankText = school.country === 'US'
      ? (school.usnews_rank_2026 ? `US News #${school.usnews_rank_2026}` : (school.qs_rank_2025 ? `QS #${school.qs_rank_2025}` : ''))
      : (school.qs_rank_2025 ? `QS #${school.qs_rank_2025}` : '');

    return `
<div class="explorer-card" id="explorer-card-${school.id}"
  onclick="ExplorerModule.openDetail('${school.id}')" style="cursor:pointer;">
  <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
    ${renderCountry(school)}
    ${renderDifficultyBadge(school)}
    ${getTestPolicy(school) === 'blind' ? '<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#F1F5F9;color:#64748B;">无需标化</span>' : ''}
    ${getTestPolicy(school) === 'optional' ? '<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#F1F5F9;color:#64748B;">标化可选</span>' : ''}
  </div>
  <div style="margin-bottom:2px;">
    <span style="font-size:16px; font-weight:600; color:#1A1A2E;">${school.name_zh || school.name_en}</span>
  </div>
  <div style="font-size:12px; color:#6B7280; margin-bottom:8px;">${school.name_en}</div>
  <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
    <div style="display:flex; gap:12px; align-items:center;">
      <span style="font-size:12px; color:#6B7280;">${rankText}</span>
      ${renderBudget(school)}
    </div>
    <button class="explorer-compare-btn ${inCompare ? 'in-compare' : ''}"
      onclick="event.stopPropagation(); ExplorerModule.toggleCompare('${school.id}')"
      style="font-size:12px; padding:6px 12px; border-radius:6px; border:1.5px solid;
        cursor:pointer; white-space:nowrap; min-height:36px;
        ${inCompare
          ? 'background:#EEF3FD; color:#2B5CE6; border-color:#2B5CE6;'
          : 'background:#fff; color:#6B7280; border-color:#D1D5DB;'}">
      ${inCompare ? '✓ 已加入对比' : '加入财务对比'}
    </button>
  </div>
</div>`;
  }

  // ─── 详情面板（Bottom Sheet）─────────────────────────────────────────────

  /** 渲染一行信息条目 */
  function detailRow(label, value) {
    if (value == null || value === '' || value === false) return '';
    return `
<div style="display:flex; justify-content:space-between; align-items:flex-start;
  padding:10px 0; border-bottom:1px solid #F3F4F6; gap:12px;">
  <span style="font-size:13px; color:#6B7280; flex-shrink:0;">${label}</span>
  <span style="font-size:13px; color:#1A1A2E; text-align:right; font-weight:500;">${value}</span>
</div>`;
  }

  /** 渲染详情 bottom sheet 并注入 body */
  function renderDetailSheet(school) {
    const compareList = Utils.storage.get(COMPARE_KEY) || [];
    const inCompare = compareList.includes(school.id);
    const d = getDifficulty(school);
    const cfg = d ? DIFFICULTY_CONFIG[d] : null;
    const country = COUNTRY_LABELS[school.country] || { flag: '', name: school.country };
    const wan = calc4YearCNY(school);
    const years = getStudyYears(school);
    const engWales = isEnglandWales(school);
    const budgetText = engWales
      ? (calcTotalCNY(school, 3) ? `BSc ¥${calcTotalCNY(school, 3)}万 / MSci ¥${calcTotalCNY(school, 4)}万` : null)
      : (wan ? `¥${wan}万 CNY` : null);
    const schoolTags = school.tags || [];
    const isLac = schoolTags.includes('liberal-arts') || schoolTags.includes('liberal-arts-focus');
    const schoolTypeText = isLac
      ? (school.type === 'public' ? '公立文理学院 (LAC)' : '私立文理学院 (LAC)')
      : (school.type === 'public' ? '公立大学' : '私立大学');
    const tuitionText = school.tuition_intl_annual
      ? `${school.tuition_currency} ${school.tuition_intl_annual.toLocaleString()} / 年`
      : null;
    const livingText = school.avg_living_cost_annual
      ? `${school.tuition_currency} ${school.avg_living_cost_annual.toLocaleString()} / 年`
      : null;
    const acceptText = school.acceptance_rate
      ? `${(school.acceptance_rate * 100).toFixed(1)}%` + (cfg ? `（${cfg.desc}）` : '')
      : null;
    const testPolicy = getTestPolicy(school);
    const testPolicyText = testPolicy === 'blind' ? '不接受标化成绩' : testPolicy === 'optional' ? '可选提交（非必须）' : null;
    const satSuffix = testPolicy !== 'required' ? '（供参考）' : '';
    const satText = school.sat_range ? `${school.sat_range[0]}–${school.sat_range[1]}${satSuffix}` : null;
    const actText = school.act_range ? `${school.act_range[0]}–${school.act_range[1]}${satSuffix}` : null;
    const majorsText = (school.popular_majors || []).join('、') || null;
    const deadlineText = school.application_deadline_fall
      ? school.application_deadline_fall.replace('-', '月') + '日'
      : null;
    const pswText = school.post_study_work ? `${school.post_study_work} 个月` : null;
    const settingMap = { urban: '城市', suburban: '郊区', rural: '小镇' };

    // 奖学金
    let scholarshipText = null;
    if (school.scholarship_intl) {
      scholarshipText = school.scholarship_notes || '有奖学金';
    } else if (school.scholarship_intl === false) {
      scholarshipText = '无国际生奖学金';
    }

    const html = `
<div id="explorer-detail-overlay"
  onclick="ExplorerModule.closeDetail()"
  style="position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:500;
    display:flex; align-items:flex-end; justify-content:center;">
  <div onclick="event.stopPropagation()"
    style="background:#fff; border-radius:20px 20px 0 0; width:100%; max-width:480px;
      max-height:88dvh; overflow-y:auto; padding:0 0 32px;
      animation:sheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1) forwards;">

    <!-- 拖拽指示条 -->
    <div style="display:flex; justify-content:center; padding:12px 0 4px;">
      <div style="width:36px; height:4px; border-radius:2px; background:#E5E7EB;"></div>
    </div>

    <!-- 关闭按钮 -->
    <button onclick="ExplorerModule.closeDetail()"
      style="position:absolute; right:16px; top:16px; width:32px; height:32px;
        border-radius:50%; border:none; background:#F3F4F6; cursor:pointer;
        display:flex; align-items:center; justify-content:center; font-size:16px;">✕</button>

    <div style="padding:4px 20px 0;">
      <!-- 标题区 -->
      <div style="margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
          <span style="font-size:20px;">${country.flag}</span>
          <span style="font-size:13px; color:#6B7280;">${country.name} · ${school.city || ''}</span>
          ${cfg ? `<span style="font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px;
            background:${cfg.bg}; color:${cfg.color};">${d} 档 · ${cfg.desc}</span>` : ''}
        </div>
        <h2 style="font-size:20px; font-weight:700; color:#1A1A2E; margin:0 0 4px;">${school.name_zh || school.name_en}</h2>
        <p style="font-size:13px; color:#6B7280; margin:0;">${school.name_en}</p>
      </div>

      <!-- 核心数据卡片 -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px;">
        ${school.qs_rank_2025 ? `
        <div style="background:#F8F7F4; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:20px; font-weight:700; color:#2B5CE6;">#${school.qs_rank_2025}</div>
          <div style="font-size:11px; color:#6B7280; margin-top:2px;">QS 2025</div>
        </div>` : ''}
        ${school.usnews_rank_2026 ? `
        <div style="background:#F8F7F4; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:20px; font-weight:700; color:#1A1A2E;">#${school.usnews_rank_2026}</div>
          <div style="font-size:11px; color:#6B7280; margin-top:2px;">US News 2026</div>
        </div>` : ''}
        ${wan || engWales ? `
        <div style="background:#FEF3C7; border-radius:10px; padding:12px; text-align:center;">
          ${engWales
            ? `<div style="font-size:13px; font-weight:700; color:#92400E;">BSc ¥${calcTotalCNY(school,3)}万<br><span style="font-size:11px; font-weight:400;">MSci ¥${calcTotalCNY(school,4)}万</span></div>
               <div style="font-size:11px; color:#6B7280; margin-top:2px;">本科总预算估算</div>`
            : `<div style="font-size:18px; font-weight:700; color:#92400E;">¥${wan}万</div>
               <div style="font-size:11px; color:#6B7280; margin-top:2px;">${years}年本科总预算估算</div>`
          }
        </div>` : ''}
        ${acceptText ? `
        <div style="background:#F8F7F4; border-radius:10px; padding:12px; text-align:center;">
          <div style="font-size:18px; font-weight:700; color:#1A1A2E;">${(school.acceptance_rate * 100).toFixed(1)}%</div>
          <div style="font-size:11px; color:#6B7280; margin-top:2px;">录取率</div>
        </div>` : ''}
      </div>

      <!-- 详情列表 -->
      <div style="margin-bottom:20px;">
        <div style="font-size:12px; font-weight:600; color:#9CA3AF; letter-spacing:0.05em;
          margin-bottom:6px; text-transform:uppercase;">费用</div>
        ${detailRow('学费（国际生）', tuitionText)}
        ${detailRow('生活费估算', livingText)}
        ${detailRow(engWales ? 'BSc/MSci 本科总预算' : `${years}年本科总预算`, budgetText)}
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:12px; font-weight:600; color:#9CA3AF; letter-spacing:0.05em;
          margin-bottom:6px; text-transform:uppercase;">申请要求</div>
        ${detailRow('录取率', acceptText)}
        ${testPolicyText ? detailRow('标化政策', testPolicyText) : ''}
        ${detailRow('SAT 区间', satText)}
        ${detailRow('ACT 区间', actText)}
        ${detailRow('IELTS 最低', school.ielts_min ? `${school.ielts_min} 分` : null)}
        ${detailRow('TOEFL 最低', school.toefl_min ? `${school.toefl_min} 分` : null)}
        ${detailRow('平均 GPA', school.gpa_avg ? `${school.gpa_avg} / 4.0` : null)}
        ${detailRow('截止日期', deadlineText)}
        ${detailRow('申请系统', school.application_system)}
      </div>

      <div style="margin-bottom:20px;">
        <div style="font-size:12px; font-weight:600; color:#9CA3AF; letter-spacing:0.05em;
          margin-bottom:6px; text-transform:uppercase;">专业 & 就业</div>
        ${majorsText ? `<div style="font-size:13px; color:#1A1A2E; line-height:1.7; padding:10px 0; border-bottom:1px solid #F3F4F6;">${majorsText}</div>` : ''}
        ${detailRow('Co-op 实习', school.coop_available ? '✓ 支持' : null)}
        ${detailRow('毕业后工签', pswText)}
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:12px; font-weight:600; color:#9CA3AF; letter-spacing:0.05em;
          margin-bottom:6px; text-transform:uppercase;">其他信息</div>
        ${detailRow('学校性质', schoolTypeText)}
        ${detailRow('校园环境', settingMap[school.campus_setting] || null)}
        ${detailRow('中国学生社区', school.chinese_student_community === 'large' ? '多' : school.chinese_student_community === 'medium' ? '中等' : school.chinese_student_community === 'small' ? '少' : null)}
        ${detailRow('奖学金', scholarshipText)}
        ${school.special_notes ? `<div style="margin-top:8px; font-size:12px; color:#6B7280; background:#F8F7F4; border-radius:8px; padding:10px;">${school.special_notes}</div>` : ''}
      </div>

      <!-- 底部按钮 -->
      <button id="detail-compare-btn"
        onclick="ExplorerModule.toggleCompare('${school.id}'); ExplorerModule._refreshDetailBtn('${school.id}')"
        style="width:100%; padding:14px; border-radius:12px; font-size:15px; font-weight:600;
          cursor:pointer; border:none; transition:background 0.15s;
          ${inCompare
            ? 'background:#EEF3FD; color:#2B5CE6;'
            : 'background:#2B5CE6; color:#fff;'}">
        ${inCompare ? '✓ 已加入财务对比' : '加入财务对比'}
      </button>
    </div>
  </div>
</div>`;

    // 注入到 body，确保覆盖底部导航
    const old = document.getElementById('explorer-detail-overlay');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    // 锁定背景滚动
    document.body.style.overflow = 'hidden';
  }

  /** 打开详情面板 */
  function openDetail(schoolId) {
    const school = _schools.find(s => s.id === schoolId);
    if (!school) return;
    renderDetailSheet(school);
  }

  /** 关闭详情面板 */
  function closeDetail() {
    const el = document.getElementById('explorer-detail-overlay');
    if (!el) return;
    el.style.animation = 'sheetSlideDown 0.22s ease forwards';
    setTimeout(() => {
      el.remove();
      document.body.style.overflow = '';
    }, 200);
  }

  /** 详情面板内的对比按钮状态刷新（不重渲染整页） */
  function _refreshDetailBtn(schoolId) {
    const btn = document.getElementById('detail-compare-btn');
    if (!btn) return;
    const list = Utils.storage.get(COMPARE_KEY) || [];
    const inCompare = list.includes(schoolId);
    btn.style.background = inCompare ? '#EEF3FD' : '#2B5CE6';
    btn.style.color = inCompare ? '#2B5CE6' : '#fff';
    btn.textContent = inCompare ? '✓ 已加入财务对比' : '加入财务对比';
  }

  /** 渲染筛选面板 */
  function chip(label, active, onclick, activeStyle) {
    const s = active ? (activeStyle || 'background:#2B5CE6;color:#fff;border-color:#2B5CE6;') : '';
    return `<button class="filter-chip" onclick="${onclick}" style="${s}">${label}</button>`;
  }

  function renderFilters() {
    const budgetMax = _filters.budgetMax;
    const budgetLabel = budgetMax >= 300 ? '不限' : `¥${budgetMax}万`;

    const countryBtns = Object.entries(COUNTRY_LABELS).map(([code, info]) =>
      chip(`${info.flag} ${info.name}`, _filters.countries.includes(code),
        `ExplorerModule.toggleFilter('countries','${code}')`)
    ).join('');

    const diffBtns = Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) =>
      chip(`${key} 档`, _filters.difficulties.includes(key),
        `ExplorerModule.toggleFilter('difficulties','${key}')`,
        `background:${cfg.color};color:#fff;border-color:${cfg.color};`)
    ).join('');

    const majorOptions = `<option value="">全部专业</option>` +
      Object.entries(MAJOR_GROUP_LABELS).map(([key, label]) =>
        `<option value="${key}" ${_filters.major === key ? 'selected' : ''}>${label}</option>`
      ).join('');

    const settingBtns = Object.entries(SETTING_LABELS).map(([key, label]) =>
      chip(label, _filters.settings.includes(key), `ExplorerModule.toggleFilter('settings','${key}')`)
    ).join('');

    const typeBtns = [['public','公立'],['private','私立'],['lac','文理学院 LAC']].map(([key, label]) =>
      chip(label, _filters.types.includes(key), `ExplorerModule.toggleFilter('types','${key}')`)
    ).join('');

    const ieltsBtns = [
      [6.5, 'IELTS ≤6.5'],
      [7,   'IELTS ≤7.0'],
    ].map(([val, label]) =>
      chip(label, _filters.ieltsMax === val, `ExplorerModule.setIeltsMax(${val})`)
    ).join('');

    const scholarshipBtn = chip(
      '✦ 有国际生奖学金', _filters.scholarshipOnly,
      'ExplorerModule.toggleScholarship()',
      'background:#059669;color:#fff;border-color:#059669;'
    );

    const pswBtns = [
      [24, '工签 2年+'],
      [36, '工签 3年+'],
    ].map(([val, label]) =>
      chip(label, _filters.pswMin === val, `ExplorerModule.setPswMin(${val})`)
    ).join('');

    const communityBtns = [
      ['large','中国学生多'],
      ['medium','中国学生中'],
      ['small','中国学生少'],
    ].map(([key, label]) =>
      chip(label, _filters.chineseCommunity.includes(key),
        `ExplorerModule.toggleFilter('chineseCommunity','${key}')`)
    ).join('');

    return `
<div id="explorer-filter-panel" style="background:#fff; border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid #E5E7EB;">

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">目标国家</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${countryBtns}</div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">录取难度</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${diffBtns}</div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">专业方向</div>
    <select onchange="ExplorerModule.setMajor(this.value)"
      style="width:100%; padding:9px 12px; border:1.5px solid #E5E7EB; border-radius:8px;
        font-size:14px; background:#fff; color:#1A1A2E; -webkit-appearance:none;">
      ${majorOptions}
    </select>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:4px;">
      本科总预算上限 <strong id="explorer-budget-label" style="color:#1A1A2E; font-size:13px;">${budgetLabel}</strong>
    </div>
    <input type="range" min="50" max="300" step="10" value="${budgetMax}"
      oninput="ExplorerModule.setBudget(this.value)" style="width:100%; margin-top:6px;">
    <div style="display:flex; justify-content:space-between; font-size:11px; color:#9CA3AF; margin-top:2px;">
      <span>¥50万</span><span>¥150万</span><span>不限</span>
    </div>
  </div>

  <div style="height:1px; background:#F3F4F6; margin-bottom:14px;"></div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">学校性质</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${typeBtns}</div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">语言要求</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${ieltsBtns}</div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">申请条件</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">
      ${scholarshipBtn}
      ${chip('标化可选/免除', _filters.testOptional, 'ExplorerModule.toggleTestOptional()', 'background:#0369A1;color:#fff;border-color:#0369A1;')}
    </div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">毕业后工签</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${pswBtns}</div>
  </div>

  <div style="margin-bottom:14px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">城市规模</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${settingBtns}</div>
  </div>

  <div style="margin-bottom:6px;">
    <div style="font-size:12px; color:#9CA3AF; font-weight:600; letter-spacing:.04em; margin-bottom:8px;">中国学生社区</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${communityBtns}</div>
  </div>

  <button onclick="ExplorerModule.resetFilters()"
    style="margin-top:16px; font-size:12px; color:#6B7280; background:none; border:none; cursor:pointer; padding:0;">
    重置全部筛选
  </button>
</div>`;
  }

  /** 渲染整个 explorer tab 内容 */
  function render() {
    const container = document.getElementById('explorer-content');
    if (!container) return;

    if (!_initialized) {
      container.innerHTML = `<div style="text-align:center; padding:60px 0; color:#9CA3AF;">加载中...</div>`;
      return;
    }

    const filtered = applyFilters(_schools);
    const filterExpanded = container.dataset.filterOpen === '1';
    const compareCount = (Utils.storage.get(COMPARE_KEY) || []).length;

    container.innerHTML = `
<div style="padding:0 16px 80px;">

  <!-- 搜索框 -->
  <div style="position:relative; margin-bottom:10px;">
    <input id="explorer-search" type="text" placeholder="搜索学校名称或城市..."
      value="${_filters.search.replace(/"/g, '&quot;')}"
      oninput="ExplorerModule.setSearch(this.value)"
      style="width:100%; padding:10px ${_filters.search ? '36px' : '14px'} 10px 38px; border:1.5px solid #E5E7EB;
        border-radius:10px; font-size:14px; background:#fff; color:#1A1A2E;
        -webkit-appearance:none; outline:none;">
    <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none;"
      width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" stroke-width="1.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <button id="explorer-search-clear" onclick="ExplorerModule.clearSearch()"
      style="position:absolute; right:10px; top:50%; transform:translateY(-50%);
        width:20px; height:20px; border-radius:50%; border:none; background:#D1D5DB;
        cursor:pointer; align-items:center; justify-content:center;
        font-size:12px; color:#6B7280; line-height:1; padding:0;
        display:${_filters.search ? 'flex' : 'none'};">✕</button>
  </div>

  <!-- 筛选按钮 -->
  <div style="display:flex; gap:8px; margin-bottom:10px; align-items:center;">
    <button onclick="ExplorerModule.toggleFilterPanel()"
      style="display:flex; align-items:center; gap:4px; padding:8px 14px;
        border:1.5px solid ${filterExpanded ? '#2B5CE6' : '#E5E7EB'};
        border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;
        background:${filterExpanded ? '#EEF3FD' : '#fff'};
        color:${filterExpanded ? '#2B5CE6' : '#1A1A2E'};">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <line x1="1" y1="3" x2="13" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="5" y1="11" x2="9" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      筛选${getActiveFilterCount() > 0 ? ` (${getActiveFilterCount()})` : ''}
    </button>
    <span style="font-size:13px; color:#6B7280;">共 <strong id="explorer-result-count" style="color:#1A1A2E;">${filtered.length}</strong> 所院校</span>
    ${compareCount > 0 ? `
    <button onclick="switchTab('finance')"
      style="margin-left:auto; font-size:12px; padding:8px 12px; border-radius:8px;
        background:#2B5CE6; color:#fff; border:none; cursor:pointer;">
      查看对比 (${compareCount})
    </button>` : ''}
  </div>

  <!-- 筛选面板 -->
  ${filterExpanded ? renderFilters() : ''}

  <!-- 学校卡片列表 -->
  <div id="explorer-card-list">
    ${filtered.length === 0
      ? `<div style="text-align:center; padding:60px 0; color:#9CA3AF;">没有符合条件的院校，试试调整筛选条件</div>`
      : filtered.map(renderCard).join('')
    }
  </div>
</div>`;
  }

  /** 只刷新卡片列表和结果数，不重建搜索框（保持键盘焦点） */
  function renderCardListOnly() {
    const filtered = applyFilters(_schools);
    const list = document.getElementById('explorer-card-list');
    if (list) {
      list.innerHTML = filtered.length === 0
        ? `<div style="text-align:center; padding:60px 0; color:#9CA3AF;">没有符合条件的院校，试试调整筛选条件</div>`
        : filtered.map(renderCard).join('');
    }
    // 同步更新结果数
    const countEl = document.getElementById('explorer-result-count');
    if (countEl) countEl.textContent = filtered.length;
  }

  /** 计算当前激活的筛选条件数量 */
  function getActiveFilterCount() {
    let n = 0;
    if (_filters.countries.length) n++;
    if (_filters.difficulties.length) n++;
    if (_filters.major) n++;
    if (_filters.budgetMax < 300) n++;
    if (_filters.settings.length) n++;
    if (_filters.types.length) n++;
    if (_filters.ieltsMax > 0) n++;
    if (_filters.scholarshipOnly) n++;
    if (_filters.testOptional) n++;
    if (_filters.pswMin > 0) n++;
    if (_filters.chineseCommunity.length) n++;
    return n;
  }

  // ─── 公开 API ─────────────────────────────────────────────────────────────

  async function init() {
    if (_initialized) {
      render();
      return;
    }

    render(); // 先渲染 loading 状态

    try {
      [_schools, _rates] = await Promise.all([
        Utils.data.loadSchools(),
        Utils.rates.fetch(),
      ]);
      _initialized = true;
    } catch (e) {
      console.error('[ExplorerModule] 初始化失败:', e);
    }

    render();
  }

  function toggleFilterPanel() {
    const container = document.getElementById('explorer-content');
    if (!container) return;
    container.dataset.filterOpen = container.dataset.filterOpen === '1' ? '0' : '1';
    render();
  }

  function toggleFilter(type, value) {
    const arr = _filters[type];
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);
    render();
  }

  function setMajor(value) {
    _filters.major = value;
    render();
  }

  function setBudget(value) {
    _filters.budgetMax = parseInt(value, 10);
    const label = document.getElementById('explorer-budget-label');
    if (label) label.textContent = _filters.budgetMax >= 300 ? '不限' : `¥${_filters.budgetMax}万`;
    renderCardListOnly();
  }

  function setSearch(value) {
    _filters.search = value;
    // 同步清空按钮显示（局部更新，不重建搜索框）
    const clearBtn = document.getElementById('explorer-search-clear');
    const input = document.getElementById('explorer-search');
    if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';
    if (input) input.style.paddingRight = value ? '36px' : '14px';
    renderCardListOnly();
  }

  function clearSearch() {
    _filters.search = '';
    const input = document.getElementById('explorer-search');
    if (input) { input.value = ''; input.focus(); }
    renderCardListOnly();
    // 隐藏清空按钮
    const clearBtn = document.getElementById('explorer-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    if (input) input.style.paddingRight = '14px';
  }

  function resetFilters() {
    _filters.search = '';
    _filters.countries.length = 0;
    _filters.difficulties.length = 0;
    _filters.major = '';
    _filters.budgetMax = 300;
    _filters.settings.length = 0;
    _filters.types.length = 0;
    _filters.ieltsMax = 0;
    _filters.scholarshipOnly = false;
    _filters.testOptional = false;
    _filters.pswMin = 0;
    _filters.chineseCommunity.length = 0;
    const searchInput = document.getElementById('explorer-search');
    if (searchInput) searchInput.value = '';
    render();
  }

  function setIeltsMax(val) {
    _filters.ieltsMax = _filters.ieltsMax === val ? 0 : val;
    render();
  }

  function toggleScholarship() {
    _filters.scholarshipOnly = !_filters.scholarshipOnly;
    render();
  }

  function toggleTestOptional() {
    _filters.testOptional = !_filters.testOptional;
    render();
  }

  function setPswMin(val) {
    _filters.pswMin = _filters.pswMin === val ? 0 : val;
    render();
  }

  /** 切换加入/移出财务对比列表 */
  function toggleCompare(schoolId) {
    let list = Utils.storage.get(COMPARE_KEY) || [];
    const idx = list.indexOf(schoolId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= MAX_COMPARE) {
        showToastGlobal(`最多对比 ${MAX_COMPARE} 所学校，请先移除一所`);
        return;
      }
      list.push(schoolId);
    }
    Utils.storage.set(COMPARE_KEY, list);
    render();
  }

  /** 获取当前待对比学校 ID 列表 */
  function getCompareList() {
    return Utils.storage.get(COMPARE_KEY) || [];
  }

  return { init, toggleFilterPanel, toggleFilter, setMajor, setBudget, setSearch, clearSearch, resetFilters, setIeltsMax, toggleScholarship, toggleTestOptional, setPswMin, toggleCompare, getCompareList, openDetail, closeDetail, _refreshDetailBtn };

})();

window.ExplorerModule = ExplorerModule;
