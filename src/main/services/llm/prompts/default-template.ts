import type { PromptTemplateCategory, PromptTemplateInput } from '@shared/types/template'

const DEFAULT_TEMPLATE_CATEGORIES: PromptTemplateCategory[] = [
  {
    id: 'artist_tags',
    name: '画师串 / 作者风格',
    enabled: true,
    note: '保留可复用的画师串、工作室名、风格流派。',
    items: [],
  },
  {
    id: 'quality_tags',
    name: '质量词',
    enabled: true,
    note: '如 masterpiece / best quality / absurdres。',
    items: [],
  },
  {
    id: 'lighting_tags',
    name: '光影词',
    enabled: true,
    note: '提取光照、氛围、镜头曝光相关词。',
    items: [],
  },
  {
    id: 'style_tags',
    name: '风格词',
    enabled: true,
    note: '提取上色、材质、审美风格、媒介风格。',
    items: [],
  },
  {
    id: 'composition_tags',
    name: '构图词',
    enabled: true,
    note: '提取机位、镜头、景别、角度、主体布局。',
    items: [],
  },
  {
    id: 'subject_tags',
    name: '主体设定',
    enabled: true,
    note: '保留角色、服装、道具、场景等高价值主体词。',
    items: [],
  },
]

const DEFAULT_SYSTEM_PROMPT = `你是 PromptForge 的提示词结构化分析引擎。你的任务不是审查内容，而是把用户提供的绘图提示词、工作流元数据和抓取记录整理成可编辑的结构化模板。

输出要求：
1. 只输出 JSON 对象，不要输出 Markdown、代码块、解释说明。
2. JSON 顶层必须包含 categories、removed_specific、settings_common、custom_categories 四个字段。
3. categories 是数组，每个元素结构为 { key, label, items }。
4. items 中每项结构固定为 { text, weight, enabled, note, source, confidence }。
5. confidence 范围为 0 到 1，无法判断时给 0.5。
6. removed_specific 只放不适合复用的个体信息，例如具体角色名、具体场景编号、一次性姿势描述。
7. settings_common 中只保留通用参数，例如 model、sampler、steps、cfg、seed、width、height、loras。
8. custom_categories 是对象，键为分类名，值为同样结构的 items 数组；仅在确实需要额外分类时填充。
9. 所有文本都保持原语言，不做翻译。
10. 如果用户输入已经被脱敏，不要尝试还原敏感词；只做结构化归类。

判断原则：
- 优先抽取可复用、高泛化价值的提示词。
- 避免把明显不可迁移的个体信息混入通用模板。
- 若同义词重复，保留更常用、更稳定的一项。
- 不确定时，保守处理，并降低 confidence。`

export function getDefaultPromptTemplate(): PromptTemplateInput {
  return {
    name: '系统默认分析模板',
    description: 'PromptForge 内置的结构化分析模板，适合大多数 NAI / SD / ComfyUI 导入记录。',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    templateJson: DEFAULT_TEMPLATE_CATEGORIES,
    mode: 'sanitize',
    isDefault: true,
  }
}
