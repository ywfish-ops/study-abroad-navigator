# 模块 1A：学术灵魂定位测试
## 开发规格文档 v1.0
**项目**：全球留学决策导航系统  
**阶段**：Phase 1 — "我该申请哪里？"  
**预计上线**：2026年6月（毕业典礼发布节点）  
**文档状态**：草稿，待 Leo 审阅

---

## 1. 产品定位与设计哲学

### 1.1 模块目标

模块 1A 是整个平台的**入口锚点**。用户完成测试后，系统生成一个"学术人格画像"，该画像将：

1. 在当前 session 驱动后续模块（1B 多国推荐、1C 财务沙盒）的个性化展示
2. 持久存储为用户的"基础档案"，在 Phase 3 Offer PK 阶段被二次调用
3. 作为分享卡片的核心内容，驱动冷启动期的口碑传播

### 1.2 设计原则

- **非测评，是定位**：不评价好坏，只描述"你是谁"，规避用户防御心理
- **专业感 > 趣味感**：不做 MBTI 风格，走学术顾问的语气
- **结果要可操作**：每个画像类型直接对应推荐策略，不是装饰品
- **移动端优先**：目标用户在手机上完成，单手操作，卡片式进度

---

## 2. 题库规格

### 2.1 题目结构总览

| 维度 | 英文代号 | 题目数 | 测量目标 |
|------|----------|--------|----------|
| 学习驱动力 | DRIVE | 4 | 内驱 vs 外驱；探索 vs 目标导向 |
| 环境偏好 | ENV | 4 | 城市/校园；竞争/协作；规模感 |
| 风险容忍度 | RISK | 4 | 冲刺/保底比例；不确定性接受度 |
| 职业锚点 | CAREER | 4 | 学术/行业/创业/公共机构 |
| 身份认同 | IDENTITY | 4 | 本土连接 vs 全球移动性偏好 |

**总计：20题**，预计完成时间 4-6 分钟

### 2.2 完整题库

#### DRIVE 维度（学习驱动力）

---

**D1** — 单选，4选1

> 当你开始一门新课程，最让你兴奋的是什么？

| 选项 | 标签 | 分值 |
|------|------|------|
| A. 这门课和我未来的职业方向直接相关 | goal-oriented | D_EXT+2 |
| B. 我对这个话题本身很好奇，想搞懂它 | intrinsic | D_INT+2 |
| C. 教授或同学的评价让我觉得值得学 | social | D_SOC+2 |
| D. 这门课的成绩对我的申请或 GPA 很重要 | credential | D_CRED+2 |

---

**D2** — 滑块，1-7 分

> 在做一个学期项目时，你更倾向于——

左端（1）：**把时间花在弄懂核心原理上**，哪怕最终作品不够"完整"  
右端（7）：**把时间花在把作品做到最好看**，哪怕原理还有些模糊

*分值映射：1-3 → D_DEPTH+2；4 → 中性；5-7 → D_POLISH+2*

---

**D3** — 排序，拖拽4项

> 把以下4种"学习成果"按对你的重要程度从高到低排序：

- 我能把这个概念解释给完全不懂的人听
- 我做出了一个可以展示的东西（作品/论文/项目）
- 我在这个领域认识了重要的人
- 我的成绩单上有一个好看的分数

*第1位得4分，第2位得3分……按维度拆分统计*

---

**D4** — 单选，3选1

> 你在学校里"最讨厌"的老师类型是？

| 选项 | 信号 |
|------|------|
| A. 讲课没逻辑，知识点跳来跳去 | → 结构偏好者 |
| B. 只讲理论，完全没有实际案例 | → 应用偏好者 |
| C. 上课读PPT，没有互动和讨论 | → 互动偏好者 |

---

#### ENV 维度（环境偏好）

---

**E1** — 图选，选一张照片（配图 placeholder）

> 以下哪个校园场景最让你感到"对，这就是我想要的"？

| 图片描述 | 信号 |
|----------|------|
| 城市中心的摩天楼旁，一栋现代玻璃幕墙教学楼 | E_URBAN+2 |
| 被树林和湖泊包围的绿色传统校园 | E_CAMPUS+2 |
| 开放式共享工作空间，满是白板和学生讨论 | E_COLLAB+2 |
| 独立安静的图书馆自习区，每个人专注于自己的工作 | E_SOLO+2 |

---

**E2** — 单选，4选1

> 关于班级/项目规模，你的直觉是？

| 选项 | 信号 |
|------|------|
| A. 小班更好，教授能叫出我的名字 | ENV_SMALL |
| B. 大班没关系，我会主动找教授 Office Hour | ENV_LARGE |
| C. 关键看同学质量，规模不重要 | ENV_PEER |
| D. 我需要一段时间才能判断 | ENV_UNSURE |

---

**E3** — 场景题，单选

> 开学第一周，你的室友邀请你去参加系里的社交活动。你的第一反应是？

| 选项 | 信号 |
|------|------|
| A. 好！这是认识同学的好机会 | ENV_SOC_HIGH |
| B. 可以去一会儿，但我也需要自己的时间缓冲 | ENV_SOC_MED |
| C. 我更倾向于在小圈子里慢慢建立关系 | ENV_SOC_LOW |

---

**E4** — 量表，5级

> "在一个竞争激烈的班级里，我会变得更有动力。"

完全不同意 → 完全同意（1-5分）  
*高分 → COMP_OK；低分 → COMP_AVOID*

---

#### RISK 维度（风险容忍度）

---

**R1** — 单选，情景题

> 现在是12月，你有两个选择来分配剩余的申请名额：

| 选项 | 信号 |
|------|------|
| A. 全部用来冲刺 Top 20，接受可能全聚德的风险 | RISK_HIGH |
| B. 一半冲刺一半保底，确保至少有学上 | RISK_MED |
| C. 以录取概率高的学校为主，再加1-2个冲刺 | RISK_LOW |
| D. 完全取决于爸妈的意见 | RISK_DEFER |

---

**R2** — 滑块，1-7

> 如果你拿到的最好录取，比你原本设定的目标低一个档次，你会？

左（1）：**接受并感到满足**，重要的是拿到了好offer  
右（7）：**感到强烈遗憾**，会考虑Gap Year再申

*高分 → RISK_REGRET_HIGH（对结果敏感）；低分 → RISK_FLEXIBLE*

---

**R3** — 单选

> 关于"转专业申请"（用非本科专业背景申请研究生），你的态度是？

| 选项 | 信号 |
|------|------|
| A. 我愿意尝试，背景差异可以变成差异化优势 | RISK_CREATIVE |
| B. 我会选择有跨专业录取先例的项目，降低不确定性 | RISK_INFORMED |
| C. 我更倾向于申请本专业，稳一点 | RISK_CONSERVATIVE |

---

**R4** — 开放式量表（5级）

> "我能接受在一个完全陌生的城市/国家独立生活，没有任何认识的人。"

完全不能接受 → 完全可以接受  
*高分 → ADAPT_HIGH；低分 → ADAPT_LOW，触发 EN 偏好建议*

---

#### CAREER 维度（职业锚点）

---

**C1** — 强制二选一，连续3轮（类似 This or That）

轮次 1：**学术研究** vs **行业实践**  
轮次 2（若选学术）：**继续博士深造** vs **毕业后进高校/研究机构**  
轮次 2（若选行业）：**进入大公司/跨国企业** vs **创业或加入初创**  
轮次 3（所有人）：**回国发展** vs **留在海外发展**

*分支路径生成 CAREER_TAG，见画像映射表*

---

**C2** — 多选（最多选3个）

> 你最看重研究生阶段带给你的是什么？（选最重要的3项）

- [ ] 专业深度和研究能力
- [ ] 顶校的品牌和学历背书
- [ ] 海外生活和文化体验
- [ ] 人脉网络（同学、校友、教授）
- [ ] 提升就业竞争力和薪资
- [ ] 为移民或长期居留铺路
- [ ] 探索自己真正的兴趣

---

**C3** — 排序

> 把以下3种"成功的研究生经历"按你的判断排序：

- 毕业时手握多个高薪工作 offer
- 毕业时发表了有影响力的研究论文
- 毕业时在新城市建立了真实的生活方式和社交圈

---

**C4** — 单选

> 三年后，你最希望在哪里工作？

| 选项 |
|------|
| A. 中国一线城市（北上广深杭） |
| B. 香港或新加坡 |
| C. 美国或英国 |
| D. 还不确定，保持灵活 |

---

#### IDENTITY 维度（身份认同）

---

**I1** — 量表，7级

> "出国留学对我来说，'离开中国'本身也是目标的一部分。"

完全不是 → 完全是

*高分 → IDENTITY_GLOBAL；低分 → IDENTITY_BRIDGE*

---

**I2** — 图选（emoji 辅助）

> 你心目中"理想的留学状态"最接近哪一张？

| 描述 | 信号 |
|------|------|
| 🌏 在异国他乡完全融入当地生活，说流利的英语/粤语 | GLOBAL_FULL |
| 🌉 在两种文化之间切换自如，保持双重身份 | BRIDGE |
| 🏠 在海外保持中国文化圈，留学只是手段 | HOME_BASED |

---

**I3** — 单选

> 你的父母/家庭对这次留学决策的影响力是？

| 选项 |
|------|
| A. 完全由我自己决定 |
| B. 我主导，但需要家人认可 |
| C. 共同决策，家人意见很重要 |
| D. 主要由家人决定，我配合 |

*影响推荐策略中"如何向家长呈现"的话术*

---

**I4** — 情景题

> 你在社交媒体上发现一篇文章，标题是《放弃海外高薪回国的年轻人后悔了吗？》，你的第一反应是？

| 选项 | 信号 |
|------|------|
| A. 马上点进去，这个问题困扰我很久了 | IDENTITY_UNCERTAIN |
| B. 有点好奇，但这不是我现在要想的事 | IDENTITY_PRESENT |
| C. 不太感兴趣，我对自己的方向比较清楚 | IDENTITY_CLEAR |

---

## 3. 算分逻辑

### 3.1 原始分计算

每道题按维度累积得分，20题结束后得到5个维度的原始分向量：

```
raw_scores = {
  DRIVE:    { INT, EXT, DEPTH, POLISH, SOC, CRED }
  ENV:      { URBAN, CAMPUS, COLLAB, SOLO, SMALL, LARGE, SOC_HIGH, SOC_LOW, COMP }
  RISK:     { HIGH, MED, LOW, REGRET, FLEXIBLE, CREATIVE, ADAPT }
  CAREER:   { ACADEMIC, INDUSTRY, STARTUP, RETURN, GLOBAL, UNSURE }
  IDENTITY: { GLOBAL_FULL, BRIDGE, HOME_BASED, CLEAR, UNCERTAIN }
}
```

### 3.2 标准化

每个维度内做 min-max 标准化，转为 0-100 的连续分：

```javascript
function normalize(scores) {
  const keys = Object.keys(scores);
  const vals = Object.values(scores);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  return Object.fromEntries(
    keys.map(k => [k, Math.round((scores[k] - min) / range * 100)])
  );
}
```

### 3.3 画像匹配算法

用欧氏距离将用户分值向量与预定义画像中心点比对，取距离最近的画像：

```javascript
// 每个画像类型有一个"理想向量"（prototype）
const ARCHETYPES = {
  SCHOLAR_PIONEER: {
    DRIVE_INT: 85, DRIVE_DEPTH: 80,
    RISK_HIGH: 70, CAREER_ACADEMIC: 90,
    ENV_CAMPUS: 60, IDENTITY_BRIDGE: 65
  },
  CAREER_ARCHITECT: { ... },
  // ...共8个画像
};

function matchArchetype(userVector) {
  let bestMatch = null;
  let minDist = Infinity;

  for (const [name, prototype] of Object.entries(ARCHETYPES)) {
    const dist = euclideanDistance(userVector, prototype);
    if (dist < minDist) {
      minDist = dist;
      bestMatch = name;
    }
  }

  // 计算置信度（距离越小置信度越高）
  const confidence = Math.max(0, 100 - minDist / 2);
  return { archetype: bestMatch, confidence, distance: minDist };
}
```

### 3.4 边界处理

- 若最近两个画像距离差 < 15分：触发"混合型"标注，展示双画像说明
- 若某维度未完成（跳题）：用同维度其他题的平均值补全
- 若用户在 I3 中选择"主要由家人决定"：在结果页追加一个"家长视角摘要"区块

---

## 4. 画像类型定义

共 **8种画像**，覆盖目标用户群的主要类型，命名采用"学术+探险家"风格。

### 4.1 画像速览表

| 代号 | 中文名 | 核心特征 | 标志性申请策略 |
|------|--------|----------|----------------|
| SCHOLAR_PIONEER | 学术先锋 | 强内驱，研究导向，接受风险 | 冲刺顶尖研究型大学，套磁教授 |
| CAREER_ARCHITECT | 职业建筑师 | 目标明确，实践导向，稳健 | 名校 + 强校友网络，优先就业率 |
| GLOBAL_NOMAD | 全球游牧者 | 移动性高，文化好奇，适应强 | 多国分散布局，考虑英/港/新加坡组合 |
| HOME_ANCHOR | 归根者 | 留学是手段，归国是目标 | 香港/新加坡优先，学制短，回国资源强 |
| EXPLORER_BETA | 探索者β | 方向未定，广泛兴趣，需要探索空间 | 通识型项目，跨学科，灵活转向 |
| BRAND_HUNTER | 品牌猎手 | 极度重视学校声誉，家庭驱动较强 | 名单驱动申请，需要额外的"去名校化"引导 |
| RISK_HEDGER | 风险对冲者 | 极度保守，需要确定性 | 录取率数据优先，避免冲刺策略 |
| HYBRID_IDENTITY | 双轨探索者 | 中西文化认同均强，战略模糊 | 需先完成身份定位对话再推荐 |

### 4.2 各画像详细说明

---

#### 🔬 SCHOLAR_PIONEER — 学术先锋

**核心驱动向量**：INT↑↑ + DEPTH↑ + RISK_HIGH↑ + CAREER_ACADEMIC↑↑

**人群描述**  
你对知识本身的渴望是最强的驱动力。你不只是要拿一个学位，你在寻找一个能被自己的好奇心深度滋养的学术环境。你愿意为了进入顶尖研究生项目承担较高的申请风险，也接受"All in"式的冲刺策略。

**典型背景信号**
- 本科有科研经历或已发表/在投论文
- 对目标导师/实验室有明确偏好
- GPA 优秀但标化考试可能不完美

**推荐策略倾向**
- US PhD/硕博连读 > 独立硕士
- 积极套磁，发掘低录取率项目中的机会
- 申请清单：2冲刺 + 3目标 + 2保底

**避开的陷阱**
- 不要因为 Ranking 高就申请与研究方向不匹配的项目
- 套磁邮件需要个性化，不要群发

---

#### 🏗️ CAREER_ARCHITECT — 职业建筑师

**核心驱动向量**：EXT↑ + GOAL↑↑ + RISK_MED + CAREER_INDUSTRY↑↑ + ENV_LARGE

**人群描述**  
你知道自己想要什么。留学是你职业路径上经过深思熟虑的一步棋，不是探索期。你在乎项目的行业认可度、校友网络的质量、以及毕业后的就业结果——这些都是合理的优先级。

**典型背景信号**
- 有1-3年工作经验，带着明确的升级目标来申请
- 目标是顶级咨询/金融/科技公司
- 对学校地理位置（就业生态）有强偏好

**推荐策略倾向**
- MBA / MFin / MiM / MSCM 等实践导向项目
- 地理位置权重大于 Ranking（如金融→纽约/香港；科技→湾区/新加坡）
- 申请清单：校友资源 + 招聘数据双维度筛选

---

#### 🌍 GLOBAL_NOMAD — 全球游牧者

**核心驱动向量**：IDENTITY_GLOBAL↑↑ + ADAPT↑ + RISK_HIGH + ENV_URBAN + CAREER_GLOBAL

**人群描述**  
对你来说，去哪里读书本身就是答案的一部分。你不只是在申请一所学校，你在启动一种生活方式。高度的环境适应能力是你的核心资产，你愿意去更陌生、更具挑战性的地方，只要那里有足够的刺激和机会。

**推荐策略倾向**
- 多国分散布局是合理的（美+英、港+英、新+美）
- 优先考虑有国际学生比例高、校友网络全球分布的项目
- 不必执着于回国就业优势

---

#### 🏠 HOME_ANCHOR — 归根者

**核心驱动向量**：CAREER_RETURN↑↑ + IDENTITY_HOME↑ + RISK_LOW + ENV_FAMILIAR

**人群描述**  
你对留学的定位是清醒而务实的——拿一个有含金量的海外学历，然后回来。这没有任何问题，事实上这是最需要精准决策的路径：错误的学校选择会导致学历在回国市场的性价比极低。

**推荐策略倾向**
- 香港、新加坡优先（学制1年、回国认可度高、地理近）
- 英国 1年硕士性价比组合
- 避免美国2年制项目（时间成本高 + 回国时间窗口不佳）
- 重点考察：目标城市校友会活跃度、国内企业对该校的认知度

---

#### 🧭 EXPLORER_BETA — 探索者β

**核心驱动向量**：INT_MED + DIRECTION_UNSURE↑ + RISK_MED + CAREER_UNSURE

**人群描述**  
你还没有完全确定方向，这不是弱点——这是一种真诚。问题在于，申请系统本身是为"已经想清楚"的人设计的，你需要更策略性地选择给你留有探索空间的项目。

**推荐策略倾向**
- 优先选择课程设置灵活、允许跨系选课的项目
- 通识型硕士（Liberal Studies, Interdisciplinary）可作为候选
- 避免专业化极强、出口单一的项目
- **特别行动**：在进入 1B 推荐前，引导用户完成一个"方向澄清对话"（额外3题）

---

#### 🏆 BRAND_HUNTER — 品牌猎手

**核心驱动向量**：CRED↑↑ + RISK_DEFER + IDENTITY_UNCLEAR + ENV_LARGE_BRAND

**人群描述**  
学校名字对你（或你的家人）来说承载了大量意义。这本身可以理解，但名校光环驱动的申请策略有一个系统性风险：当录取结果不符合预期时，你可能没有备用框架来评估"次优"选项的真实价值。

**系统提示**（在画像结果页显示）  
> ⚠️ 我们注意到你的决策受"学校品牌"影响较大。这是一个值得深聊的信号。品牌价值在不同就业市场的实际兑现率差异很大——在进入推荐环节前，建议你完成一个"品牌价值解构"小测试。

---

#### 🛡️ RISK_HEDGER — 风险对冲者

**核心驱动向量**：RISK_LOW↑↑ + ADAPT_LOW + REGRET_HIGH + CAREER_STABLE

**人群描述**  
你对不确定性的容忍度偏低，这在申请过程中会表现为：更倾向于保底、对冲，以及需要更多数据支撑才能做决定。好消息是：这种特质与我们平台的决策支持工具高度契合——你需要的正是更多数据，而不是更多建议。

**推荐策略倾向**
- 申请清单以"保底+目标"为主结构，冲刺比例≤20%
- 重点参考历史录取数据和录取率区间
- 1C 财务沙盒对你格外重要——先把钱算清楚

---

#### 🔄 HYBRID_IDENTITY — 双轨探索者

**核心驱动向量**：IDENTITY_BRIDGE↑ + CAREER_UNSURE + RISK_MED + DIR_CONFLICT

**人群描述**  
你在多个维度上都处于真实的张力之中：回国vs留外、学术vs行业、稳健vs冲刺。这不是摇摆不定，这是复杂情境的真实反映。我们建议在推荐学校之前，先完成一个"优先级锚定"对话。

---

## 5. UI 规格

### 5.1 整体设计语言

**风格定位**：学术感 + 现代简洁，避免游戏化和 MBTI 风

**色彩系统**

```css
:root {
  --bg-primary:    #F8F7F4;   /* 米白，主背景 */
  --bg-card:       #FFFFFF;
  --accent-main:   #2B5CE6;   /* 深蓝，主操作色 */
  --accent-warm:   #E87B35;   /* 暖橙，高亮/强调 */
  --text-primary:  #1A1A2E;
  --text-secondary:#6B7280;
  --border:        #E5E7EB;
  --progress-fill: #2B5CE6;
}
```

**字体规格**

```css
/* 中文：思源宋体（有学术感） */
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');

/* 英文：DM Serif Display（气质配合） */
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap');

/* 正文/UI：系统字体栈 */
font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
```

### 5.2 页面流程与组件规格

#### 页面 0：欢迎屏

```
┌─────────────────────────────────┐
│                                 │
│   🧭                            │
│                                 │
│   找到你的                      │
│   学术定位                      │
│                                 │
│   20题 · 约5分钟 · 免费         │
│                                 │
│   这不是评分，是定位。           │
│   我们帮你找到与你气质匹配的     │
│   留学路径。                    │
│                                 │
│   ┌─────────────────────────┐   │
│   │      开始定位测试        │   │
│   └─────────────────────────┘   │
│                                 │
│   已有 3,241 人完成测试 ›        │
└─────────────────────────────────┘
```

**组件规格**
- 背景：米白 + 右上角极淡的几何线条装饰（SVG，不喧宾夺主）
- CTA 按钮：深蓝填充，圆角 8px，高度 52px
- 社会证明数字：每次打开页面从 localStorage 读取基础数 + 随机增量（3000-3500 区间内浮动）

---

#### 页面 1-20：答题页

```
┌─────────────────────────────────┐
│  ← 返回                 12/20  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  60%   │
├─────────────────────────────────┤
│                                 │
│  环境偏好                        │  ← 维度标签（小字，灰色）
│                                 │
│  在一个竞争激烈的班级里，         │
│  我会变得更有动力。              │
│                                 │
│  ┌───────────────────────────┐   │
│  │  完全不同意               │   │
│  │  ○ ● ○ ○ ○              │   │ ← 5级量表，触摸友好
│  │  完全同意                 │   │
│  └───────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │         下一题           │   │
│   └─────────────────────────┘   │
└─────────────────────────────────┘
```

**交互规格**
- 进度条：顶部固定，蓝色填充，平滑过渡 0.3s ease
- 题目卡片：slide-in 动画（从右入，向左出），duration 200ms
- 量表：圆形单选，触摸区域最小 44px × 44px
- "下一题"按钮：选择后 300ms 自动激活（防误触），或用户主动点击
- 跳题：不允许跳题，但允许返回修改

**不同题型适配**

| 题型 | 组件 |
|------|------|
| 单选4选1 | 卡片列表，选中态：蓝色边框 + 左侧蓝条 |
| 7级滑块 | 原生 range input，自定义样式，两端标签 |
| 排序拖拽 | 拖拽列表（touch-action: pan-y 处理） |
| 图选 | 2×2 图片网格，选中态：蓝色遮罩 + ✓ |
| 二选一 | 全宽两张卡片，水平排列 |

---

#### 页面 21：计算过渡页

```
┌─────────────────────────────────┐
│                                 │
│                                 │
│      正在分析你的学术画像...      │
│                                 │
│      ████████████░░  78%        │
│                                 │
│  ✓ 学习驱动力分析完成            │
│  ✓ 环境偏好识别完成              │
│  ⟳ 匹配学术画像类型...          │
│                                 │
│                                 │
└─────────────────────────────────┘
```

**规格**
- 真实延迟：算法瞬间完成，但UI延迟 2.5秒（建立仪式感）
- 进度条：每0.3s 随机增加5-15%，最后0.5s 跳到100%
- 动态文案：4条，按序展示

---

#### 页面 22：结果页

```
┌─────────────────────────────────┐
│                                 │
│   你的学术画像                   │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🔬                        │  │
│  │  学术先锋                  │  │
│  │  Scholar Pioneer           │  │
│  │                            │  │
│  │  你对知识本身的渴望是       │  │
│  │  最强的驱动力...            │  │
│  └───────────────────────────┘  │
│                                 │
│  你的五维雷达图                  │
│  [Chart.js 雷达图]              │
│                                 │
│  📋 你最应该关注的3件事         │
│  1. 找到研究方向匹配的导师...    │
│  2. 不要只看 Ranking...         │
│  3. 套磁是你的核心武器...        │
│                                 │
│  ┌─────────────────────────┐   │
│  │  查看适合我的学校推荐 →   │   │  ← 进入 1B
│  └─────────────────────────┘   │
│                                 │
│  [分享我的画像]  [保存结果]      │
└─────────────────────────────────┘
```

**雷达图规格（Chart.js）**

```javascript
const radarConfig = {
  type: 'radar',
  data: {
    labels: ['学习驱动', '环境适应', '风险承受', '职业清晰', '身份认同'],
    datasets: [{
      data: [userScores.DRIVE, userScores.ENV, userScores.RISK, 
             userScores.CAREER, userScores.IDENTITY],
      backgroundColor: 'rgba(43, 92, 230, 0.15)',
      borderColor: '#2B5CE6',
      borderWidth: 2,
      pointBackgroundColor: '#2B5CE6',
    }]
  },
  options: {
    scales: {
      r: {
        min: 0, max: 100,
        ticks: { stepSize: 25, display: false },
        grid: { color: '#E5E7EB' },
        pointLabels: { font: { size: 12, family: 'PingFang SC' } }
      }
    },
    plugins: { legend: { display: false } }
  }
};
```

---

### 5.3 响应式断点

```css
/* 移动端优先 */
.quiz-container { 
  max-width: 480px; 
  margin: 0 auto; 
  padding: 16px;
}

/* 平板及以上：居中展示，增加padding */
@media (min-width: 768px) {
  .quiz-container { padding: 32px; }
  .result-card { padding: 40px; }
}
```

### 5.4 无障碍要求

- 所有交互元素 `aria-label` 完整
- 量表组件使用 `role="radiogroup"`
- 颜色对比度满足 WCAG AA（深蓝文字 on 白背景：对比度 > 4.5:1）
- 支持键盘导航（Tab + Enter/Space）

---

## 6. 存储结构

### 6.1 localStorage Key 设计

```
globalStudy_profile_v1       → 用户完整画像 JSON
globalStudy_quiz_progress_v1 → 答题进度（用于断点续答）
globalStudy_session_v1       → 当前 session 临时数据
```

### 6.2 完整 Profile Schema

```json
{
  "schemaVersion": "1.0",
  "createdAt": "2026-06-15T10:23:00Z",
  "updatedAt": "2026-06-15T10:28:33Z",

  "quiz1A": {
    "completedAt": "2026-06-15T10:28:33Z",
    "durationSeconds": 287,
    
    "rawAnswers": {
      "D1": "B",
      "D2": 3,
      "D3": ["concept", "artifact", "network", "grade"],
      "D4": "A",
      "E1": "CAMPUS",
      "E2": "A",
      "E3": "B",
      "E4": 4,
      "R1": "B",
      "R2": 6,
      "R3": "B",
      "R4": 4,
      "C1_r1": "ACADEMIC",
      "C1_r2": "PHD",
      "C1_r3": "ABROAD",
      "C2": ["DEPTH", "BRAND", "LIFESTYLE"],
      "C3": ["JOB", "PAPER", "SOCIAL"],
      "C4": "C",
      "I1": 5,
      "I2": "BRIDGE",
      "I3": "B",
      "I4": "B"
    },

    "dimensionScores": {
      "DRIVE":    { "INT": 78, "EXT": 45, "DEPTH": 82, "SOC": 30 },
      "ENV":      { "CAMPUS": 70, "URBAN": 40, "COLLAB": 55, "COMP": 60 },
      "RISK":     { "HIGH": 55, "MED": 70, "FLEXIBLE": 65, "ADAPT": 72 },
      "CAREER":   { "ACADEMIC": 85, "INDUSTRY": 30, "RETURN": 40, "GLOBAL": 65 },
      "IDENTITY": { "GLOBAL": 60, "BRIDGE": 75, "HOME": 25 }
    },

    "archetypeResult": {
      "primary": "SCHOLAR_PIONEER",
      "confidence": 82,
      "secondary": "GLOBAL_NOMAD",
      "secondaryDistance": 18,
      "isHybrid": false
    },

    "flags": {
      "familyDriven": false,
      "directionUnclear": false,
      "brandHunterAlert": false,
      "needsDirectionDialog": false
    }
  },

  "quiz1B": null,
  "quiz1C": null,

  "metadata": {
    "deviceType": "mobile",
    "entrySource": "graduation_qr",
    "shareCode": "SP-2026-A7K3"
  }
}
```

### 6.3 答题进度存储（断点续答）

```json
{
  "currentQuestion": 12,
  "answers": { "D1": "B", "D2": 3, "E1": "CAMPUS" },
  "startedAt": "2026-06-15T10:23:00Z",
  "expiresAt": "2026-06-16T10:23:00Z"
}
```

**断点续答逻辑**：
- 用户关闭页面后，进度保留24小时
- 重新打开时检测到未完成进度，弹出 Modal 询问"继续上次的测试？"
- 超过24小时自动清除，重新开始

### 6.4 数据导出格式（JSON Export）

完整 Profile JSON 可通过"导出数据"功能下载为 `globalStudy_profile_export_YYYYMMDD.json`，支持在新设备上通过"导入数据"恢复。

---

## 7. 分享逻辑

### 7.1 分享卡片规格

分享卡片为**纯 HTML Canvas 渲染后导出为 PNG**，尺寸 **1080×1920px**（9:16竖版，适配微信朋友圈/小红书）。

**卡片内容结构**

```
┌─────────────────────────────────────┐
│                                     │
│  全球留学决策导航系统                │  ← 品牌标识（左上）
│                                     │
│                                     │
│  我的学术画像是                      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   🔬  学术先锋               │    │
│  │       Scholar Pioneer        │    │
│  │                             │    │
│  │   ───────────────────────   │    │
│  │                             │    │
│  │   [五维雷达图]              │    │
│  │                             │    │
│  │   学习驱动 ████████░░ 82    │    │
│  │   风险承受 ██████░░░░ 65    │    │
│  │   职业清晰 █████████░ 85    │    │
│  │   环境适应 ███████░░░ 70    │    │
│  │   身份认同 ████████░░ 75    │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  你也来测测你的学术定位 →            │
│  [二维码]                           │
│                                     │
│  globalstudynav.com/quiz            │
│                                     │
└─────────────────────────────────────┘
```

### 7.2 分享卡片生成技术方案

使用 `html2canvas` 截取页面内隐藏的分享卡片 DOM，转为 PNG 下载。

```javascript
async function generateShareCard(profileData) {
  // 1. 渲染隐藏的分享卡片容器
  const cardEl = document.getElementById('share-card-hidden');
  cardEl.style.display = 'block';
  
  // 2. 绘制雷达图到 canvas
  await renderRadarChart(cardEl, profileData.dimensionScores);
  
  // 3. html2canvas 截图
  const canvas = await html2canvas(cardEl, {
    scale: 2,          // 高清 2x
    width: 540,        // 渲染宽度（×2 = 1080px）
    height: 960,       // 渲染高度（×2 = 1920px）
    backgroundColor: '#F8F7F4'
  });
  
  // 4. 导出并触发下载
  cardEl.style.display = 'none';
  const link = document.createElement('a');
  link.download = `我的学术画像_${profileData.quiz1A.archetypeResult.primary}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

### 7.3 分享渠道与追踪

| 渠道 | 实现方式 | UTM参数 |
|------|----------|---------|
| 微信朋友圈 | 保存图片 → 用户手动发朋友圈 | utm_source=wechat_moments |
| 微信好友 | 保存图片 → 用户手动发送 | utm_source=wechat_dm |
| 小红书 | 保存图片 → 用户手动上传 | utm_source=xiaohongshu |
| 复制链接 | navigator.clipboard + 短链 | utm_source=link_copy |

**短链规则**  
`https://gsn.to/q?r=SP&c=82&src=share`

参数说明：
- `r` = 画像代号（SP = Scholar Pioneer）
- `c` = 置信度
- `src` = 来源（share = 分享进入）

落地页行为：直接跳转至欢迎页，并在页面顶部展示"你的朋友是[学术先锋]，你是哪种类型？"的引导文案。

### 7.4 分享时机触发

| 触发点 | 展示方式 |
|--------|----------|
| 结果页初次加载后 3秒 | Bottom Sheet 弹出"分享你的画像" |
| 用户点击"查看推荐" | 页面跳转前插入分享引导页（可跳过） |
| 毕业典礼现场专属 | 二维码扫码进入后，结果页有"晒一下！" 醒目按钮 |

---

## 8. 开发任务拆解

### 8.1 优先级排序

| 任务 | 优先级 | 预估工时 | 负责工具 |
|------|--------|----------|---------|
| 题库 JSON 结构化 | P0 | 2h | 手工 |
| 算分逻辑 JS 函数 | P0 | 3h | Claude Code |
| 画像原型向量定义 | P0 | 2h | Leo 审阅后锁定 |
| 答题页 UI 组件 | P0 | 6h | Claude Code |
| 结果页 UI + 雷达图 | P0 | 4h | Claude Code |
| localStorage 读写 | P1 | 2h | Claude Code |
| 分享卡片生成 | P1 | 4h | Claude Code |
| 断点续答逻辑 | P1 | 2h | Claude Code |
| 欢迎页 + 过渡页 | P2 | 2h | Claude Code |
| 移动端适配 QA | P2 | 3h | 手工测试 |

**总计预估：~30小时工程量**

### 8.2 待 Leo 决策的问题

在开始 Claude Code 编码前，以下问题需要 Leo 拍板：

1. **画像数量**：目前设计8种，是否精简到6种？（简化测试难度）
2. **排序拖拽题**：移动端体验较差，是否改为多次二选一代替？
3. **图选题**：配图是找真实校园照片还是用插画/图标代替？（版权问题）
4. **分享卡片二维码**：MVP 阶段用静态图片 placeholder 还是真实生成？
5. **"方向澄清对话"**：EXPLORER_BETA 和 HYBRID_IDENTITY 触发的额外3题，是MVP范围内还是留给 Phase 2？

---

## 9. 测试用例

### 9.1 画像匹配准确性测试

以 Scarlett 的实际背景为基准测试用例：

**已知信息**：拿到 F&M、UCL、Durham、HKUST、UCSB、UCI、UCD、UCSC 的 offer

**预期答题模式模拟**（Leo 根据认知填写）

| 维度 | 预期得分区间 | 预期画像输出 |
|------|-------------|-------------|
| DRIVE | INT: 60-70 | - |
| ENV | CAMPUS: 65, URBAN: 45 | - |
| RISK | MED: 75 | - |
| CAREER | INDUSTRY: 60, RETURN: 55 | - |
| IDENTITY | BRIDGE: 70 | - |
| **综合** | | **HOME_ANCHOR 或 CAREER_ARCHITECT** |

### 9.2 边界用例

- 所有题选中间选项 → 应输出 EXPLORER_BETA
- D1=CRED + R1=DEFER + C4=A → 应触发 BRAND_HUNTER
- R4=1（完全不能接受异地生活）→ 应触发额外的地理偏好提示

---

*文档版本：v1.0 | 创建日期：2026-04-14 | 下次审阅：开始 Claude Code 编码前*
