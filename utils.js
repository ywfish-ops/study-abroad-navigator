/**
 * utils.js — 全局共享工具函数
 *
 * 提供：
 *  - Utils.storage  — 版本化 localStorage 读写（统一键名）
 *  - Utils.rates    — 汇率获取与缓存（ExchangeRate-API，6h TTL）
 *  - Utils.format   — 金额 / 数字 / 百分比格式化
 *  - Utils.data     — 院校 & 生活费 JSON 懒加载与查询
 *
 * 加载顺序：本文件须在所有模块 JS 之前加载。
 */

const Utils = (() => {

  // ─── 1. Storage ────────────────────────────────────────────────────────────

  /**
   * 统一 localStorage 键名（带版本号）。
   * 所有模块共用此表，不要在各模块内自定义键名。
   */
  const KEYS = {
    PROFILE:         'gs_profile_v1',        // 用户完整档案（跨模块）
    QUIZ_PROGRESS:   'gs_quiz_progress_v1',  // 1A 答题断点
    FINANCE_SANDBOX: 'gs_finance_v1',        // 1C 财务沙盘状态
    RECOMMENDER:     'gs_recommender_v1',    // 1B 联申定位器结果
    RATES_CACHE:     'gs_rates_cache_v1',    // 汇率缓存
    SOCIAL_COUNT:    'gs_social_count_v1',   // 分享计数（展示用）
  };

  const storage = {
    KEYS,

    /** 读取并 JSON 解析，失败返回 null */
    get(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    /** JSON 序列化后写入 */
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('[Utils.storage] 写入失败:', key, e);
        return false;
      }
    },

    /** 删除指定键 */
    remove(key) {
      localStorage.removeItem(key);
    },

    /**
     * 读取带过期时间的条目。
     * 写入时需包含 { data: any, expiresAt: ISO string }。
     * @returns {any|null} 未过期则返回 data，否则删除并返回 null
     */
    getWithExpiry(key) {
      const entry = this.get(key);
      if (!entry) return null;
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        this.remove(key);
        return null;
      }
      return entry.data;
    },

    /** 写入带过期时间的条目，ttlMs 为毫秒 */
    setWithExpiry(key, data, ttlMs) {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      this.set(key, { data, expiresAt });
    },
  };

  // ─── 2. 汇率 ───────────────────────────────────────────────────────────────

  /** 支持的货币列表（与 schools.json / living-costs.json 保持一致） */
  const SUPPORTED_CURRENCIES = ['USD', 'GBP', 'AUD', 'CAD', 'SGD', 'HKD', 'CNY'];

  /** 汇率缓存有效期：6 小时 */
  const RATES_TTL_MS = 6 * 60 * 60 * 1000;

  /**
   * 离线 fallback 汇率（1 USD = X 目标货币）。
   * 仅在 API 不可用时使用，定期手动更新。
   */
  const FALLBACK_RATES = {
    USD: 1.0,
    GBP: 0.787,
    AUD: 1.538,
    CAD: 1.351,
    SGD: 1.333,
    HKD: 7.812,
    CNY: 7.25,
  };

  const rates = {
    /**
     * 获取汇率对象（以 USD 为基准）。
     * 优先从缓存读取；缓存过期或不存在则从 API 拉取；
     * API 失败时使用 fallback。
     *
     * @returns {Promise<Object>} { USD:1, GBP:0.79, AUD:1.54, ... }
     */
    async fetch() {
      // 先读缓存
      const cached = storage.getWithExpiry(KEYS.RATES_CACHE);
      if (cached) return cached;

      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.result !== 'success') throw new Error('API 返回非成功状态');

        // 只保留需要的货币
        const filtered = {};
        for (const cur of SUPPORTED_CURRENCIES) {
          filtered[cur] = json.rates[cur] ?? FALLBACK_RATES[cur];
        }

        storage.setWithExpiry(KEYS.RATES_CACHE, filtered, RATES_TTL_MS);
        return filtered;
      } catch (e) {
        console.warn('[Utils.rates] 汇率 API 失败，使用 fallback:', e.message);
        return { ...FALLBACK_RATES };
      }
    },

    /**
     * 同步读取缓存汇率（不触发网络请求）。
     * 适用于只读展示、不需要最新数据的场合。
     *
     * @returns {Object} 汇率对象（缓存 or fallback）
     */
    getCached() {
      return storage.getWithExpiry(KEYS.RATES_CACHE) ?? { ...FALLBACK_RATES };
    },

    /**
     * 将金额从一种货币换算为另一种货币。
     *
     * @param {number} amount   原始金额
     * @param {string} from     原始货币代码（如 'GBP'）
     * @param {string} to       目标货币代码（如 'USD'）
     * @param {Object} ratesObj 汇率对象（以 USD 为基准）
     * @returns {number} 换算后金额，保留 2 位小数
     */
    convert(amount, from, to, ratesObj) {
      if (from === to) return amount;
      const r = ratesObj ?? { ...FALLBACK_RATES };
      // 先换成 USD，再换成目标货币
      const inUSD = amount / (r[from] ?? 1);
      const result = inUSD * (r[to] ?? 1);
      return Math.round(result * 100) / 100;
    },

    /**
     * 快捷：将任意货币金额换算为 USD（使用缓存汇率）。
     *
     * @param {number} amount
     * @param {string} currency
     * @returns {number}
     */
    toUSD(amount, currency) {
      if (currency === 'USD') return amount;
      const r = this.getCached();
      return this.convert(amount, currency, 'USD', r);
    },
  };

  // ─── 3. 格式化 ──────────────────────────────────────────────────────────────

  /**
   * 各货币的显示配置（符号、小数位、前缀/后缀偏好）。
   */
  const CURRENCY_CONFIG = {
    USD: { locale: 'en-US', symbol: '$',   decimals: 0 },
    GBP: { locale: 'en-GB', symbol: '£',   decimals: 0 },
    AUD: { locale: 'en-AU', symbol: 'A$',  decimals: 0 },
    CAD: { locale: 'en-CA', symbol: 'C$',  decimals: 0 },
    SGD: { locale: 'en-SG', symbol: 'S$',  decimals: 0 },
    HKD: { locale: 'zh-HK', symbol: 'HK$', decimals: 0 },
  };

  const format = {
    /**
     * 格式化货币金额（用于 UI 展示）。
     *
     * @param {number} amount       金额
     * @param {string} currency     货币代码，默认 'USD'
     * @param {Object} [opts]
     * @param {boolean} [opts.compact]   true 则压缩大数（如 $55k）
     * @param {boolean} [opts.showCode]  true 则在符号后附上货币代码
     * @returns {string}
     */
    currency(amount, currency = 'USD', opts = {}) {
      const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.USD;
      if (opts.compact && Math.abs(amount) >= 1000) {
        const k = amount / 1000;
        const str = Number.isInteger(k) ? k.toString() : k.toFixed(1);
        return `${cfg.symbol}${str}k${opts.showCode ? ` ${currency}` : ''}`;
      }
      const formatted = new Intl.NumberFormat(cfg.locale, {
        minimumFractionDigits: cfg.decimals,
        maximumFractionDigits: cfg.decimals,
      }).format(Math.round(amount));
      return `${cfg.symbol}${formatted}${opts.showCode ? ` ${currency}` : ''}`;
    },

    /**
     * 格式化为 USD 金额字符串（最常用快捷方式）。
     *
     * @param {number} amount
     * @param {boolean} [compact=false]
     * @returns {string}  如 "$55,000" 或 "$55k"
     */
    usd(amount, compact = false) {
      return this.currency(amount, 'USD', { compact });
    },

    /**
     * 格式化百分比。
     *
     * @param {number} rate  小数形式，如 0.04 → "4%"
     * @param {number} [decimals=0]
     * @returns {string}
     */
    percent(rate, decimals = 0) {
      return `${(rate * 100).toFixed(decimals)}%`;
    },

    /**
     * 保留 2 位小数（金额计算专用，避免浮点误差）。
     *
     * @param {number} x
     * @returns {number}
     */
    money2(x) {
      return Math.round(x * 100) / 100;
    },

    /**
     * 格式化普通数字（加千分位）。
     *
     * @param {number} n
     * @param {number} [decimals=0]
     * @returns {string}
     */
    number(n, decimals = 0) {
      return new Intl.NumberFormat('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(n);
    },

    /**
     * 将年均成本格式化为"X万/年"（中文场景）。
     *
     * @param {number} usdAmount  USD 年金额
     * @param {number} [cnyRate]  人民币汇率（1 USD = ? CNY），若不传则只显示 USD
     * @returns {string}  如 "$55,000/年" 或 "$55,000 ≈ ¥40万/年"
     */
    annualCost(usdAmount, cnyRate) {
      const usdStr = this.usd(usdAmount);
      if (!cnyRate) return `${usdStr}/年`;
      const cny = usdAmount * cnyRate;
      const wan = (cny / 10000).toFixed(1);
      return `${usdStr} ≈ ¥${wan}万/年`;
    },
  };

  // ─── 4. 数据查询 ────────────────────────────────────────────────────────────

  /** 内存缓存（模块生命周期内有效） */
  const _cache = {
    schools: null,
    livingCosts: null,
  };

  const data = {
    /**
     * 懒加载 schools.json，返回 schools 数组。
     * @returns {Promise<Array>}
     */
    async loadSchools() {
      if (_cache.schools) return _cache.schools;
      const res = await fetch('schools.json');
      const json = await res.json();
      _cache.schools = json.schools;
      return _cache.schools;
    },

    /**
     * 懒加载 living-costs.json，返回 city_groups 数组。
     * @returns {Promise<Array>}
     */
    async loadLivingCosts() {
      if (_cache.livingCosts) return _cache.livingCosts;
      const res = await fetch('living-costs.json');
      const json = await res.json();
      _cache.livingCosts = json.city_groups;
      return _cache.livingCosts;
    },

    /**
     * 按 school_id 查找学校对象。
     *
     * @param {string} schoolId
     * @returns {Promise<Object|null>}
     */
    async findSchool(schoolId) {
      const schools = await this.loadSchools();
      return schools.find(s => s.id === schoolId) ?? null;
    },

    /**
     * 按 school_id 找到对应城市群。
     *
     * @param {string} schoolId
     * @returns {Promise<Object|null>}
     */
    async findCityGroup(schoolId) {
      const groups = await this.loadLivingCosts();
      return groups.find(g => g.related_schools.includes(schoolId)) ?? null;
    },

    /**
     * 获取某学校在指定消费档位下的月均生活费（USD）。
     *
     * @param {string} schoolId
     * @param {'low'|'mid'|'high'} tier  消费档位
     * @returns {Promise<number|null>}   月均 USD，找不到返回 null
     */
    async getMonthlyLivingCost(schoolId, tier = 'mid') {
      // 优先取 schools.json 中学校自带的 finance_sandbox 数据
      const school = await this.findSchool(schoolId);
      const fsSandbox = school?.finance_sandbox?.living_cost_usd_monthly;
      if (fsSandbox?.[tier] != null) return fsSandbox[tier];

      // fallback：从 living-costs.json 城市群取
      const group = await this.findCityGroup(schoolId);
      return group?.monthly_usd?.[tier]?.total ?? null;
    },

    /**
     * 计算 4 年总留学成本（USD）。
     * 公式：（学费 + 生活费 + 医保 + 其他费用）× 学制 − 奖学金
     *
     * @param {Object} params
     * @param {number}  params.tuitionUsdAnnual     年学费（USD）
     * @param {number}  params.livingCostUsdMonthly 月均生活费（USD）
     * @param {number}  params.durationYears        学制（年）
     * @param {number}  [params.scholarshipUsdAnnual=0]  年奖学金（USD）
     * @param {number}  [params.healthInsuranceUsdAnnual=0] 年医保（USD）
     * @param {number}  [params.feesUsdAnnual=0]    年其他费用（USD）
     * @returns {{ total: number, breakdown: Object }}
     */
    calcTotalCost({
      tuitionUsdAnnual,
      livingCostUsdMonthly,
      durationYears,
      scholarshipUsdAnnual = 0,
      healthInsuranceUsdAnnual = 0,
      feesUsdAnnual = 0,
    }) {
      const m2 = format.money2;
      const livingAnnual   = m2(livingCostUsdMonthly * 12);
      const annualTotal    = m2(tuitionUsdAnnual + livingAnnual + healthInsuranceUsdAnnual + feesUsdAnnual);
      const annualNet      = m2(annualTotal - scholarshipUsdAnnual);
      const total          = m2(annualNet * durationYears);

      return {
        total,
        breakdown: {
          tuitionTotal:    m2(tuitionUsdAnnual * durationYears),
          livingTotal:     m2(livingAnnual * durationYears),
          scholarshipTotal:m2(scholarshipUsdAnnual * durationYears),
          insuranceTotal:  m2(healthInsuranceUsdAnnual * durationYears),
          feesTotal:       m2(feesUsdAnnual * durationYears),
          annualNet,
        },
      };
    },
  };

  // ─── 5. 设备 / 环境 ─────────────────────────────────────────────────────────

  const env = {
    /** 是否移动端 */
    isMobile: /Mobi|Android/i.test(navigator.userAgent),

    /** 是否支持 Web Share API（用于原生分享） */
    canNativeShare: typeof navigator.share === 'function',

    /** 获取 URL 参数（用于追踪来源渠道） */
    getParam(name) {
      return new URLSearchParams(location.search).get(name);
    },
  };

  // ─── 对外暴露 ───────────────────────────────────────────────────────────────
  return { storage, rates, format, data, env, KEYS };

})();

window.Utils = Utils;
