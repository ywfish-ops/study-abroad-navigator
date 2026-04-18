# 模块 1B — 联申定位器（Multi-Country Application Recommender）
## Claude Code 实现规格文档 v1.0

> **文档用途**：供 Claude Code 直接执行。本文档覆盖数据接入、匹配算法、UI 组件、状态管理的完整实现规格，不含需求讨论。所有设计决策已锁定。

---

## 0. 产品定位与约束

**模块定位**：Phase 1 核心功能。输入学生学术画像 → 输出多国院校推荐列表（冲/稳/保分层）。这是一个**决策审计工具**，不是咨询服务——结果必须客观可解释，不得隐藏算法逻辑。

**目标用户**：持有 AP / A-Level / IB 成绩的国际高中生，申请 2027 Fall 本科入学。注意：**产品现已面向国际生，不限于高考生**。用户输入的是国际课程体系成绩，匹配逻辑须对应调整。

**技术约束**（Phase 1 MVP）：
- 单文件 HTML + Vanilla JS + Tailwind CDN
- 数据源：`schools.json`（本地 JSON，85 所院校），通过 `fetch('./data/schools.json')` 加载
- 存储：`localStorage`（用户画像持久化），无后端
- 部署：Cloudflare Pages

---

## 1. 数据文件规格

### 1.1 文件位置

```
/data/schools.json   ← 已有，直接使用
```

### 1.2 数据概况（勿硬编码，运行时从文件读取）

| 字段 | 说明 |
|------|------|
| 总院校数 | 85 所（含 1 所 country=null 的脏数据，需过滤） |
| 国家分布 | US 41 / GB 17 / CA 8 / AU 8 / SG 5 / HK 5 |
| 申请体系 | Common App / UCAS / Direct / OUAC / UC Application |
| 学费货币 | USD / GBP / CAD / AUD / HKD / SGD |

### 1.3 关键字段使用说明

| 字段 | 类型 | 用途 |
|------|------|------|
| `acceptance_rate` | float (0–1) | 换算为竞争难度系数 |
| `qs_rank_2025` | int \| null | 排名展示与筛选 |
| `sat_range` | [int, int] \| null | 美国院校 SAT 匹配（US 42 所有数据） |
| `a_level_typical` | string \| null | 英国院校 A-Level 要求（GB 17 所中 10 所有数据） |
| `ielts_min` | float | 语言门槛过滤 |
| `toefl_min` | int | 语言门槛过滤 |
| `tuition_intl_annual` | number | 年学费（本地货币） |
| `tuition_currency` | string | 货币代码，用于换算 USD |
| `avg_living_cost_annual` | number | 年生活费估算（本地货币） |
| `scholarship_intl` | bool | 是否有国际生奖学金 |
| `post_study_work` | int (months) | 毕业后工签时长 |
| `tags` | string[] | 多维标签，用于偏好匹配 |
| `popular_majors` | string[] | 热门专业列表 |
| `gaokao_accepted` | bool \| null | 仅 HK 院校有效 |
| `tuition_subsidised` | bool \| null | 仅 SG 院校有效（MOE 补贴） |
| `special_notes` | string | 重要录取说明，在院校卡片展示 |

### 1.4 数据清洗（运行时处理）

```js
// 加载时过滤脏数据
const schools = rawData.schools.filter(s =>
  s && s.country && s.id && s.name_en
);

// 货币统一换算为 USD（用于预算比较）
const FX = { USD: 1, GBP: 1.27, CAD: 0.73, AUD: 0.65, HKD: 0.128, SGD: 0.74 };
function toUSD(amount, currency) {
  return Math.round(amount * (FX[currency] ?? 1));
}
```

---

## 2. 用户输入规格

### 2.1 输入字段定义

**Step 1 — 学术画像**

| 字段 ID | 标签 | 类型 | 选项 / 范围 | 说明 |
|---------|------|------|------------|------|
| `curriculum` | 就读课程体系 | radio | `ap` / `alevel` / `ib` | 决定成绩映射方式 |
| `score_ap` | AP 科目数量（≥3分） | number | 1–15 | 仅当 curriculum=ap 显示 |
| `score_ap_avg` | AP 平均分 | radio | `3` / `4` / `5` | 仅当 curriculum=ap 显示 |
| `score_alevel` | A-Level 预测成绩 | radio | `A*A*A*` / `A*AA` / `AAA` / `AAB` / `ABB` / `BBB` | 仅当 curriculum=alevel 显示 |
| `score_ib` | IB 预测总分 | number | 24–45 | 仅当 curriculum=ib 显示 |
| `gpa_us` | GPA（4.0制） | number | 2.0–4.0, step 0.1 | 所有体系共用 |
| `english_test` | 英语成绩类型 | radio | `ielts` / `toefl` / `duolingo` / `native` | |
| `english_score` | 英语分数 | number | 随类型变化 | IELTS: 4.0–9.0; TOEFL: 60–120; Duolingo: 85–160 |
| `ec_level` | 课外活动 | radio | `strong`（国际竞赛/科研/创业）/ `good`（省级/校级荣誉）/ `basic`（一般参与） | |

**Step 2 — 申请偏好**

| 字段 ID | 标签 | 类型 | 选项 | 说明 |
|---------|------|------|------|------|
| `target_countries` | 目标国家 | multi-select chips | US / GB / HK / SG / CA / AU | 至少选 1 个 |
| `major_interest` | 意向专业 | select | 见 §2.2 | |
| `budget_usd` | 年预算（USD，学费+生活费） | radio | `<30k` / `30–50k` / `50–80k` / `>80k` | |
| `priority` | 最重视因素 | radio | `ranking` / `scholarship` / `coop` / `post_work` / `life_quality` | |
| `scholarship_only` | 仅显示有奖学金院校 | checkbox | bool | 默认 false |

### 2.2 专业分类映射

```js
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
```

### 2.3 本地持久化

```js
// 保存画像到 localStorage
function saveProfile(profile) {
  localStorage.setItem('1b_profile', JSON.stringify({ ...profile, _ts: Date.now() }));
}

// 启动时恢复（7天有效）
function loadProfile() {
  try {
    const raw = localStorage.getItem('1b_profile');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - p._ts > 7 * 86400 * 1000) return null;
    return p;
  } catch { return null; }
}
```

---

## 3. 匹配算法规格

### 3.1 总体思路

每所院校产出两个值：
1. **`eligible`**（bool）：硬性门槛是否全部通过 → 不通过直接过滤
2. **`matchScore`**（0–100 整数）：软性权重加权分 → 决定排序和梯队

### 3.2 硬性过滤（Eligibility Gates）

以下任意一项为 false 则过滤该院校：

```
① 国家匹配：s.country ∈ profile.target_countries
② 预算匹配：toUSD(tuition + living) ≤ budgetMax（按预算档映射 budgetMax）
③ 语言门槛：score_ielts >= s.ielts_min  OR  score_toefl >= s.toefl_min（native 直接通过）
④ 奖学金过滤：若 scholarship_only=true，则 s.scholarship_intl === true
```

**预算档映射**：

```js
const BUDGET_MAX = { '<30k': 30000, '30–50k': 50000, '50–80k': 80000, '>80k': Infinity };
```

### 3.3 软性匹配评分（matchScore）

总分 100 分，由以下五个维度加权：

#### A. 成绩匹配分（40分）

根据 `curriculum` 选择对应评分路径：

**AP 路径**（US 院校优先适用）：
```
satProxy = ap_subjects * 50 + ap_avg_score * 50   // 代理 SAT 范围
若 s.sat_range 存在：
  若 satProxy >= sat_range[1]：成绩分 = 40（上四分位以上 → 冲刺有信心）
  若 satProxy >= sat_range[0]：成绩分 = 28（中间段 → 稳健区间）
  否则：成绩分 = 12（低于25th → 风险较高）
若 s.sat_range 为 null：
  基于 acceptance_rate 代理（见下方）
```

**A-Level 路径**（GB 院校适用）：
```js
const ALEVEL_RANK = { 'A*A*A*': 7, 'A*A*A': 6, 'A*AA': 5, 'AAA': 4, 'AAB': 3, 'ABB': 2, 'BBB': 1 };
const schoolReq = ALEVEL_RANK[s.a_level_typical] ?? 3;
const userScore = ALEVEL_RANK[profile.score_alevel] ?? 2;
const gap = userScore - schoolReq;
// gap >= 1 → 40分; gap === 0 → 28分; gap === -1 → 16分; gap <= -2 → 6分
```

**IB 路径**（SG / CA / AU 院校优先适用）：
```
IB ≥ 38：top tier → acceptance_rate ≤ 0.15 按冲; 0.15–0.30 按稳; > 0.30 按保
IB 32–37：mid tier → acceptance_rate ≤ 0.25 按稳; 0.25–0.50 按稳偏保; > 0.50 按保
IB < 32：acceptance_rate ≤ 0.50 按冲; > 0.50 按保
```

**acceptance_rate 代理评分**（无标化数据时通用）：
```js
function rateScore(rate) {
  if (!rate) return 20; // 无数据，中性分
  if (rate > 0.50) return 38;
  if (rate > 0.30) return 28;
  if (rate > 0.15) return 18;
  return 10;
}
```

**GPA 修正**（叠加在成绩分上，±5分范围内）：
```js
const gpaAdj = profile.gpa_us >= 3.9 ? 4 : profile.gpa_us >= 3.7 ? 2 : profile.gpa_us >= 3.5 ? 0 : -3;
```

#### B. 专业匹配分（20分）

```js
function majorScore(school, majorKey) {
  const keywords = MAJOR_MAP[majorKey].keywords;
  const hits = school.popular_majors?.filter(m =>
    keywords.some(k => m.toLowerCase().includes(k.toLowerCase()))
  ).length ?? 0;
  return hits >= 2 ? 20 : hits === 1 ? 14 : 8;
}
```

#### C. 优先因子分（25分）

```js
const PRIORITY_SCORE = {
  ranking:     s => scoreByRank(s.qs_rank_2025),    // QS排名越高越高分
  scholarship: s => s.scholarship_intl ? 25 : 5,
  coop:        s => s.coop_available ? 25 : 5,
  post_work:   s => scoreByPSW(s.post_study_work),  // 工签越长越高分
  life_quality:s => scoreByCity(s.campus_setting, s.chinese_student_community),
};

function scoreByRank(rank) {
  if (!rank) return 12;
  if (rank <= 20) return 25; if (rank <= 50) return 20;
  if (rank <= 100) return 15; if (rank <= 200) return 10;
  return 6;
}

function scoreByPSW(months) {
  if (months >= 36) return 25; if (months >= 24) return 18;
  if (months >= 12) return 12; return 5;
}

function scoreByCity(setting, community) {
  let s = setting === 'urban' ? 12 : setting === 'suburban' ? 8 : 4;
  s += community === 'large' ? 13 : community === 'medium' ? 8 : 4;
  return s;
}
```

#### D. 课外活动匹配分（10分）

```js
// 高选择性院校（acceptance_rate < 0.15）对 EC 要求高
const ecMap = { strong: 10, good: 7, basic: 4 };
const ecPenalty = (profile.ec_level !== 'strong' && s.acceptance_rate < 0.15) ? -3 : 0;
const ecScore = ecMap[profile.ec_level] + ecPenalty;
```

#### E. 语言舒适度分（5分）

```js
// 超出最低要求越多，分数越高（代表申请不会被语言卡）
const margin = profile.english_score - s.ielts_min; // 统一用 IELTS 单位
const langScore = margin >= 1.0 ? 5 : margin >= 0.5 ? 4 : margin >= 0 ? 3 : 0;
```

#### 最终合成

```js
function calcMatchScore(school, profile) {
  const academic = calcAcademic(school, profile);       // 0–40（含 GPA 修正）
  const major    = majorScore(school, profile.major_interest); // 0–20
  const priority = PRIORITY_SCORE[profile.priority](school);   // 0–25
  const ec       = calcEC(school, profile);              // 0–10
  const lang     = calcLang(school, profile);            // 0–5
  return Math.min(99, Math.round(academic + major + priority + ec + lang));
}
```

### 3.4 梯队判定（Tier）

梯队基于 matchScore 而非单独的 acceptance_rate，因此同一院校对不同学生梯队不同：

```js
function getTier(score) {
  if (score >= 72) return 'safe';    // 保底
  if (score >= 52) return 'target';  // 目标
  return 'reach';                    // 冲刺
}
```

梯队标签：
- `reach`：冲 🔴
- `target`：稳 🟡
- `safe`：保 🟢

### 3.5 结果排序与分组

```js
// 排序：先按梯队（safe > target > reach），同梯队内按 matchScore 降序
const TIER_ORDER = { safe: 0, target: 1, reach: 2 };
results.sort((a, b) =>
  TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.matchScore - a.matchScore
);
```

---

## 4. UI 组件规格

### 4.1 整体布局

```
┌─────────────────────────────────────────┐
│  页面标题：联申定位器                     │
├─────────────────────────────────────────┤
│  Step 01 学术画像  [课程体系切换 tabs]    │
│  → 动态显示对应成绩输入字段               │
├─────────────────────────────────────────┤
│  Step 02 申请偏好                        │
├─────────────────────────────────────────┤
│  [生成定位方案 →] 按钮                   │
├─────────────────────────────────────────┤
│  结果区（默认隐藏，生成后显示）           │
│  ┌── 保底校 (N所) ──────────────────┐   │
│  │  院校卡片 × N                     │   │
│  └───────────────────────────────────┘   │
│  ┌── 目标校 (N所) ──────────────────┐   │
│  └───────────────────────────────────┘   │
│  ┌── 冲刺校 (N所) ──────────────────┐   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 4.2 课程体系切换

三个 tab chips（AP / A-Level / IB），切换时：
- 动画过渡隐藏/显示对应成绩字段
- 切换不清空已填内容（存 state）
- 其他字段（GPA、英语、EC）保持不变

### 4.3 院校卡片（collapsed 状态）

```
┌──────────────────────────────────────────────┐
│ [稳] 🇺🇸 加州大学圣地亚哥分校   UCSD        │
│      San Diego · 公立 · QS #65              │
│                                              │
│ ████████████████████░░░░  76分               │
│ ← 学术  ← 专业  ← 优先因子  展开详情 ∨       │
└──────────────────────────────────────────────┘
```

字段：
- 梯队标签（colored chip）
- 国旗 emoji + 中文校名 + 英文缩写
- 城市 · 类型 · QS排名（若无排名显示 USNews）
- matchScore 进度条 + 分值
- 分项贡献提示（小字，可选）

### 4.4 院校卡片（expanded 状态）

点击卡片后展开：

```
┌── 详细信息 ──────────────────────────────────┐
│  [4格 metric cards]                          │
│  年学费(USD)  年生活费(USD)  录取率  工签时长 │
│                                              │
│  [雷达图 200×180px]                          │
│  五维：排名 / 就业 / 奖学金 / 语言 / 签证     │
│                                              │
│  申请截止：2026-11-30  体系：Common App      │
│  语言要求：IELTS 7.0 / TOEFL 100            │
│  热门专业：CS · Business Economics · ...    │
│                                              │
│  [special_notes 说明文字]                    │
│                                              │
│  标签：#STEM #top40 #silicon-valley ...      │
│                                              │
│  [深度分析这所院校 ↗]  [查看官网 ↗]         │
└──────────────────────────────────────────────┘
```

雷达图五维计算方式：
```js
const radarDims = {
  ranking:   scoreByRank(s.qs_rank_2025),
  employ:    (s.coop_available ? 15 : 0) + scoreByPSW(s.post_study_work),
  scholarship: s.scholarship_intl ? 80 : 20,
  language:  Math.min(100, (s.ielts_min - 6.0) / 1.5 * -50 + 80), // 要求越低越友好
  visa:      scoreByPSW(s.post_study_work) * 4,
};
// 归一化到 0–100
```

### 4.5 结果区头部摘要

```
定位方案已生成 · 共匹配 N 所院校
梯队分布：保底 X 所 / 目标 Y 所 / 冲刺 Z 所
[重新填写] [导出梯队表 PDF（即将推出）]
```

### 4.6 空态处理

若过滤后结果为 0：
```
当前条件无匹配院校
建议：放宽预算限制 / 增加目标国家 / 检查语言成绩是否满足最低要求
[重新调整条件]
```

### 4.7 错误状态

```js
// 数据加载失败时
if (loadError) showBanner('数据加载失败，请刷新页面重试', 'error');

// 输入验证失败时（inline，不用 alert）
if (!profile.target_countries.length) showFieldError('target_countries', '请至少选择一个目标国家');
```

---

## 5. 状态管理规格

```js
// 全局状态对象（plain object，无框架）
const state = {
  schools: [],           // 加载后的院校数组（清洗后）
  loading: false,
  error: null,
  profile: {             // 用户画像（与 localStorage 同步）
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
  results: null,         // null = 未计算；[] = 无结果；[...] = 有结果
};
```

状态更新通过 `updateState(patch)` 函数，每次更新后调用 `render()`（轻量 re-render，不用虚拟 DOM）。

---

## 6. 交互细节

### 6.1 表单验证规则

| 字段 | 规则 |
|------|------|
| AP 科目数 | 1–15 整数 |
| AP 平均分 | radio，必选 |
| IB 预测分 | 24–45 整数 |
| GPA | 2.0–4.0，精度 0.1 |
| 英语成绩 | IELTS: 4.0–9.0 步进 0.5; TOEFL: 60–120 整数; Duolingo: 85–160 |
| 目标国家 | 至少 1 个 |

### 6.2 动态字段联动

```
curriculum 变化 → 显示/隐藏成绩字段（CSS transition opacity）
english_test 变化 → 更新英语分数的 placeholder 和 min/max/step
target_countries 变化 → 结果若已显示，提示"偏好已变更，点击重新生成" banner
```

### 6.3 滚动行为

点击"生成定位方案"后：
1. 验证输入（有错立即高亮，不执行匹配）
2. 执行匹配算法（同步，< 50ms）
3. `results` 区域 `display: block`
4. `scrollIntoView({ behavior: 'smooth', block: 'start' })`

### 6.4 深度分析按钮

```js
// 触发 sendPrompt（平台内）或复制到剪贴板（独立页面）
function deepAnalyze(school) {
  const prompt = `请详细分析 ${school.name_zh}（${school.name_en}）对以下学生的录取可能性与申请策略：
课程体系：${profile.curriculum.toUpperCase()}，成绩：${formatScore(profile)}
GPA：${profile.gpa_us}，英语：${profile.english_test.toUpperCase()} ${profile.english_score}
意向专业：${MAJOR_MAP[profile.major_interest].label}
课外活动：${profile.ec_level}`;
  
  if (typeof sendPrompt === 'function') sendPrompt(prompt);
  else { navigator.clipboard.writeText(prompt); showToast('分析提示词已复制'); }
}
```

---

## 7. 样式规格

### 7.1 颜色系统（CSS 变量）

使用宿主 CSS 变量，不自定义颜色系统：

```css
/* 不要定义自定义颜色变量，使用以下系统变量 */
--color-text-primary      /* 正文 */
--color-text-secondary    /* 次要文字 */
--color-background-primary    /* 卡片背景 */
--color-background-secondary  /* 输入框 / metric card 背景 */
--color-border-tertiary   /* 默认边框 */
--color-border-secondary  /* 悬停边框 */
--border-radius-md        /* 8px */
--border-radius-lg        /* 12px */
--font-mono               /* IBM Plex Mono 等宽字体 */
```

**梯队颜色**（硬编码，不用 CSS 变量——这是语义色，需要固定）：

```css
.tier-safe   { background: #EAF3DE; color: #27500A; border: 0.5px solid #97C459; }
.tier-target { background: #FAEEDA; color: #633806; border: 0.5px solid #EF9F27; }
.tier-reach  { background: #FCEBEB; color: #501313; border: 0.5px solid #F09595; }
```

### 7.2 字体

```html
<!-- 在 <head> 中引入 -->
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+SC:wght@300;400;500&display=swap" rel="stylesheet">
```

- 正文：`'Noto Sans SC', sans-serif`
- 数字/代码/分数：`'IBM Plex Mono', monospace`
- 标题不加粗（`font-weight: 500`），无 600/700

### 7.3 关键尺寸

```
院校卡片 padding: 1rem 1.25rem
卡片间距 gap: 10px
进度条高度: 3px
雷达图容器: 200px × 180px
metric card padding: 10px 12px
输入框高度: ~36px
```

### 7.4 动效

- 卡片展开/收起：`max-height` transition 300ms ease（不用 display toggle）
- 课程体系切换字段：`opacity + transform` 200ms
- matchScore 进度条：`width` transition 600ms ease（页面渲染后触发）
- 所有 `transition` 用 CSS，不用 JS animation

### 7.5 暗色模式

所有颜色使用 CSS 变量，自动适配。梯队硬编码色在暗色模式下需用 `@media (prefers-color-scheme: dark)` 覆盖：

```css
@media (prefers-color-scheme: dark) {
  .tier-safe   { background: #173404; color: #C0DD97; border-color: #3B6D11; }
  .tier-target { background: #412402; color: #FAC775; border-color: #854F0B; }
  .tier-reach  { background: #501313; color: #F7C1C1; border-color: #A32D2D; }
}
```

---

## 8. Chart.js 雷达图规格

```html
<!-- 在 </body> 前引入 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
```

```js
function drawRadar(canvasId, school) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  new Chart(document.getElementById(canvasId), {
    type: 'radar',
    data: {
      labels: ['排名', '就业', '奖学金', '语言友好', '签证'],
      datasets: [{
        data: calcRadarData(school),      // 归一化 0–100 的五维分
        backgroundColor: 'rgba(29,158,117,0.10)',
        borderColor: '#1D9E75',
        pointBackgroundColor: '#1D9E75',
        pointRadius: 3,
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
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
          }
        }
      }
    }
  });
}
```

**重要**：每个 canvas 需要 `role="img"` 和 `aria-label`：
```html
<canvas id="radar-{school.id}" role="img" aria-label="{school.name_zh} 五维评分雷达图"></canvas>
```

只在卡片展开时初始化（`setTimeout(..., 80)`），避免隐藏 canvas 的尺寸计算错误。

---

## 9. 文件结构

```
/
├── index.html           ← 主文件（包含所有 HTML/CSS/JS）
└── data/
    └── schools.json     ← 已有，直接使用
```

单文件原则：所有 CSS 内联 `<style>`，所有 JS 内联 `<script>`（除 CDN 引入外）。

---

## 10. 实现优先级

| 优先级 | 功能 |
|--------|------|
| P0 | 数据加载 + 清洗 + 货币换算 |
| P0 | 输入表单（三体系切换 + 所有字段） |
| P0 | 匹配算法完整实现 |
| P0 | 院校卡片（collapsed + expanded） |
| P0 | 结果分组展示（冲/稳/保） |
| P1 | 雷达图 |
| P1 | localStorage 持久化 |
| P1 | 暗色模式适配 |
| P1 | 深度分析按钮 |
| P2 | 输入验证（inline 错误提示） |
| P2 | 结果变更提示 banner |
| P2 | 空态 / 错误态 UI |

---

## 11. 已知数据局限（在 UI 中说明）

- A-Level 要求仅覆盖 17 所英国院校中的 10 所，其余用录取率代理
- SAT 数据仅覆盖美国 42 所院校，IB 和 A-Level 申请者对美国院校也用录取率代理
- 学费数据为 2025–2026 学年，实际以官网为准
- 所有推荐结果仅供参考，不构成录取保证

在结果区底部添加免责声明（小字，`color-text-secondary`）。

---

*文档版本：v1.0 | 生成日期：2026-04-17 | 数据源：schools.json v1.0.0（85所，2026-04-17）*
