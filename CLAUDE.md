# CLAUDE.md

本文件在每次 Claude Code 会话开始时自动加载。用于告知 Claude Code 本项目的工程约定、技术栈和开发规范。

## 项目简介

全球留学决策导航系统——面向中国高中生及家长的留学决策工具。单页 H5 应用，MVP 阶段无后端数据库。详细产品背景见 `/docs/PRODUCT.md`（如需）。

## 技术栈

- **前端**：单文件 HTML + Vanilla JS（ES6+）+ Tailwind CSS（CDN）
- **图表**：Chart.js（CDN）
- **PDF 生成**：jsPDF + html2canvas（CDN）
- **数据存储**：localStorage + JSON 导入/导出
- **汇率 API**：ExchangeRate-API
- **后端（Phase 2+）**：Cloudflare Workers
- **部署**：Cloudflare Pages
- **包管理**：暂无（全部用 CDN）

## 目录结构

```
/
├── index.html                  # 主入口
├── CLAUDE.md                   # 本文件
├── README.md                   # 项目说明
│
├── app.js                      # 主逻辑、路由、模块调度
├── quiz.js                     # 模块 1A：学术定位测试
├── finance.js                  # 模块 1C：财务沙盘
├── recommender.js              # 模块 1B：联申定位器
├── utils.js                    # 共享工具函数（汇率、localStorage 等）
│
├── schools.json                # 院校数据
├── quiz-questions.json         # 测试题库
├── living-costs.json           # 生活费分级
│
├── styles.css                  # 自定义样式（Tailwind 之外的）
│
└── /docs/
    └── /module-specs/          # 每个模块的开发文档
        ├── 1A-quiz.md
        ├── 1B-recommender.md
        └── 1C-finance.md
```

**目录扁平化原则**：
- 所有代码和数据文件放项目根目录，不建子目录
- 每个模块对应一个 `.js` 文件，用模块名命名
- 只有 `/docs/` 是唯一子目录（文档数量多需要分类）
- 等根目录文件超过 15 个，或引入构建工具时再重构

## 模块封装方式

每个模块用对象字面量封装，暴露到 `window` 供其他模块调用：

```javascript
// quiz.js
const QuizModule = {
  init() { /* ... */ },
  loadQuestions() { /* ... */ },
  renderQuestion(index) { /* ... */ },
  calculateResult(answers) { /* ... */ }
};
window.QuizModule = QuizModule;
```

index.html 中 script 加载顺序：`utils.js` → 各模块 → `app.js`（app.js 最后，负责调度其他模块）。

## 代码规范

### 通用
- 所有代码使用 UTF-8 编码
- 缩进 2 空格
- 文件末尾保留空行
- 单引号字符串（除非字符串内含单引号）

### JavaScript
- 使用 ES6+ 语法（const/let、箭头函数、解构、模板字符串）
- 函数和变量用 camelCase，常量用 UPPER_SNAKE_CASE
- 避免全局变量，用 IIFE 或模块模式封装
- 关键函数写 JSDoc 注释，包括参数类型和返回值
- 异步操作用 async/await，不用 .then()

### HTML/CSS
- 语义化标签（`<nav>`、`<main>`、`<section>` 等）
- Tailwind 优先，特殊样式写到 main.css
- 移动端优先：默认样式为 mobile，再用 `md:`/`lg:` 前缀做桌面端
- 所有交互元素保证触控区域 ≥ 44×44px

### 注释
- 用中文注释（面向开发者 Leo 阅读）
- 每个函数上方说明"做什么"而非"怎么做"
- 复杂算法要写"为什么这样做"

## 数据处理约定

- 所有金额计算保留 2 位小数：`Math.round(x * 100) / 100`
- 排名显示整数
- 日期格式：`YYYY-MM-DD`
- localStorage 键名加版本号：`quiz_result_v1`、`finance_sandbox_v1`
- JSON 导入时做 schema 校验，缺失字段用默认值

### 数据存储两阶段规划

**Phase 1（MVP，当前阶段）：localStorage + JSON 导出/导入**
- 所有用户数据存储在浏览器 localStorage，无服务器
- 提供"导出备份"按钮，将全部数据打包为 JSON 文件下载到本地
- 提供"导入恢复"按钮，读取 JSON 文件还原数据（导入前做 schema 校验）
- 界面显示固定提示语："数据存储在本设备，换设备或清除浏览器数据后将丢失，建议定期导出备份"
- 提示语样式：浅黄色 banner，放在设置页或数据相关操作旁，不打扰主流程

**Phase 2（用户量验证后接入）：Supabase 云端同步**
- 触发条件：月活 > 500 或有用户明确反馈"换手机数据丢了"
- 注册方式：手机号 + 验证码（无密码，降低注册门槛）
- 数据同步：登录后自动将 localStorage 数据上传云端，多设备实时同步
- 迁移策略：Phase 1 → Phase 2 无缝升级，本地数据自动合并到云端，不丢失
- 技术选型：Supabase（PostgreSQL + Auth + Realtime），搭配 Cloudflare Workers 做 API 中间层
- Phase 2 开发前需 Leo 确认 Supabase 项目已建，不要提前写相关代码

### 变现策略（已锁定）
- Phase 1-2：全部功能完全免费，不设任何付费墙
- Phase 3（2027.3）：唯一付费点，¥199 单次，解锁 Offer PK 完整版 + PDF 决策审计报告
- 付费产品定位为「Offer 决策审计」而非「报告」
- 任何时候不得在 UI 中暗示 Phase 1-2 的功能将来会收费

### Phase 3 核心模块（2027.3 上线，现在不实现）
- 灵魂拷问：5-8 道情境逼迫式题目，推算用户真实价值权重（城市vs奖学金、排名vs就业、父母期待vs个人意愿等）
  → 用户录入第一个 Offer 后触发，必须完成才能进入 PK 矩阵
  → 输出免费的「价值权重雷达图预览」作为付费钩子
- Offer PK 矩阵：基于用户权重的个性化评分，付费解锁完整版
- 决策审计 PDF：含权重说明 + 数据支撑 + 审计结论，付费核心交付物
- 注意：Phase 1 的 1A 学术定位测试（学术偏好）与灵魂拷问（决策价值权重）是两个独立模块，目的不同，不合并

## UI 设计约定

- **颜色方案**：专业、克制，参考金融/咨询行业（深蓝 + 灰 + 少量暖色点缀）
- **字体**：系统默认无衬线字体栈，中文优先 PingFang/微软雅黑
- **移动端优先**：目标用户 80%+ 在手机上使用
- **付费墙**：用 CSS blur 遮罩 + "解锁查看"按钮
- **加载状态**：所有异步操作要有 loading 提示
- **错误处理**：用户友好的中文提示，不暴露技术错误

## 开发流程

### 启动开发
```bash
# 本地预览（需装 serve 或用 VS Code Live Server）
npx serve .
# 或
python3 -m http.server 8000
```

### 部署
```bash
# 推送到 main 分支后，Cloudflare Pages 自动部署
git add .
git commit -m "feat: <描述>"
git push origin main
```

### Git 提交规范
- `feat:` 新功能
- `fix:` 修 bug
- `style:` 样式调整
- `refactor:` 重构
- `docs:` 文档
- `data:` 数据更新

## 当前阶段

**Phase 1 开发中（目标 2026.06 上线）**

开发顺序：
1. 项目骨架 + 部署流程（进行中）
2. 院校数据整理（schools.json）
3. 模块 1A：学术定位测试
4. 模块 1C：财务沙盘
5. 模块 1B：联申定位器
6. 移动端适配打磨

## 与 Claude Code 协作约定

1. **全程使用中文对话**：所有回复、解释、提问、报错说明都用中文。代码中的变量名、函数名、英文术语保持英文，但注释和沟通用中文
2. **读文档再写代码**：开发某个模块前，先读 `/docs/module-specs/` 下对应的开发文档
3. **小步提交**：每完成一个可运行的功能点就提交，不要一次改动大量文件
4. **测试再说完成**：每次改动后，至少在本地浏览器打开 index.html 确认无报错
5. **不要擅自加依赖**：新增 CDN 或库前先和 Leo 确认
6. **不要改 schools.json 的字段结构**：数据结构变更需要 Leo 同步更新 `/docs/module-specs/` 里的 schema

## 本项目的 AI 协作背景（简要）

Leo 同时使用四个工具：
- **Claude.ai**：产品设计和模块开发文档（给 Claude Code 的输入）
- **Claude Code（你）**：代码实现和部署
- **Gemini Pro**：批量整理院校数据为 JSON
- **OpenClaw + MiniMax**：后台定时任务（监控汇率、政策页面）

所以：
- 产品决策和文档请 Leo 回 Claude.ai 做，你专注工程实现
- 你产出的代码会被部署后由 OpenClaw 做运行时监控

## schools.json 数据管道

schools.json 每所学校由四个数据批次组成，来源不同，**合并是你（Claude Code）的职责**：

```
College Scorecard API ──→ batch_a（录取率、学费、排名）
Gemini Pro 提取官网 ──→ batch_b（专业、语言要求、截止日期、奖学金）
Claude.ai 手动整理 ───→ batch_c（就业城市、行业、校友、校园风格）
基于 batch_a/b 计算 ──→ finance_sandbox（4年总成本、生活费、保险）
```

### 当 Leo 给你 Gemini 输出的数据时

Leo 会把 Gemini 返回的 JSON 直接粘贴给你（已经人工核查过），你需要：

1. **按 school_id 匹配**：找到 schools.json 中对应的学校
2. **只更新 batch_b 字段**：不动 batch_a、batch_c、finance_sandbox、meta
3. **如果 school_id 不存在**：为该学校新建完整条目，batch_b 填入数据，其他批次字段留空结构（填 null）
4. **合并后更新 meta.batch_b_verified 为 false**：等 Leo 人工确认后再改为 true
5. **合并后更新 meta.data_updated 为当天日期**

### 绝对不要做的事

- ❌ 不要自己编造或猜测院校数据（学费、排名、录取率等）
- ❌ 不要从互联网搜索数据来填充——数据源由 Gemini 和 College Scorecard 负责
- ❌ 不要改变 schools.json 的顶层结构（_schema、schools 数组）
- ❌ 不要删除已有学校的数据，即使 Gemini 新数据中没有那所学校
