# 模块 0：选校探索（School Explorer）

## 定位

首页的核心内容，不是独立页面。作为初选阶段的浏览入口，先于其他功能模块展示（底部导航第一项）。

## 对应文件

- `explorer.js` — 模块逻辑
- `index.html` — tab-explorer 区域

## 数据来源

直接读取 `schools.json`，通过 `Utils.data.loadSchools()` 懒加载，不请求外部接口（汇率除外）。

## 难度档位定义

基于 `acceptance_rate` 字段计算：

| 档位 | 录取率     | 描述     |
|------|-----------|---------|
| S    | < 10%     | 顶尖选拔 |
| A    | 10% - 30% | 高度选拔 |
| B    | 30% - 60% | 中度选拔 |
| C    | > 60%     | 相对开放 |

若 `acceptance_rate` 为 null，不参与难度档位筛选。

## 专业方向分组

将 `popular_majors` 中的具体专业归入以下大类：

| 分组键      | 关键词（模糊匹配）                                           |
|------------|----------------------------------------------------------|
| business   | Business, Finance, Economics, Accounting, Management, Commerce, Marketing |
| cs_eng     | Computer Science, Engineering, Data Science, Computing, Software, IT, Informatics |
| science    | Biology, Chemistry, Physics, Mathematics, Statistics, Science, Biochemistry |
| humanities | Philosophy, History, Political Science, International, Government, Law, Social |
| arts_media | Arts, Film, Design, Music, Media, Communications, Journalism, Architecture |
| health     | Medicine, Health, Nursing, Pharmacy, Biomedical, Pre-Med |

## 筛选维度

| 维度     | 字段来源                       | 类型     |
|---------|-------------------------------|---------|
| 国家    | `country`                     | 多选     |
| 难度档位 | 基于 `acceptance_rate` 计算    | 多选     |
| 专业方向 | 基于 `popular_majors` 分组     | 单选     |
| 4年预算  | `(tuition_intl_annual + avg_living_cost_annual) * 4` → CNY | 滑块范围 |
| 城市规模 | `campus_setting`               | 多选     |

## 首页布局

```
┌─────────────────────────────────┐
│  🔍 搜索框（按校名筛选）            │
├─────────────────────────────────┤
│  [筛选按钮] 展开/折叠筛选面板       │
├─────────────────────────────────┤
│  筛选面板（可折叠）                 │
│  · 国家：多选按钮组                 │
│  · 难度：S / A / B / C             │
│  · 专业：下拉单选                   │
│  · 4年预算：滑块（万元 CNY）        │
│  · 城市规模：城市/郊区/小镇          │
├─────────────────────────────────┤
│  结果数量："共 XX 所院校"           │
├─────────────────────────────────┤
│  卡片网格（1列，可滚动）             │
│  ┌───────────────────────────┐  │
│  │ 🇺🇸 [难度标签]  [专业标签]   │  │
│  │ 学校中文名                  │  │
│  │ University English Name    │  │
│  │ QS #44  ·  4年约 ¥XXX万    │  │
│  │            [加入财务对比 →] │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## 卡片字段

- 国旗 emoji（基于 `country`）
- 难度标签（S/A/B/C，不同颜色）
- `name_zh` + `name_en`
- QS 排名：`qs_rank_2025`（若无显示"未入QS榜"）
- 4年预算估算（CNY，基于实时汇率；无数据则不显示）
- "加入财务对比"按钮

## 加入对比逻辑

点击"加入财务对比"后：
1. 将学校 `id` 写入 localStorage（键：`gs_explorer_compare_v1`，格式：`string[]`，最多5所）
2. 切换到财务沙盘 tab（`switchTab('finance')`）
3. 财务沙盘读取此列表并预填学校

## 登录策略

无需登录即可浏览和筛选；"加入对比"直接操作，无弹窗拦截。

## 状态管理

```javascript
const ExplorerModule = {
  _schools: [],      // 全量数据（懒加载后缓存）
  _rates: {},        // 汇率缓存
  _filters: {
    search: '',
    countries: [],   // 空数组 = 全部
    difficulties: [], // 空数组 = 全部
    major: '',        // '' = 全部
    budgetMax: 300,  // 万元 CNY，300 = 不限
    settings: [],    // 空数组 = 全部
  },
};
```
