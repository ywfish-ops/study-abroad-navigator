# Gemini Prompt：批量提取院校 batch_b 数据

> 用法：把整段 prompt 复制到 Gemini Pro App，每次替换【学校列表】部分即可。
> 建议每批 5-10 所学校，避免输出过长被截断。

---

## 完整 Prompt（复制以下全部内容到 Gemini）

你是一个严谨的留学数据采集助手。请帮我从学校官网招生页面提取本科申请的关键信息，输出严格的 JSON 格式。

## 任务背景

我正在构建一个面向中国高中生的留学决策工具，需要 QS 世界 Top 100 + US News Top 100 院校的本科申请数据。这批数据将用于学生选校匹配、财务测算和奖学金筛选。数据准确性极其重要——错误的录取要求或学费会直接误导用户的申请决策。

## 数据采集原则（极其重要）

1. **数据源优先级**：必须使用学校官方招生网站（admissions / undergraduate / international students 页面）。不要使用第三方排名网站、留学中介页面、维基百科。
2. **不确定就填 null**：任何无法从官网明确确认的字段，必须填 `null`。**绝对不要猜测、推断、编造**。
3. **区分"无要求"和"未找到"**：
   - 学校明确说"no minimum score required" → 填 `null` 并在 `english_note` 说明
   - 你没找到信息 → 也填 `null`，但在备注里写 "data not found on official site"
4. **货币和单位**：金额字段必须是数字（不带货币符号、逗号），年学费用整数美元估算（如本币不是 USD，按当前汇率换算）
5. **日期格式**：统一 `YYYY-MM-DD`，针对 2027 Fall 入学（即 2026-2027 申请季）的截止日期

## 输出 Schema

每所学校输出一个 JSON 对象，结构如下：

```json
{
  "school_id": "学校简称小写，如 mit, ucl, hkust",
  "batch_b": {
    "programs": ["专业1", "专业2", "..."],
    "ielts_min": 数字 或 null,
    "toefl_min": 数字 或 null,
    "english_note": "字符串，补充说明（如单科要求、豁免条件）",
    "avg_accepted_toefl": 数字 或 null,
    "avg_accepted_ielts": 数字 或 null,
    "application_deadline": {
      "early_action": "YYYY-MM-DD" 或 null,
      "regular": "YYYY-MM-DD"
    },
    "sat_mid50": {
      "math": [下限, 上限],
      "reading": [下限, 上限]
    } 或 null,
    "act_mid50": [下限, 上限] 或 null,
    "financial_aid_international": true / false,
    "scholarship_availability": true / false,
    "scholarship_note": "奖学金名称及简介，100字以内",
    "scholarship_typical_usd_annual": 数字 或 null
  },
  "_extraction_notes": {
    "source_urls": ["数据来源 URL 列表"],
    "uncertainties": ["不确定或未找到的字段说明"],
    "extraction_date": "YYYY-MM-DD"
  }
}
```

## 字段填写细则

**programs**（最多 10 个）
- 只列本科核心专业，不列硕士/博士
- 用学校官网的英文名称，不翻译
- 优先列学校最有名的专业（如 MIT 的 CS、UCL 的 Architecture）

**ielts_min / toefl_min**
- 学校招生官网"English Language Requirements"页面的最低总分
- 如果不同专业要求不同，用最低值并在 `english_note` 说明
- 学校接受多种英语证明的，只填 IELTS 和 TOEFL

**english_note**
- 单科最低分要求（如"no band below 6.0"）
- 豁免条件（如"母语为英语者豁免"）
- 替代证书说明（如"也接受 Duolingo 110+"）

**application_deadline**
- 针对 **2027 Fall 入学**（即 2026-2027 申请季）
- 美国学校：early_action / early_decision 用 `early_action` 字段
- UCAS 学校：`regular` 填 1 月 14 日 18:00 UK 时间，统一记为 "2027-01-14"
- 港新澳学校：填学校官网公布的 international student deadline

**sat_mid50 / act_mid50**
- 来自学校公布的 Common Data Set 或 Class Profile
- 仅美国学校需要，UK/HK/SG/AU 学校填 null
- test-optional 学校如有数据仍要填，并在 `english_note` 备注"test optional"

**financial_aid_international**
- `true`：明确提供国际生 need-based 助学金
- `false`：仅美国公民/绿卡可申请助学金
- 不确定填 `null`

**scholarship_availability**
- `true`：有任何形式的国际生奖学金（merit / need / specific）
- `false`：明确说无国际生奖学金

**scholarship_note**
- 奖学金名称（如 "Melbourne International Undergraduate Scholarship"）
- 类型（merit-based / need-based）
- 大致金额或覆盖比例
- 100 字以内

**scholarship_typical_usd_annual**
- 典型获奖者每年获得的奖学金额（USD）
- 如果是 need-based 全额，按学费 + 生活费估算
- 如果是 merit-based 固定金额，直接换算
- 不确定填 `null`

## 学校列表

请提取以下学校的 batch_b 数据：

【在这里粘贴你要处理的学校列表，例如：】
1. Stanford University
2. University College London (UCL)
3. University of Oxford
4. National University of Singapore (NUS)
5. The University of Hong Kong (HKU)

## 输出要求

1. 用 markdown 代码块包裹，语言标记为 `json`
2. 输出格式：一个 JSON 数组，包含所有学校的对象
3. 每所学校的 `_extraction_notes.source_urls` 必须列出实际访问的官网 URL
4. 不要在 JSON 外添加解释文字，所有说明放在 `_extraction_notes.uncertainties`
5. 如果某所学校的官网无法访问或信息严重缺失，仍然输出该学校的 JSON 对象，但 `batch_b` 内字段全部填 null，并在 `uncertainties` 说明原因

## 示例输出

```json
[
  {
    "school_id": "stanford",
    "batch_b": {
      "programs": [
        "Computer Science",
        "Engineering",
        "Economics",
        "..."
      ],
      "ielts_min": null,
      "toefl_min": 100,
      "english_note": "TOEFL 100 recommended; no IELTS minimum stated; test required if instruction not in English",
      "avg_accepted_toefl": null,
      "avg_accepted_ielts": null,
      "application_deadline": {
        "early_action": "2026-11-01",
        "regular": "2027-01-05"
      },
      "sat_mid50": {
        "math": [760, 800],
        "reading": [730, 780]
      },
      "act_mid50": [34, 35],
      "financial_aid_international": true,
      "scholarship_availability": true,
      "scholarship_note": "Need-based aid for international applicants; meets 100% of demonstrated need; no merit scholarships",
      "scholarship_typical_usd_annual": 60000
    },
    "_extraction_notes": {
      "source_urls": [
        "https://admission.stanford.edu/apply/international/",
        "https://admission.stanford.edu/apply/freshman/"
      ],
      "uncertainties": [
        "avg_accepted_toefl 官网未公布"
      ],
      "extraction_date": "2026-04-15"
    }
  }
]
```

## 开始执行

请按照以上规范，提取上方"学校列表"中所有学校的数据，输出严格 JSON。
