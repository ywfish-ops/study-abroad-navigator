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
    budgetMax: 300,   // 万元 CNY，300 = 不限
    settings: [],
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

  /** 计算4年总费用（CNY，万元） */
  function calc4YearCNY(school) {
    const tuition = school.tuition_intl_annual;
    const living = school.avg_living_cost_annual;
    if (!tuition) return null;
    const currency = school.tuition_currency || 'USD';
    const totalLocal = (tuition + (living || 0)) * 4;
    const cnyRate = _rates['CNY'] || 7.25;
    const usdRate = _rates[currency] || 1;
    const totalCNY = (totalLocal / usdRate) * cnyRate;
    return Math.round(totalCNY / 10000); // 万元
  }

  /** 过滤学校列表 */
  function applyFilters(schools) {
    return schools.filter(s => {
      // 关键词搜索
      if (_filters.search) {
        const q = _filters.search.toLowerCase();
        const hit = (s.name_zh || '').includes(_filters.search)
          || (s.name_en || '').toLowerCase().includes(q)
          || (s.city || '').toLowerCase().includes(q);
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

  /** 渲染4年预算 */
  function renderBudget(school) {
    const wan = calc4YearCNY(school);
    if (wan == null) return '<span style="color:#9CA3AF; font-size:12px;">费用待补充</span>';
    return `<span style="font-size:13px; color:#1A1A2E;">4年约 <strong>¥${wan}万</strong></span>`;
  }

  /** 渲染单张学校卡片 */
  function renderCard(school) {
    const compareList = Utils.storage.get(COMPARE_KEY) || [];
    const inCompare = compareList.includes(school.id);
    const qs = school.qs_rank_2025 ? `QS #${school.qs_rank_2025}` : '未入QS榜';

    return `
<div class="explorer-card" id="explorer-card-${school.id}">
  <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px; flex-wrap:wrap;">
    ${renderCountry(school)}
    ${renderDifficultyBadge(school)}
  </div>
  <div style="margin-bottom:2px;">
    <span style="font-size:16px; font-weight:600; color:#1A1A2E;">${school.name_zh || school.name_en}</span>
  </div>
  <div style="font-size:12px; color:#6B7280; margin-bottom:8px;">${school.name_en}</div>
  <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
    <div style="display:flex; gap:12px; align-items:center;">
      <span style="font-size:12px; color:#6B7280;">${qs}</span>
      ${renderBudget(school)}
    </div>
    <button class="explorer-compare-btn ${inCompare ? 'in-compare' : ''}"
      onclick="ExplorerModule.toggleCompare('${school.id}')"
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

  /** 渲染筛选面板 */
  function renderFilters() {
    const activeCountries = _filters.countries;
    const activeDiffs = _filters.difficulties;
    const activeSettings = _filters.settings;

    const countryBtns = Object.entries(COUNTRY_LABELS).map(([code, info]) => {
      const active = activeCountries.includes(code);
      return `<button class="filter-chip ${active ? 'active' : ''}"
        onclick="ExplorerModule.toggleFilter('countries','${code}')"
        style="${active ? 'background:#2B5CE6;color:#fff;border-color:#2B5CE6;' : ''}">
        ${info.flag} ${info.name}</button>`;
    }).join('');

    const diffBtns = Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => {
      const active = activeDiffs.includes(key);
      return `<button class="filter-chip ${active ? 'active' : ''}"
        onclick="ExplorerModule.toggleFilter('difficulties','${key}')"
        style="${active ? `background:${cfg.color};color:#fff;border-color:${cfg.color};` : ''}">
        ${key} 档</button>`;
    }).join('');

    const settingBtns = Object.entries(SETTING_LABELS).map(([key, label]) => {
      const active = activeSettings.includes(key);
      return `<button class="filter-chip ${active ? 'active' : ''}"
        onclick="ExplorerModule.toggleFilter('settings','${key}')"
        style="${active ? 'background:#2B5CE6;color:#fff;border-color:#2B5CE6;' : ''}">
        ${label}</button>`;
    }).join('');

    const majorOptions = `<option value="">全部专业</option>` +
      Object.entries(MAJOR_GROUP_LABELS).map(([key, label]) =>
        `<option value="${key}" ${_filters.major === key ? 'selected' : ''}>${label}</option>`
      ).join('');

    const budgetMax = _filters.budgetMax;
    const budgetLabel = budgetMax >= 300 ? '不限' : `¥${budgetMax}万`;

    return `
<div id="explorer-filter-panel" style="background:#fff; border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid #E5E7EB;">
  <div style="margin-bottom:12px;">
    <div style="font-size:12px; color:#6B7280; margin-bottom:6px;">国家</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${countryBtns}</div>
  </div>
  <div style="margin-bottom:12px;">
    <div style="font-size:12px; color:#6B7280; margin-bottom:6px;">难度档位</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${diffBtns}</div>
  </div>
  <div style="margin-bottom:12px;">
    <div style="font-size:12px; color:#6B7280; margin-bottom:6px;">专业方向</div>
    <select onchange="ExplorerModule.setMajor(this.value)"
      style="width:100%; padding:8px 10px; border:1.5px solid #E5E7EB; border-radius:8px;
        font-size:14px; background:#fff; color:#1A1A2E; -webkit-appearance:none;">
      ${majorOptions}
    </select>
  </div>
  <div style="margin-bottom:12px;">
    <div style="font-size:12px; color:#6B7280; margin-bottom:6px;">
      4年总预算上限：<strong style="color:#1A1A2E;">${budgetLabel}</strong>
    </div>
    <input type="range" min="50" max="300" step="10" value="${budgetMax}"
      oninput="ExplorerModule.setBudget(this.value)"
      style="width:100%;">
    <div style="display:flex; justify-content:space-between; font-size:11px; color:#9CA3AF; margin-top:2px;">
      <span>¥50万</span><span>¥150万</span><span>不限</span>
    </div>
  </div>
  <div>
    <div style="font-size:12px; color:#6B7280; margin-bottom:6px;">城市规模</div>
    <div style="display:flex; flex-wrap:wrap; gap:6px;">${settingBtns}</div>
  </div>
  <button onclick="ExplorerModule.resetFilters()"
    style="margin-top:14px; font-size:12px; color:#6B7280; background:none; border:none; cursor:pointer; padding:0;">
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
      style="width:100%; padding:10px 14px 10px 38px; border:1.5px solid #E5E7EB;
        border-radius:10px; font-size:14px; background:#fff; color:#1A1A2E;
        -webkit-appearance:none; outline:none;">
    <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none;"
      width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" stroke-width="1.5"/>
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
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
    <span style="font-size:13px; color:#6B7280;">共 <strong style="color:#1A1A2E;">${filtered.length}</strong> 所院校</span>
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

  /** 计算当前激活的筛选条件数量 */
  function getActiveFilterCount() {
    let n = 0;
    if (_filters.countries.length) n++;
    if (_filters.difficulties.length) n++;
    if (_filters.major) n++;
    if (_filters.budgetMax < 300) n++;
    if (_filters.settings.length) n++;
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
    render();
  }

  function setSearch(value) {
    _filters.search = value;
    render();
  }

  function resetFilters() {
    _filters.search = '';
    _filters.countries.length = 0;
    _filters.difficulties.length = 0;
    _filters.major = '';
    _filters.budgetMax = 300;
    _filters.settings.length = 0;
    const searchInput = document.getElementById('explorer-search');
    if (searchInput) searchInput.value = '';
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

  return { init, toggleFilterPanel, toggleFilter, setMajor, setBudget, setSearch, resetFilters, toggleCompare, getCompareList };

})();

window.ExplorerModule = ExplorerModule;
