/**
 * finance.js — 模块1C 财务沙盘
 *
 * 允许用户选 1-3 所学校，调节生活档位，
 * 估算四年留学总成本（USD + 人民币换算）并生成对比图。
 *
 * 依赖：utils.js（须先加载）、Chart.js
 */

const FinanceModule = (() => {
  'use strict';

  // ─── 状态 ──────────────────────────────────────────────────────────────────

  const state = {
    selectedSchools: [],   // 最多 3 个 school 对象
    tier: 'mid',           // 'low' | 'mid' | 'high'
    countryFilter: 'ALL',
    query: '',
    allSchools: [],
    rates: null,           // 汇率对象（fetch 后赋值）
    chart: null,           // Chart.js 实例
    inited: false,
  };

  // ─── 常量 ──────────────────────────────────────────────────────────────────

  const COUNTRY_FILTERS = [
    { code: 'ALL', label: '全部',    flag: ''   },
    { code: 'US',  label: '美国',    flag: '🇺🇸' },
    { code: 'GB',  label: '英国',    flag: '🇬🇧' },
    { code: 'AU',  label: '澳洲',    flag: '🇦🇺' },
    { code: 'CA',  label: '加拿大',  flag: '🇨🇦' },
    { code: 'SG',  label: '新加坡',  flag: '🇸🇬' },
    { code: 'HK',  label: '香港',    flag: '🇭🇰' },
  ];

  const TIER_LABELS  = { low: '节俭', mid: '舒适', high: '宽裕' };
  const TIER_DESC    = { low: '自炊为主，多人合租', mid: '餐厅与自炊混合，单间', high: '独立公寓，外食为主' };

  /** 各国默认学制（年），找不到则 4 年 */
  const DEFAULT_DURATION = { GB: 3, AU: 3 };

  /** 各国默认年医保费（USD），没有则 0 */
  const DEFAULT_INSURANCE_USD = { US: 2000 };

  /** 国家 emoji flag 映射 */
  const COUNTRY_FLAGS = { US:'🇺🇸', GB:'🇬🇧', AU:'🇦🇺', CA:'🇨🇦', SG:'🇸🇬', HK:'🇭🇰' };

  // ─── 工具 ──────────────────────────────────────────────────────────────────

  /** 标准化国家代码（处理旧库里的 'Australia' 等全称） */
  function normCountry(school) {
    const MAP = { Australia: 'AU' };
    return MAP[school.country] || school.country || '?';
  }

  function schoolFlag(school) {
    return COUNTRY_FLAGS[normCountry(school)] || '🏫';
  }

  /** 推算学制 */
  function getDuration(school) {
    return school.finance_sandbox?.duration_years
      || DEFAULT_DURATION[normCountry(school)]
      || 4;
  }

  /** 学费 → USD（使用已获取的 rates） */
  function getTuitionUSD(school) {
    if (school.finance_sandbox?.tuition_usd_annual) {
      return school.finance_sandbox.tuition_usd_annual;
    }
    const local = school.tuition_intl_annual;
    const cur   = school.tuition_currency || 'USD';
    if (!local) return null;
    return Utils.rates.convert(local, cur, 'USD', state.rates);
  }

  /**
   * 奖学金需拿到 offer 后才确定，财务沙盘不做假设，固定返回 0。
   * 如需模拟奖学金减免，由用户在 UI 手动输入（TODO Phase 2）。
   */
  function getScholarshipUSD(_school) {
    return 0;
  }

  /** 年医保 USD */
  function getInsuranceUSD(school) {
    if (school.finance_sandbox?.health_insurance_usd_annual != null) {
      return school.finance_sandbox.health_insurance_usd_annual;
    }
    return DEFAULT_INSURANCE_USD[normCountry(school)] || 0;
  }

  /** 其他年费用 USD */
  function getFeesUSD(school) {
    return school.finance_sandbox?.fees_usd_annual || 0;
  }

  // ─── 初始化 ─────────────────────────────────────────────────────────────────

  async function init() {
    if (state.inited) {
      // 已初始化则只刷新列表（可能有新数据）
      renderSchoolList();
      renderSelectedChips();
      return;
    }
    state.inited = true;

    // 恢复上次状态
    const saved = Utils.storage.get(Utils.KEYS.FINANCE_SANDBOX);
    if (saved?.tier) state.tier = saved.tier;

    // 加载学校数据
    state.allSchools = await Utils.data.loadSchools();

    // 恢复已选学校（通过 ID 重新查找）
    if (saved?.selectedIds?.length) {
      state.selectedSchools = saved.selectedIds
        .map(id => state.allSchools.find(s => s.id === id))
        .filter(Boolean);
    }

    renderCountryFilter();
    renderSchoolList();
    renderSelectedChips();
  }

  // ─── 渲染：国家筛选 ──────────────────────────────────────────────────────────

  function renderCountryFilter() {
    const wrap = document.getElementById('finance-country-filter');
    if (!wrap) return;
    wrap.innerHTML = COUNTRY_FILTERS.map(({ code, label, flag }) => `
      <button
        class="country-pill${state.countryFilter === code ? ' active' : ''}"
        onclick="FinanceModule.setCountry('${code}')"
      >${flag ? flag + ' ' : ''}${label}</button>
    `).join('');
  }

  // ─── 渲染：学校列表 ──────────────────────────────────────────────────────────

  function getFilteredSchools() {
    return state.allSchools.filter(s => {
      if (state.countryFilter !== 'ALL' && normCountry(s) !== state.countryFilter) return false;
      if (state.query) {
        const q = state.query.toLowerCase();
        if (
          !(s.name_en || '').toLowerCase().includes(q) &&
          !(s.name_zh || '').includes(state.query)
        ) return false;
      }
      return true;
    });
  }

  function renderSchoolList() {
    const list = document.getElementById('finance-school-list');
    if (!list) return;
    const filtered = getFilteredSchools();
    const selectedIds = new Set(state.selectedSchools.map(s => s.id));
    const maxed = state.selectedSchools.length >= 3;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-hint">未找到匹配学校</div>`;
      return;
    }

    list.innerHTML = filtered.map(s => {
      const sel      = selectedIds.has(s.id);
      const disabled = !sel && maxed;
      const rankStr  = s.qs_rank_2025 ? `QS #${s.qs_rank_2025}` : (s.usnews_global_rank_2025 ? `USNews #${s.usnews_global_rank_2025}` : '');
      const cityStr  = s.city ? s.city.split(',')[0] : '';
      const meta     = [cityStr, rankStr].filter(Boolean).join(' · ');

      return `
        <div
          class="school-item${sel ? ' selected' : ''}${disabled ? ' disabled' : ''}"
          onclick="${disabled ? "FinanceModule._maxedToast()" : `FinanceModule.toggleSchool('${s.id}')`}"
        >
          <div class="school-item-check">${sel ? '✓' : ''}</div>
          <div class="school-item-info">
            <div class="school-item-name">${schoolFlag(s)} ${s.name_zh || s.name_en}</div>
            ${meta ? `<div class="school-item-meta">${meta}</div>` : ''}
          </div>
          ${sel ? `<div class="school-item-remove" onclick="event.stopPropagation();FinanceModule.removeSchool('${s.id}')">×</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // ─── 渲染：已选 Chip ──────────────────────────────────────────────────────────

  function renderSelectedChips() {
    const wrap    = document.getElementById('finance-selected-wrap');
    const chips   = document.getElementById('finance-selected-chips');
    const calcBtn = document.getElementById('finance-calc-btn');
    if (!wrap) return;

    if (state.selectedSchools.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';

    chips.innerHTML = state.selectedSchools.map(s => `
      <span class="school-chip">
        ${schoolFlag(s)} ${s.name_zh || s.name_en}
        <button onclick="FinanceModule.removeSchool('${s.id}')" aria-label="移除">×</button>
      </span>
    `).join('');

    calcBtn.textContent = `开始计算（${state.selectedSchools.length}所）`;
  }

  // ─── 选校操作 ───────────────────────────────────────────────────────────────

  function toggleSchool(schoolId) {
    if (state.selectedSchools.find(s => s.id === schoolId)) {
      removeSchool(schoolId);
    } else {
      if (state.selectedSchools.length >= 3) {
        showToast('最多同时比较 3 所学校');
        return;
      }
      const school = state.allSchools.find(s => s.id === schoolId);
      if (!school) return;
      state.selectedSchools.push(school);
      saveState();
      renderSchoolList();
      renderSelectedChips();
    }
  }

  function removeSchool(schoolId) {
    state.selectedSchools = state.selectedSchools.filter(s => s.id !== schoolId);
    saveState();
    renderSchoolList();
    renderSelectedChips();
  }

  // ─── 计算入口 ───────────────────────────────────────────────────────────────

  async function calculate() {
    if (state.selectedSchools.length === 0) {
      showToast('请先选择学校');
      return;
    }
    showFinanceView('view-finance-result');
    renderTierToggle();

    // loading 占位
    document.getElementById('finance-result-cards').innerHTML = `
      <div style="text-align:center;padding:48px 0;color:var(--text-secondary)">
        <div style="font-size:28px;margin-bottom:12px">⏳</div>
        <div style="font-size:14px">获取实时汇率中…</div>
      </div>`;
    document.getElementById('finance-chart-wrap').style.display = 'none';

    state.rates = await Utils.rates.fetch();
    await renderResults();
  }

  // ─── 结果渲染 ───────────────────────────────────────────────────────────────

  async function renderResults() {
    const cardsEl = document.getElementById('finance-result-cards');
    if (!cardsEl) return;

    const cnyRate = state.rates?.CNY ?? 7.25;
    document.getElementById('finance-rate-hint').textContent =
      `汇率参考：$1 ≈ ¥${cnyRate.toFixed(2)}（实时）`;

    // 计算每所学校费用
    const costList = await Promise.all(
      state.selectedSchools.map(s => calcSchoolCost(s))
    );

    cardsEl.innerHTML = costList.map((cd, i) =>
      cd
        ? renderCostCard(state.selectedSchools[i], cd, cnyRate)
        : renderNoDataCard(state.selectedSchools[i])
    ).join('');

    // 对比图（2+ 所且都有数据时显示）
    const validPairs = state.selectedSchools
      .map((s, i) => costList[i] ? { school: s, cost: costList[i] } : null)
      .filter(Boolean);

    const chartWrap = document.getElementById('finance-chart-wrap');
    if (validPairs.length >= 2) {
      chartWrap.style.display = 'block';
      renderComparisonChart(validPairs);
    } else {
      chartWrap.style.display = 'none';
    }
  }

  async function calcSchoolCost(school) {
    const tuitionUSD = getTuitionUSD(school);
    if (!tuitionUSD) return null;

    const livingMonthly = await Utils.data.getMonthlyLivingCost(school.id, state.tier);
    if (!livingMonthly) return null;

    return Utils.data.calcTotalCost({
      tuitionUsdAnnual:         tuitionUSD,
      livingCostUsdMonthly:     livingMonthly,
      durationYears:            getDuration(school),
      scholarshipUsdAnnual:     getScholarshipUSD(school),
      healthInsuranceUsdAnnual: getInsuranceUSD(school),
      feesUsdAnnual:            getFeesUSD(school),
    });
  }

  // ─── 卡片 HTML ──────────────────────────────────────────────────────────────

  function renderCostCard(school, costs, cnyRate) {
    const { total, breakdown } = costs;
    const duration  = getDuration(school);
    const cnyWan    = Math.round(total * cnyRate / 10000);
    const gross     = breakdown.tuitionTotal + breakdown.livingTotal + breakdown.insuranceTotal + breakdown.feesTotal;
    const pct       = v => gross > 0 ? (v / gross * 100).toFixed(1) : '0';
    const rankStr   = school.qs_rank_2025
      ? `QS #${school.qs_rank_2025}`
      : (school.usnews_global_rank_2025 ? `USNews #${school.usnews_global_rank_2025}` : '');
    const cityStr   = school.city ? school.city.split(',')[0] : '';

    return `
      <div class="cost-card">
        <div class="cost-card-name">${schoolFlag(school)} ${school.name_zh || school.name_en}</div>
        <div class="cost-card-meta">${[cityStr, rankStr, TIER_LABELS[state.tier] + '型生活', duration + '年制'].filter(Boolean).join(' · ')}</div>

        <div class="cost-totals">
          <div class="cost-total-main">
            <div class="cost-label">${duration}年总费用</div>
            <div class="cost-value">${Utils.format.usd(total, true)}</div>
            <div class="cost-cny">≈ 人民币约 ${Utils.format.number(cnyWan)} 万</div>
          </div>
          <div class="cost-total-annual">
            <div class="cost-label">年均净支出</div>
            <div class="cost-value-sm">${Utils.format.usd(breakdown.annualNet, true)}</div>
          </div>
        </div>

        <div class="cost-breakdown-label">费用构成（税前总额）</div>
        <div class="cost-bar">
          <div class="cost-bar-segment bar-tuition"   style="width:${pct(breakdown.tuitionTotal)}%"></div>
          <div class="cost-bar-segment bar-living"    style="width:${pct(breakdown.livingTotal)}%"></div>
          <div class="cost-bar-segment bar-insurance" style="width:${pct(breakdown.insuranceTotal)}%"></div>
        </div>
        <div class="cost-legend">
          <span><i class="dot dot-tuition"></i>学费 ${Utils.format.usd(breakdown.tuitionTotal, true)}</span>
          <span><i class="dot dot-living"></i>生活 ${Utils.format.usd(breakdown.livingTotal, true)}</span>
          ${breakdown.insuranceTotal > 0 ? `<span><i class="dot dot-insurance"></i>医保 ${Utils.format.usd(breakdown.insuranceTotal, true)}</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderNoDataCard(school) {
    return `
      <div class="cost-card cost-card-nodata">
        <div class="cost-card-name">${schoolFlag(school)} ${school.name_zh || school.name_en}</div>
        <div style="color:var(--text-secondary);font-size:13px;margin-top:8px">
          学费数据暂缺，无法计算。如有数据欢迎补充。
        </div>
      </div>
    `;
  }

  // ─── 档位切换 ────────────────────────────────────────────────────────────────

  function renderTierToggle() {
    const el = document.getElementById('finance-tier-toggle');
    if (!el) return;
    el.innerHTML = Object.entries(TIER_LABELS).map(([t, label]) => `
      <button
        class="tier-btn${state.tier === t ? ' active' : ''}"
        onclick="FinanceModule.setTier('${t}')"
        title="${TIER_DESC[t]}"
      >${label}</button>
    `).join('');
  }

  // ─── 对比图 ─────────────────────────────────────────────────────────────────

  function renderComparisonChart(pairs) {
    const canvas = document.getElementById('finance-chart');
    if (!canvas) return;
    if (state.chart) { state.chart.destroy(); state.chart = null; }

    const labels     = pairs.map(p => p.school.name_zh || p.school.name_en);
    const tuitions   = pairs.map(p => p.cost.breakdown.tuitionTotal);
    const livings    = pairs.map(p => p.cost.breakdown.livingTotal);
    const insurances = pairs.map(p => p.cost.breakdown.insuranceTotal);

    state.chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '学费',      data: tuitions,   backgroundColor: '#2B5CE6', stack: 'cost' },
          { label: '生活费',    data: livings,    backgroundColor: '#E87B35', stack: 'cost' },
          { label: '医保/杂费', data: insurances, backgroundColor: '#9CA3AF', stack: 'cost' },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 11 }, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${Utils.format.usd(Math.abs(ctx.raw), true)}`,
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 12 } } },
          y: {
            stacked: true,
            ticks: {
              callback: v => Utils.format.usd(v, true),
              font: { size: 11 },
            },
          },
        },
      },
    });
  }

  // ─── 视图切换 ────────────────────────────────────────────────────────────────

  function showFinanceView(id) {
    document.querySelectorAll('.finance-view').forEach(v => {
      v.style.display = 'none';
    });
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  }

  // ─── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg) {
    const old = document.getElementById('finance-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'finance-toast';
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  // ─── 状态持久化 ─────────────────────────────────────────────────────────────

  function saveState() {
    Utils.storage.set(Utils.KEYS.FINANCE_SANDBOX, {
      selectedIds: state.selectedSchools.map(s => s.id),
      tier: state.tier,
    });
  }

  // ─── 对外 API ────────────────────────────────────────────────────────────────

  return {
    init,
    toggleSchool,
    removeSchool,
    calculate,

    backToSelect() {
      showFinanceView('view-finance-select');
    },

    setCountry(code) {
      state.countryFilter = code;
      renderCountryFilter();
      renderSchoolList();
    },

    search(q) {
      state.query = q;
      renderSchoolList();
    },

    async setTier(tier) {
      state.tier = tier;
      saveState();
      renderTierToggle();
      if (state.rates) await renderResults();
    },

    _maxedToast() {
      showToast('最多同时比较 3 所学校');
    },
  };

})();

window.FinanceModule = FinanceModule;
