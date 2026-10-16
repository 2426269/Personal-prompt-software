import type {
  AnimaArtistSummary,
} from '@shared/types/anima'
import type {
  ComfyConnectionResult,
  ComfyQueueState,
  ComfyQueueStatusResult,
  ComfySubmitResult,
} from '@shared/types/comfy'
import type { EntryDetail, EntryImageDetail, EntryListItem } from '@shared/types/entry'
import type { ParsedComfyUIPrompt, ParsedNAIPrompt, ParsedSDPrompt } from '@shared/types/importer'
import type { NAIConnectionResult, NAISubmitResult } from '@shared/types/nai'
import type { PromptPresetDetail, PromptPresetSummary } from '@shared/types/preset'
import type { SpellbookEntryDetail } from '@shared/types/spellbook'
import type { WorkflowDetail, WorkflowSummary } from '@shared/types/workflow'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toImageSrc } from '@renderer/utils/image-src'
import { formatPromptPresetText } from '@renderer/utils/prompt-presets'

import styles from './Testing.module.css'

const COMFY_STORAGE_KEY = 'promptforge.testing.comfy.connection'
const NAI_STORAGE_KEY = 'promptforge.testing.nai.connection'

const DEFAULT_COMFY_CONNECTION = {
  baseUrl: '',
  historyRoute: '/history',
  clientId: 'promptforge-client',
}

const DEFAULT_NAI_CONNECTION = {
  apiKey: '',
  baseUrl: 'https://api.novelai.net',
}

const NAI_MODELS = [
  'nai-diffusion-3',
  'nai-diffusion-2',
  'nai-diffusion',
  'nai-diffusion-furry',
  'safe-diffusion',
  'custom',
]

type TestingMode = 'comfy' | 'nai'
type PromptSourceMode = 'entry' | 'preset' | 'anima' | 'spellbook'
type NAIImageSourceMode = 'source' | 'upload'

interface TransientImageWorkflow {
  name: string
  workflowJson: string
  runnableWorkflowJson: string | null
  runnable: boolean
  formatLabel: string
}

interface EntryPromptSeed {
  positive: string
  negative: string
  comfy: {
    seed: string
    steps: string
    cfg: string
    samplerName: string
    scheduler: string
  }
  nai: {
    model: string
    width: string
    height: string
    steps: string
    scale: string
    sampler: string
    seed: string
  }
}

function clampIndex(nextIndex: number, total: number): number {
  if (total <= 0) {
    return 0
  }

  return Math.min(Math.max(nextIndex, 0), total - 1)
}

function statusLabel(state: ComfyQueueState | null): string {
  if (state === 'queued') return '排队中'
  if (state === 'running') return '运行中'
  if (state === 'completed') return '已完成'
  if (state === 'failed') return '失败'
  if (state === 'not_found') return '未找到'
  return '未提交'
}

function readStoredObject<T extends Record<string, string>>(key: string, defaults: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? { ...defaults, ...(JSON.parse(saved) as Partial<T>) } : defaults
  } catch {
    return defaults
  }
}

function tryParseObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function isApiPromptPayload(payload: Record<string, unknown>): boolean {
  const values = Object.values(payload)
  return values.length > 0 && values.every((node) => {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return false
    }

    const record = node as Record<string, unknown>
    return typeof record.class_type === 'string' && typeof record.inputs === 'object' && record.inputs !== null
  })
}

function resolveImageWorkflowSource(entry: EntryDetail | null, image: EntryImageDetail | null): TransientImageWorkflow | null {
  if (!entry || !image) {
    return null
  }

  const aiJsonObject = tryParseObject(image.aiJson)
  const promptObject = tryParseObject(image.promptText)
  const imageLabel = `图 #${image.index + 1}`
  const baseName = `${entry.displayTitle} · ${imageLabel}`

  if (aiJsonObject && promptObject) {
    const promptRunnable = isApiPromptPayload(promptObject)
    return {
      name: `${baseName} Workflow`,
      workflowJson: image.aiJson,
      runnableWorkflowJson: promptRunnable ? image.promptText : null,
      runnable: promptRunnable,
      formatLabel: promptRunnable ? '图片内嵌 workflow + API prompt' : '图片内嵌 workflow + prompt 元数据',
    }
  }

  if (aiJsonObject) {
    const runnable = isApiPromptPayload(aiJsonObject)
    return {
      name: `${baseName} Workflow`,
      workflowJson: image.aiJson,
      runnableWorkflowJson: runnable ? image.aiJson : null,
      runnable,
      formatLabel: runnable ? '图片内嵌 API prompt' : '图片内嵌 UI workflow',
    }
  }

  if (promptObject) {
    const runnable = isApiPromptPayload(promptObject)
    return {
      name: `${baseName} Prompt`,
      workflowJson: image.promptText,
      runnableWorkflowJson: runnable ? image.promptText : null,
      runnable,
      formatLabel: runnable ? '图片内嵌 API prompt' : '图片内嵌 UI workflow',
    }
  }

  return null
}

function resolveTestingModeForEntryType(type?: EntryDetail['type']): TestingMode {
  return type === 'NAI' ? 'nai' : 'comfy'
}

function joinPromptParts(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join(', ')
}

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('文件读取失败。'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败。'))
    reader.readAsDataURL(file)
  })
}

async function buildPromptSeedFromEntry(entry: EntryDetail, image: EntryImageDetail): Promise<EntryPromptSeed> {
  if (entry.type === 'NAI') {
    const res = await window.api.parseNAI(image.promptText || image.aiJson)
    const parsed: ParsedNAIPrompt | null = res.data ?? null
    return {
      positive: parsed?.prompt ?? '',
      negative: parsed?.negativePrompt ?? '',
      comfy: {
        seed: parsed?.seed != null ? String(parsed.seed) : '-1',
        steps: parsed?.steps != null ? String(parsed.steps) : '28',
        cfg: parsed?.scale != null ? String(parsed.scale) : '7',
        samplerName: parsed?.sampler ?? 'euler',
        scheduler: 'normal',
      },
      nai: {
        model: parsed?.model ?? 'nai-diffusion-3',
        width: parsed?.width != null ? String(parsed.width) : '832',
        height: parsed?.height != null ? String(parsed.height) : '1216',
        steps: parsed?.steps != null ? String(parsed.steps) : '28',
        scale: parsed?.scale != null ? String(parsed.scale) : '7',
        sampler: parsed?.sampler ?? 'k_euler_ancestral',
        seed: parsed?.seed != null ? String(parsed.seed) : '-1',
      },
    }
  }

  if (entry.type === 'SD') {
    const res = await window.api.parseSD(image.promptText)
    const parsed: ParsedSDPrompt | null = res.data ?? null
    return {
      positive: parsed?.prompt ?? '',
      negative: parsed?.negativePrompt ?? '',
      comfy: {
        seed: parsed?.parameters.seed != null ? String(parsed.parameters.seed) : '-1',
        steps: parsed?.parameters.steps != null ? String(parsed.parameters.steps) : '28',
        cfg: parsed?.parameters.cfgScale != null ? String(parsed.parameters.cfgScale) : '7',
        samplerName: parsed?.parameters.sampler ?? 'euler',
        scheduler: 'normal',
      },
      nai: {
        model: 'nai-diffusion-3',
        width: parsed?.parameters.width != null ? String(parsed.parameters.width) : '832',
        height: parsed?.parameters.height != null ? String(parsed.parameters.height) : '1216',
        steps: parsed?.parameters.steps != null ? String(parsed.parameters.steps) : '28',
        scale: parsed?.parameters.cfgScale != null ? String(parsed.parameters.cfgScale) : '7',
        sampler: parsed?.parameters.sampler ?? 'k_euler_ancestral',
        seed: parsed?.parameters.seed != null ? String(parsed.parameters.seed) : '-1',
      },
    }
  }

  const res = await window.api.parseComfyUI(image.aiJson || image.promptText)
  const parsed: ParsedComfyUIPrompt | null = res.data ?? null
  const sampler = parsed?.samplers[0]
  return {
    positive: joinPromptParts(parsed?.prompts.positive ?? []),
    negative: joinPromptParts(parsed?.prompts.negative ?? []),
    comfy: {
      seed: sampler?.seed != null ? String(sampler.seed) : '-1',
      steps: sampler?.steps != null ? String(sampler.steps) : '28',
      cfg: sampler?.cfg != null ? String(sampler.cfg) : '7',
      samplerName: sampler?.sampler ?? 'euler',
      scheduler: sampler?.scheduler ?? 'normal',
    },
    nai: {
      model: 'nai-diffusion-3',
      width: parsed?.size.width != null ? String(parsed.size.width) : '832',
      height: parsed?.size.height != null ? String(parsed.size.height) : '1216',
      steps: sampler?.steps != null ? String(sampler.steps) : '28',
      scale: sampler?.cfg != null ? String(sampler.cfg) : '7',
      sampler: sampler?.sampler ?? 'k_euler_ancestral',
      seed: sampler?.seed != null ? String(sampler.seed) : '-1',
    },
  }
}

export function Testing() {
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'nai' ? 'nai' : 'comfy'
  const initialPromptSource = searchParams.get('promptSource') === 'anima'
    ? 'anima'
    : searchParams.get('promptSource') === 'spellbook'
      ? 'spellbook'
      : searchParams.get('promptSource') === 'preset'
        ? 'preset'
        : (searchParams.get('presetId') ? 'preset' : 'entry')
  const initialEntryId = searchParams.get('entryId') ?? ''
  const initialWorkflowId = searchParams.get('workflowId') ?? ''
  const initialPresetId = searchParams.get('presetId') ?? ''
  const initialSpellbookEntryId = searchParams.get('spellbookEntryId') ?? ''
  const initialAnimaArtistIds = (searchParams.get('animaArtistIds') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const initialImageIndex = Math.max(0, Number(searchParams.get('imageIndex') ?? '0') || 0)
  const modeFromQuery = searchParams.get('mode')

  const [testMode, setTestMode] = useState<TestingMode>(initialMode)
  const [promptSourceMode, setPromptSourceMode] = useState<PromptSourceMode>(initialPromptSource)
  const [entries, setEntries] = useState<EntryListItem[]>([])
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [presets, setPresets] = useState<PromptPresetSummary[]>([])
  const [selectedAnimaArtistIds] = useState<string[]>(initialAnimaArtistIds)
  const [selectedAnimaArtists, setSelectedAnimaArtists] = useState<AnimaArtistSummary[]>([])
  const [selectedSpellbookEntryId] = useState(initialSpellbookEntryId)
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntryId)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(initialWorkflowId)
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId)
  const [selectedSpellbookEntry, setSelectedSpellbookEntry] = useState<SpellbookEntryDetail | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<EntryDetail | null>(null)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<PromptPresetDetail | null>(null)
  const [currentExampleIndex, setCurrentExampleIndex] = useState(initialImageIndex)
  const [panelMode, setPanelMode] = useState<'generated' | 'example'>('example')
  const [currentGeneratedIndex, setCurrentGeneratedIndex] = useState(0)

  const [comfyConnection, setComfyConnection] = useState(() => readStoredObject(COMFY_STORAGE_KEY, DEFAULT_COMFY_CONNECTION))
  const [naiConnection, setNaiConnection] = useState(() => readStoredObject(NAI_STORAGE_KEY, DEFAULT_NAI_CONNECTION))

  const [positivePrompt, setPositivePrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [entryPromptSeed, setEntryPromptSeed] = useState<EntryPromptSeed | null>(null)

  const [seed, setSeed] = useState('-1')
  const [steps, setSteps] = useState('28')
  const [cfg, setCfg] = useState('7')
  const [samplerName, setSamplerName] = useState('euler')
  const [scheduler, setScheduler] = useState('normal')
  const [checkpoint, setCheckpoint] = useState('')

  const [naiModel, setNaiModel] = useState('nai-diffusion-3')
  const [naiAction, setNaiAction] = useState<'generate' | 'img2img'>('generate')
  const [naiWidth, setNaiWidth] = useState('832')
  const [naiHeight, setNaiHeight] = useState('1216')
  const [naiSteps, setNaiSteps] = useState('28')
  const [naiScale, setNaiScale] = useState('7')
  const [naiSampler, setNaiSampler] = useState('k_euler_ancestral')
  const [naiSeed, setNaiSeed] = useState('-1')
  const [naiStrength, setNaiStrength] = useState('0.65')
  const [naiNoise, setNaiNoise] = useState('0')
  const [naiCfgRescale, setNaiCfgRescale] = useState('0')
  const [naiSm, setNaiSm] = useState(true)
  const [naiSmDyn, setNaiSmDyn] = useState(true)
  const [naiQualityToggle, setNaiQualityToggle] = useState(true)
  const [naiImageSourceMode, setNaiImageSourceMode] = useState<NAIImageSourceMode>('source')
  const [uploadedNaiImageDataUrl, setUploadedNaiImageDataUrl] = useState<string | null>(null)
  const [uploadedNaiImageName, setUploadedNaiImageName] = useState('')

  const [connectionStatus, setConnectionStatus] = useState<ComfyConnectionResult | null>(null)
  const [submitResult, setSubmitResult] = useState<ComfySubmitResult | null>(null)
  const [queueStatus, setQueueStatus] = useState<ComfyQueueStatusResult | null>(null)
  const [naiConnectionStatus, setNaiConnectionStatus] = useState<NAIConnectionResult | null>(null)
  const [naiSubmitResult, setNaiSubmitResult] = useState<NAISubmitResult | null>(null)

  const [error, setError] = useState('')
  const [isBooting, setIsBooting] = useState(true)
  const [isLoadingPresetDetail, setIsLoadingPresetDetail] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    localStorage.setItem(COMFY_STORAGE_KEY, JSON.stringify(comfyConnection))
  }, [comfyConnection])

  useEffect(() => {
    localStorage.setItem(NAI_STORAGE_KEY, JSON.stringify(naiConnection))
  }, [naiConnection])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const [entryRes, workflowRes, presetRes] = await Promise.all([
          window.api.listEntries({
            page: 1,
            pageSize: 500,
            sortBy: 'updated_at',
            sortOrder: 'desc',
          }),
          window.api.listWorkflows(),
          window.api.listPromptPresets(),
        ])

        if (cancelled) {
          return
        }

        if (entryRes.success && entryRes.data) {
          setEntries(entryRes.data.items)
          if (initialPromptSource !== 'anima' && initialPromptSource !== 'spellbook' && !initialEntryId && entryRes.data.items[0]) {
            setSelectedEntryId(entryRes.data.items[0].id)
          }
        }

        if (workflowRes.success && workflowRes.data) {
          const workflowItems = workflowRes.data
          setWorkflows(workflowItems)
          if (!initialWorkflowId && workflowItems.length > 0) {
            const defaultWorkflow = workflowItems.find((item) => item.isDefaultTest)
            setSelectedWorkflowId(defaultWorkflow?.id ?? workflowItems[0].id)
          }
        }

        if (presetRes.success && presetRes.data) {
          setPresets(presetRes.data)
          if (!initialPresetId && presetRes.data[0]) {
            setSelectedPresetId(presetRes.data[0].id)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [initialEntryId, initialPresetId, initialPromptSource, initialWorkflowId])

  useEffect(() => {
    let cancelled = false

    async function loadEntry() {
      if (!selectedEntryId) {
        setSelectedEntry(null)
        return
      }

      const res = await window.api.getEntry(selectedEntryId)
      if (cancelled) {
        return
      }

      if (!res.success) {
        setError(res.error?.message ?? '条目详情加载失败。')
        return
      }

      const detail = res.data ?? null
      setSelectedEntry(detail)
      setCurrentExampleIndex(clampIndex(initialImageIndex, detail?.images.length ?? 0))
      setPanelMode('example')
      setSubmitResult(null)
      setQueueStatus(null)
      setNaiSubmitResult(null)
      setCurrentGeneratedIndex(0)

      if (detail?.workflowBinding?.preferredTestWorkflowId && !initialWorkflowId) {
        setSelectedWorkflowId(detail.workflowBinding.preferredTestWorkflowId)
      }

      if (!modeFromQuery && detail) {
        setTestMode(resolveTestingModeForEntryType(detail.type))
      }
    }

    void loadEntry().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })

    return () => {
      cancelled = true
    }
  }, [initialImageIndex, initialWorkflowId, modeFromQuery, selectedEntryId])

  useEffect(() => {
    let cancelled = false

    async function loadWorkflow() {
      if (!selectedWorkflowId) {
        setSelectedWorkflow(null)
        return
      }

      const res = await window.api.getWorkflow(selectedWorkflowId)
      if (cancelled) {
        return
      }

      if (!res.success) {
        setError(res.error?.message ?? '工作流详情加载失败。')
        return
      }

      setSelectedWorkflow(res.data ?? null)
    }

    void loadWorkflow().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedWorkflowId])

  useEffect(() => {
    let cancelled = false

    async function loadPreset() {
      if (!selectedPresetId) {
        setSelectedPreset(null)
        return
      }

      try {
        setIsLoadingPresetDetail(true)
        const res = await window.api.getPromptPreset(selectedPresetId)
        if (cancelled) {
          return
        }

        if (!res.success) {
          setError(res.error?.message ?? '预设详情加载失败。')
          return
        }

        setSelectedPreset(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPresetDetail(false)
        }
      }
    }

    void loadPreset()
    return () => {
      cancelled = true
    }
  }, [selectedPresetId])

  useEffect(() => {
    let cancelled = false

    async function loadAnimaArtists() {
      if (selectedAnimaArtistIds.length === 0) {
        setSelectedAnimaArtists([])
        return
      }

      try {
        const res = await window.api.listAnimaArtists({
          ids: selectedAnimaArtistIds,
          page: 1,
          pageSize: Math.max(selectedAnimaArtistIds.length, 1),
          sortBy: 'name',
          sortOrder: 'asc',
        })

        if (cancelled) {
          return
        }

        if (!res.success || !res.data) {
          setError(res.error?.message ?? '画师参考加载失败。')
          return
        }

        const byId = new Map(res.data.items.map((artist) => [artist.id, artist]))
        setSelectedAnimaArtists(selectedAnimaArtistIds.flatMap((id) => {
          const item = byId.get(id)
          return item ? [item] : []
        }))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    void loadAnimaArtists()
    return () => {
      cancelled = true
    }
  }, [selectedAnimaArtistIds])

  useEffect(() => {
    let cancelled = false

    async function loadSpellbookEntry() {
      if (!selectedSpellbookEntryId) {
        setSelectedSpellbookEntry(null)
        return
      }

      try {
        const res = await window.api.getSpellbookEntry(selectedSpellbookEntryId)
        if (cancelled) {
          return
        }

        if (!res.success) {
          setError(res.error?.message ?? '法典条目加载失败。')
          return
        }

        setSelectedSpellbookEntry(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    void loadSpellbookEntry()
    return () => {
      cancelled = true
    }
  }, [selectedSpellbookEntryId])

  const currentExampleImage = selectedEntry?.images[currentExampleIndex] ?? null
  const exampleImageSrc = currentExampleImage ? toImageSrc(currentExampleImage) : null
  const spellbookExampleImage = selectedSpellbookEntry?.images[0] ?? null
  const spellbookExampleImageSrc = spellbookExampleImage ? toImageSrc(spellbookExampleImage) : null
  const imageWorkflowSource = useMemo(
    () => resolveImageWorkflowSource(selectedEntry, currentExampleImage),
    [currentExampleImage, selectedEntry],
  )
  const selectedWorkflowSummary = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows],
  )
  const comfyGeneratedImages = queueStatus?.images.map((image, index) => ({
    index,
    src: image.url,
    label: `结果 #${index + 1}`,
  })) ?? []
  const naiGeneratedImages = naiSubmitResult?.images.map((image, index) => ({
    index,
    src: image.src,
    label: `结果 #${index + 1}`,
  })) ?? []
  const generatedImages = testMode === 'comfy' ? comfyGeneratedImages : naiGeneratedImages
  const currentGeneratedImage = generatedImages[currentGeneratedIndex] ?? null
  const promptSyntaxMode = testMode === 'nai' ? 'nai' : 'sd'

  useEffect(() => {
    if (!selectedEntry || !currentExampleImage) {
      setEntryPromptSeed(null)
      return
    }

    let cancelled = false
    void buildPromptSeedFromEntry(selectedEntry, currentExampleImage)
      .then((seedResult) => {
        if (cancelled) {
          return
        }

        setEntryPromptSeed(seedResult)
        setSeed(seedResult.comfy.seed)
        setSteps(seedResult.comfy.steps)
        setCfg(seedResult.comfy.cfg)
        setSamplerName(seedResult.comfy.samplerName)
        setScheduler(seedResult.comfy.scheduler)
        setNaiModel(seedResult.nai.model)
        setNaiWidth(seedResult.nai.width)
        setNaiHeight(seedResult.nai.height)
        setNaiSteps(seedResult.nai.steps)
        setNaiScale(seedResult.nai.scale)
        setNaiSampler(seedResult.nai.sampler)
        setNaiSeed(seedResult.nai.seed)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentExampleImage, selectedEntry])

  useEffect(() => {
    if (promptSourceMode === 'preset') {
      setPositivePrompt(formatPromptPresetText(selectedPreset?.positiveSections ?? [], promptSyntaxMode))
      setNegativePrompt(formatPromptPresetText(selectedPreset?.negativeSections ?? [], promptSyntaxMode))
      if (!modeFromQuery && selectedPreset) {
        setTestMode(resolveTestingModeForEntryType(selectedPreset.sourcePromptType))
      }
      return
    }

    if (promptSourceMode === 'anima') {
      setPositivePrompt(selectedAnimaArtists.map((artist) => artist.name).join(', '))
      setNegativePrompt('')
      return
    }

    if (promptSourceMode === 'spellbook') {
      setPositivePrompt(selectedSpellbookEntry?.promptText ?? selectedSpellbookEntry?.promptCandidates.join('\n\n') ?? '')
      setNegativePrompt('')
      if (!modeFromQuery && selectedSpellbookEntry) {
        const prefersNai = selectedSpellbookEntry.modelHints.some((hint) => hint.includes('NAI'))
        setTestMode(prefersNai ? 'nai' : 'comfy')
      }
      return
    }

    setPositivePrompt(entryPromptSeed?.positive ?? '')
    setNegativePrompt(entryPromptSeed?.negative ?? '')
  }, [entryPromptSeed, modeFromQuery, promptSourceMode, promptSyntaxMode, selectedAnimaArtists, selectedPreset, selectedSpellbookEntry])

  useEffect(() => {
    setCurrentGeneratedIndex((prev) => clampIndex(prev, generatedImages.length))
  }, [generatedImages.length])

  const handleTestConnection = async () => {
    try {
      setIsTestingConnection(true)
      setError('')

      if (testMode === 'comfy') {
        const res = await window.api.testComfyConnection(comfyConnection)
        if (res.success && res.data) {
          setConnectionStatus(res.data)
        } else {
          setConnectionStatus(null)
          setError(res.error?.message ?? '连接失败')
        }
      } else {
        const res = await window.api.testNaiConnection(naiConnection)
        if (res.success && res.data) {
          setNaiConnectionStatus(res.data)
        } else {
          setNaiConnectionStatus(null)
          setError(res.error?.message ?? '连接失败')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsTestingConnection(false)
    }
  }

  const refreshQueueStatus = useCallback(async (manual = true) => {
    if (!submitResult?.promptId) {
      return
    }

    try {
      if (manual) {
        setIsRefreshingStatus(true)
      }

      const res = await window.api.getComfyQueueStatus({
        connection: comfyConnection,
        promptId: submitResult.promptId,
      })

      if (res.success && res.data) {
        setQueueStatus(res.data)
        if (res.data.state === 'completed' && res.data.images.length > 0) {
          setPanelMode('generated')
          setCurrentGeneratedIndex(0)
        }
      } else if (manual) {
        setError(res.error?.message ?? '无法刷新任务状态')
      }
    } catch (err) {
      if (manual) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (manual) {
        setIsRefreshingStatus(false)
      }
    }
  }, [comfyConnection, submitResult?.promptId])

  useEffect(() => {
    if (testMode !== 'comfy' || !submitResult?.promptId) {
      return
    }

    const state = queueStatus?.state ?? null
    if (state && !['queued', 'running'].includes(state)) {
      return
    }

    const timer = window.setTimeout(() => {
      void refreshQueueStatus(false)
    }, 3000)

    return () => window.clearTimeout(timer)
  }, [queueStatus?.state, refreshQueueStatus, submitResult?.promptId, testMode])

  const handleSubmitComfy = async () => {
    const workflowSource = imageWorkflowSource?.runnable
      ? {
          workflowId: undefined,
          transientWorkflow: {
            name: imageWorkflowSource.name,
            workflowJson: imageWorkflowSource.workflowJson,
            runnableWorkflowJson: imageWorkflowSource.runnableWorkflowJson,
          },
        }
      : selectedWorkflow?.runnable
        ? {
            workflowId: selectedWorkflow.id,
            transientWorkflow: undefined,
          }
        : null

    if (!workflowSource) {
      setError(imageWorkflowSource ? '当前图片的内嵌 workflow 不可执行，请改用工作流库中的可执行工作流。' : '请先选择可执行的工作流。')
      return
    }

    if (!positivePrompt.trim()) {
      setError('请填写正向提示词。')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')
      setQueueStatus(null)
      setNaiSubmitResult(null)

      const res = await window.api.submitComfyPrompt({
        connection: comfyConnection,
        workflowId: workflowSource.workflowId,
        entryId: selectedEntryId || undefined,
        imageIndex: currentExampleImage?.index ?? null,
        transientWorkflow: workflowSource.transientWorkflow,
        overrides: {
          positivePrompt,
          negativePrompt,
          seed: seed.trim() ? Number(seed) : undefined,
          steps: steps.trim() ? Number(steps) : undefined,
          cfg: cfg.trim() ? Number(cfg) : undefined,
          samplerName: samplerName.trim() || undefined,
          scheduler: scheduler.trim() || undefined,
          checkpoint: checkpoint.trim() || undefined,
        },
      })

      if (res.success && res.data) {
        setSubmitResult(res.data)
        setQueueStatus({
          promptId: res.data.promptId,
          state: 'queued',
          queueRunning: connectionStatus?.queueRunning ?? 0,
          queuePending: connectionStatus?.queuePending ?? 0,
          completed: false,
          images: [],
          errorMessage: null,
          normalizedBaseUrl: res.data.normalizedBaseUrl,
        })
      } else {
        setError(res.error?.message ?? '提交失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitNai = async () => {
    if (!positivePrompt.trim()) {
      setError('请填写正向提示词。')
      return
    }

    const sourceImage =
      naiImageSourceMode === 'upload'
        ? { dataUrl: uploadedNaiImageDataUrl }
        : promptSourceMode === 'preset'
          ? { localPath: selectedPreset?.referenceImage.localPath ?? null }
          : promptSourceMode === 'anima'
            ? { localPath: null }
          : promptSourceMode === 'spellbook'
            ? { localPath: selectedSpellbookEntry?.images[0]?.localPath ?? null }
          : { localPath: currentExampleImage?.localPath ?? null }

    try {
      setIsSubmitting(true)
      setError('')
      setSubmitResult(null)
      setQueueStatus(null)

      const res = await window.api.submitNaiGeneration({
        connection: naiConnection,
        prompt: positivePrompt,
        negativePrompt,
        model: naiModel,
        action: naiAction,
        entryId: selectedEntryId || undefined,
        imageIndex: currentExampleImage?.index ?? null,
        presetId: selectedPresetId || null,
        referenceImage: naiAction === 'img2img' ? sourceImage : undefined,
        parameters: {
          width: Number(naiWidth) || 832,
          height: Number(naiHeight) || 1216,
          steps: Number(naiSteps) || 28,
          scale: Number(naiScale) || 7,
          sampler: naiSampler.trim() || 'k_euler_ancestral',
          seed: naiSeed.trim() ? Number(naiSeed) : undefined,
          strength: naiAction === 'img2img' ? Number(naiStrength) || 0.65 : undefined,
          noise: naiAction === 'img2img' ? Number(naiNoise) || 0 : undefined,
          cfgRescale: naiCfgRescale.trim() ? Number(naiCfgRescale) : undefined,
          sm: naiSm,
          smDyn: naiSmDyn,
          qualityToggle: naiQualityToggle,
        },
      })

      if (res.success && res.data) {
        setNaiSubmitResult(res.data)
        setPanelMode('generated')
        setCurrentGeneratedIndex(0)
      } else {
        setError(res.error?.message ?? 'NovelAI 生成失败。')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!submitResult?.promptId) {
      return
    }

    try {
      setIsCancelling(true)
      const res = await window.api.cancelComfyTask({
        connection: comfyConnection,
        promptId: submitResult.promptId,
      })
      if (res.success && res.data?.interrupted) {
        setQueueStatus((prev) => (prev ? { ...prev, state: 'failed', errorMessage: '任务已中断。' } : prev))
      } else {
        setError(res.error?.message ?? '中断任务失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCancelling(false)
    }
  }

  const handleNaiImageUpload = async (file: File | null) => {
    if (!file) {
      setUploadedNaiImageDataUrl(null)
      setUploadedNaiImageName('')
      return
    }

    try {
      const dataUrl = await dataUrlFromFile(file)
      setUploadedNaiImageDataUrl(dataUrl)
      setUploadedNaiImageName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (isBooting) {
    return <div className={styles.loadingState}>正在准备双模式测试台...</div>
  }

  return (
    <div className={styles.testingPage}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>PHASE 6 · WORKFLOW + PRESET TEST LAB</p>
          <h1 className={styles.title}>测试工作台</h1>
        </div>
        <div className={styles.modeSwitch}>
          <button className={testMode === 'comfy' ? styles.modeButtonActive : styles.modeButton} onClick={() => setTestMode('comfy')}>
            ComfyUI
          </button>
          <button className={testMode === 'nai' ? styles.modeButtonActive : styles.modeButton} onClick={() => setTestMode('nai')}>
            NovelAI
          </button>
        </div>
      </header>

      <section className={styles.connectionCard}>
        {testMode === 'comfy' ? (
          <div className={styles.connectionFields}>
            <label className={styles.field}>
              <span>Comfy Base URL</span>
              <input value={comfyConnection.baseUrl} onChange={(e) => setComfyConnection((prev) => ({ ...prev, baseUrl: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>History Route</span>
              <input value={comfyConnection.historyRoute} onChange={(e) => setComfyConnection((prev) => ({ ...prev, historyRoute: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>Client ID</span>
              <input value={comfyConnection.clientId} onChange={(e) => setComfyConnection((prev) => ({ ...prev, clientId: e.target.value }))} />
            </label>
          </div>
        ) : (
          <div className={styles.connectionFields}>
            <label className={styles.field}>
              <span>NovelAI Endpoint</span>
              <input value={naiConnection.baseUrl} onChange={(e) => setNaiConnection((prev) => ({ ...prev, baseUrl: e.target.value }))} />
            </label>
            <label className={styles.field}>
              <span>API Key</span>
              <input value={naiConnection.apiKey} onChange={(e) => setNaiConnection((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder="Bearer API Key" />
            </label>
          </div>
        )}
        <button className={styles.primaryButton} onClick={() => void handleTestConnection()} disabled={isTestingConnection}>
          {isTestingConnection ? '检测中...' : '测试连接'}
        </button>
      </section>

      {testMode === 'comfy' && connectionStatus && (
        <section className={styles.connectionSummary}>
          <div><strong>已连接：</strong>{connectionStatus.normalizedBaseUrl}</div>
          <div>Queue: {connectionStatus.queueRunning} running / {connectionStatus.queuePending} pending</div>
          <div>ComfyUI: {connectionStatus.system.comfyuiVersion ?? '未知版本'}</div>
          <div>Device: {connectionStatus.device?.name ?? '未知设备'}</div>
        </section>
      )}

      {testMode === 'nai' && naiConnectionStatus && (
        <section className={styles.connectionSummary}>
          <div><strong>已连接：</strong>{naiConnectionStatus.normalizedBaseUrl}</div>
          <div>账户：{naiConnectionStatus.accountEmail ?? '未返回邮箱'}</div>
          <div>Tier: {naiConnectionStatus.tier ?? '未知'}</div>
          <div>无限图生成功能：{naiConnectionStatus.perksUnlimitedImageGeneration == null ? '未知' : naiConnectionStatus.perksUnlimitedImageGeneration ? '是' : '否'}</div>
        </section>
      )}

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>提示词来源</div>
            <div className={styles.segmented}>
              <button className={promptSourceMode === 'entry' ? styles.segmentActive : styles.segment} onClick={() => setPromptSourceMode('entry')}>
                当前图
              </button>
              <button className={promptSourceMode === 'preset' ? styles.segmentActive : styles.segment} onClick={() => setPromptSourceMode('preset')}>
                提示词预设
              </button>
              <button className={promptSourceMode === 'anima' ? styles.segmentActive : styles.segment} onClick={() => setPromptSourceMode('anima')}>
                画师参考
              </button>
              <button className={promptSourceMode === 'spellbook' ? styles.segmentActive : styles.segment} onClick={() => setPromptSourceMode('spellbook')}>
                法典库
              </button>
            </div>

            {promptSourceMode === 'entry' && (
              <label className={styles.field}>
                <span>条目</span>
                <select value={selectedEntryId} onChange={(e) => setSelectedEntryId(e.target.value)}>
                  <option value="">不关联条目</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.displayTitle} · {entry.type}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {promptSourceMode === 'preset' && (
              <label className={styles.field}>
                <span>提示词预设</span>
                <select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
                  <option value="">选择预设</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name} · {preset.sourceEntryTitle}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedEntry && selectedEntry.images.length > 0 && (
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>当前图片</div>
                <div className={styles.navigatorRow}>
                  <button className={styles.secondaryButton} onClick={() => setCurrentExampleIndex((prev) => clampIndex(prev - 1, selectedEntry.images.length))} disabled={currentExampleIndex <= 0}>
                    ← 上一张
                  </button>
                  <div className={styles.navigatorMeta}>#{(currentExampleImage?.index ?? currentExampleIndex) + 1} / {selectedEntry.images.length}</div>
                  <button className={styles.secondaryButton} onClick={() => setCurrentExampleIndex((prev) => clampIndex(prev + 1, selectedEntry.images.length))} disabled={currentExampleIndex >= selectedEntry.images.length - 1}>
                    下一张 →
                  </button>
                </div>
              </div>
            )}

            {promptSourceMode === 'preset' && (
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>当前预设</div>
                <div className={styles.metaValue}>{selectedPreset?.name ?? (isLoadingPresetDetail ? '加载中...' : '未选择')}</div>
                {selectedPreset && (
                  <div className={styles.metaSub}>{selectedPreset.sourceEntryTitle} · 图 {selectedPreset.sourceImageIndex + 1}</div>
                )}
              </div>
            )}

            {promptSourceMode === 'anima' && (
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>当前画师串</div>
                <div className={styles.metaValue}>
                  {selectedAnimaArtists.length > 0 ? `${selectedAnimaArtists.length} 位画师` : '未选择画师'}
                </div>
                {selectedAnimaArtists.length > 0 && (
                  <div className={styles.metaSub}>{selectedAnimaArtists.map((artist) => artist.name).join(', ')}</div>
                )}
              </div>
            )}

            {promptSourceMode === 'spellbook' && (
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>当前法典条目</div>
                <div className={styles.metaValue}>{selectedSpellbookEntry?.title ?? '未选择条目'}</div>
                {selectedSpellbookEntry && (
                  <div className={styles.metaSub}>
                    {selectedSpellbookEntry.category} · {selectedSpellbookEntry.modelHints.join(' / ') || '未标注模型'}
                  </div>
                )}
              </div>
            )}

            {testMode === 'comfy' && (
              <>
                <label className={styles.field}>
                  <span>回退工作流</span>
                  <select value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)}>
                    <option value="">选择工作流</option>
                    {workflows.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name} · {workflow.runnable ? '可执行' : '仅查看'}
                      </option>
                    ))}
                  </select>
                </label>

                <div className={styles.metaCard}>
                  <div className={styles.metaLabel}>工作流来源</div>
                  {imageWorkflowSource?.runnable ? (
                    <>
                      <div className={styles.metaValue}>{imageWorkflowSource.formatLabel}</div>
                      <div className={styles.metaSub}>优先使用当前图片内嵌的可执行 workflow。</div>
                    </>
                  ) : selectedWorkflowSummary ? (
                    <>
                      <div className={styles.metaValue}>{selectedWorkflowSummary.name}</div>
                      <div className={styles.metaSub}>
                        {selectedWorkflowSummary.format} · {selectedWorkflowSummary.nodeCount} nodes · {selectedWorkflowSummary.runnable ? '可执行' : '仅查看'}
                      </div>
                    </>
                  ) : (
                    <div className={styles.metaSub}>当前没有可执行的工作流来源。</div>
                  )}

                  {imageWorkflowSource && !imageWorkflowSource.runnable && (
                    <div className={styles.warningBox}>当前图片内嵌的是不可执行 workflow，提交时将回退到工作流库所选项。</div>
                  )}
                  {selectedWorkflow && !selectedWorkflow.runnable && (
                    <div className={styles.warningBox}>{selectedWorkflow.nonRunnableReason ?? '当前回退工作流不可执行。'}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        <section className={styles.editorPanel}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>来源预览</div>
              {currentExampleImage && <div className={styles.inlineBadge}>图 #{currentExampleImage.index + 1}</div>}
            </div>

            {promptSourceMode === 'anima' ? (
              <div className={styles.metaCard}>
                <div className={styles.metaLabel}>画师参考来源</div>
                <div className={styles.metaValue}>
                  {selectedAnimaArtists.length > 0 ? `${selectedAnimaArtists.length} 位画师已注入正向提示词` : '未选择画师'}
                </div>
                {selectedAnimaArtists.length > 0 && (
                  <div className={styles.metaSub}>{selectedAnimaArtists.map((artist) => artist.name).join(', ')}</div>
                )}
              </div>
            ) : promptSourceMode === 'spellbook' ? (
              spellbookExampleImage ? (
                <>
                  <div className={styles.focusImageCard}>
                    {spellbookExampleImageSrc ? (
                      <img src={spellbookExampleImageSrc} alt={selectedSpellbookEntry?.title ?? 'spellbook-example'} className={styles.focusImage} />
                    ) : (
                      <div className={styles.imagePlaceholder}>No Preview</div>
                    )}
                  </div>
                  <div className={styles.captionRow}>
                    <span>{selectedSpellbookEntry?.title ?? '法典条目'}</span>
                    <span>本地缓存示例图 · 共 {selectedSpellbookEntry?.images.length ?? 0} 张</span>
                  </div>
                </>
              ) : (
                <div className={styles.metaCard}>
                  <div className={styles.metaLabel}>法典来源</div>
                  <div className={styles.metaValue}>
                    {selectedSpellbookEntry?.title ?? '未选择法典条目'}
                  </div>
                  {selectedSpellbookEntry && (
                    <>
                      <div className={styles.metaSub}>
                        {selectedSpellbookEntry.promptCandidates.length > 0
                          ? `${selectedSpellbookEntry.promptCandidates.length} 段候选提示词已缓存到本地`
                          : '当前条目暂无可提取提示词'}
                      </div>
                      {selectedSpellbookEntry.images.length > 0 && (
                        <div className={styles.metaSub}>已缓存 {selectedSpellbookEntry.images.length} 张本地示例图</div>
                      )}
                    </>
                  )}
                </div>
              )
            ) : !currentExampleImage ? (
              <div className={styles.emptyPanel}>当前条目没有可用图片。</div>
            ) : (
              <>
                <div className={styles.focusImageCard}>
                  {exampleImageSrc ? (
                    <img src={exampleImageSrc} alt={`example-${currentExampleImage.index + 1}`} className={styles.focusImage} />
                  ) : (
                    <div className={styles.imagePlaceholder}>No Preview</div>
                  )}
                </div>
                <div className={styles.captionRow}>
                  <span>{promptSourceMode === 'preset' ? '当前图只提供参考画面，提示词来自预设。' : '当前图的提示词与参数会用于预填。'}</span>
                  <span>{currentExampleImage.originalUrl ? '已关联原始图片地址' : '无原始图片地址'}</span>
                </div>
              </>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>提示词编辑</div>
            <div className={styles.syntaxChip}>当前语法：{testMode === 'nai' ? 'NAI' : 'ComfyUI / SD'}</div>
            <label className={styles.field}>
              <span>正向提示词</span>
              <textarea value={positivePrompt} onChange={(e) => setPositivePrompt(e.target.value)} rows={8} />
            </label>
            <label className={styles.field}>
              <span>负向提示词</span>
              <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} rows={5} />
            </label>
          </div>

          {testMode === 'comfy' ? (
            <div className={styles.panel}>
              <div className={styles.panelTitle}>ComfyUI 覆盖参数</div>
              <div className={styles.overrideGrid}>
                <label className={styles.field}><span>Seed</span><input value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
                <label className={styles.field}><span>Steps</span><input value={steps} onChange={(e) => setSteps(e.target.value)} /></label>
                <label className={styles.field}><span>CFG</span><input value={cfg} onChange={(e) => setCfg(e.target.value)} /></label>
                <label className={styles.field}><span>Sampler</span><input value={samplerName} onChange={(e) => setSamplerName(e.target.value)} /></label>
                <label className={styles.field}><span>Scheduler</span><input value={scheduler} onChange={(e) => setScheduler(e.target.value)} /></label>
                <label className={styles.field}><span>Checkpoint</span><input value={checkpoint} onChange={(e) => setCheckpoint(e.target.value)} /></label>
              </div>
            </div>
          ) : (
            <div className={styles.panel}>
              <div className={styles.panelTitle}>NovelAI 参数</div>
              <div className={styles.overrideGrid}>
                <label className={styles.field}>
                  <span>Model</span>
                  <select value={naiModel} onChange={(e) => setNaiModel(e.target.value)}>
                    {NAI_MODELS.map((model) => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>模式</span>
                  <select value={naiAction} onChange={(e) => setNaiAction(e.target.value as 'generate' | 'img2img')}>
                    <option value="generate">文生图</option>
                    <option value="img2img">图生图</option>
                  </select>
                </label>
                <label className={styles.field}><span>Width</span><input value={naiWidth} onChange={(e) => setNaiWidth(e.target.value)} /></label>
                <label className={styles.field}><span>Height</span><input value={naiHeight} onChange={(e) => setNaiHeight(e.target.value)} /></label>
                <label className={styles.field}><span>Steps</span><input value={naiSteps} onChange={(e) => setNaiSteps(e.target.value)} /></label>
                <label className={styles.field}><span>Scale</span><input value={naiScale} onChange={(e) => setNaiScale(e.target.value)} /></label>
                <label className={styles.field}><span>Sampler</span><input value={naiSampler} onChange={(e) => setNaiSampler(e.target.value)} /></label>
                <label className={styles.field}><span>Seed</span><input value={naiSeed} onChange={(e) => setNaiSeed(e.target.value)} /></label>
                <label className={styles.field}><span>CFG Rescale</span><input value={naiCfgRescale} onChange={(e) => setNaiCfgRescale(e.target.value)} /></label>
              </div>

              {naiAction === 'img2img' && (
                <div className={styles.subPanel}>
                  <div className={styles.panelTitle}>Img2Img 参考图</div>
                  <div className={styles.segmented}>
                    <button className={naiImageSourceMode === 'source' ? styles.segmentActive : styles.segment} onClick={() => setNaiImageSourceMode('source')}>
                      使用来源图
                    </button>
                    <button className={naiImageSourceMode === 'upload' ? styles.segmentActive : styles.segment} onClick={() => setNaiImageSourceMode('upload')}>
                      上传图片
                    </button>
                  </div>
                  <div className={styles.overrideGrid}>
                    <label className={styles.field}><span>Strength</span><input value={naiStrength} onChange={(e) => setNaiStrength(e.target.value)} /></label>
                    <label className={styles.field}><span>Noise</span><input value={naiNoise} onChange={(e) => setNaiNoise(e.target.value)} /></label>
                  </div>
                  {naiImageSourceMode === 'upload' ? (
                    <label className={styles.field}>
                      <span>上传图片</span>
                      <input type="file" accept="image/*" onChange={(e) => void handleNaiImageUpload(e.target.files?.[0] ?? null)} />
                      {uploadedNaiImageName && <div className={styles.metaSub}>当前文件：{uploadedNaiImageName}</div>}
                    </label>
                  ) : (
                    <div className={styles.metaSub}>
                      {promptSourceMode === 'preset'
                        ? selectedPreset?.referenceImage.localPath
                          ? '将使用预设参考图作为 img2img 输入。'
                          : '当前预设没有本地参考图，请改用上传图片。'
                        : promptSourceMode === 'anima'
                          ? '画师参考模式没有来源图，请改用上传图片。'
                        : promptSourceMode === 'spellbook'
                          ? selectedSpellbookEntry?.images[0]?.localPath
                            ? '将使用法典缓存的首张示例图作为 img2img 输入。'
                            : '当前法典条目没有本地示例图，请改用上传图片。'
                        : currentExampleImage?.localPath
                          ? '将使用当前图片缓存作为 img2img 输入。'
                          : '当前图片没有本地缓存，请改用上传图片。'}
                    </div>
                  )}
                </div>
              )}

              <div className={styles.checkboxRow}>
                <label><input type="checkbox" checked={naiSm} onChange={(e) => setNaiSm(e.target.checked)} /> SMEA</label>
                <label><input type="checkbox" checked={naiSmDyn} onChange={(e) => setNaiSmDyn(e.target.checked)} /> SMEA DYN</label>
                <label><input type="checkbox" checked={naiQualityToggle} onChange={(e) => setNaiQualityToggle(e.target.checked)} /> Quality Toggle</label>
              </div>
            </div>
          )}

          <div className={styles.actionBar}>
            <button className={styles.primaryButton} onClick={() => void (testMode === 'comfy' ? handleSubmitComfy() : handleSubmitNai())} disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : testMode === 'comfy' ? '提交到 ComfyUI' : '提交到 NovelAI'}
            </button>
            {testMode === 'comfy' && (
              <>
                <button className={styles.secondaryButton} onClick={() => void refreshQueueStatus()} disabled={!submitResult?.promptId || isRefreshingStatus}>
                  {isRefreshingStatus ? '刷新中...' : '刷新状态'}
                </button>
                <button className={styles.secondaryButton} onClick={() => void handleCancel()} disabled={!submitResult?.promptId || isCancelling}>
                  {isCancelling ? '中断中...' : '中断当前运行'}
                </button>
              </>
            )}
          </div>
        </section>

        <aside className={styles.resultsPanel}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>运行状态</div>
            {testMode === 'comfy' ? (
              <div className={styles.statusHero}>
                <div className={styles.statusValue}>{statusLabel(queueStatus?.state ?? null)}</div>
                <div className={styles.statusMeta}>Prompt ID: {submitResult?.promptId ?? '尚未提交'}</div>
                <div className={styles.statusMeta}>来源图片: {submitResult?.imageIndex != null ? `#${submitResult.imageIndex + 1}` : '未指定'}</div>
                <div className={styles.statusMeta}>Running {queueStatus?.queueRunning ?? 0} · Pending {queueStatus?.queuePending ?? 0}</div>
                {queueStatus?.errorMessage && <div className={styles.errorInline}>{queueStatus.errorMessage}</div>}
              </div>
            ) : (
              <div className={styles.statusHero}>
                <div className={styles.statusValue}>{naiSubmitResult ? '已完成' : '未提交'}</div>
                <div className={styles.statusMeta}>Request ID: {naiSubmitResult?.requestId ?? '尚未提交'}</div>
                <div className={styles.statusMeta}>模型: {naiSubmitResult?.model ?? naiModel}</div>
                <div className={styles.statusMeta}>模式: {naiSubmitResult?.action === 'img2img' ? '图生图' : '文生图'}</div>
                {naiSubmitResult && <div className={styles.statusMeta}>耗时: {naiSubmitResult.elapsedMs} ms</div>}
              </div>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>图像面板</div>
              <div className={styles.segmented}>
                <button className={panelMode === 'generated' ? styles.segmentActive : styles.segment} onClick={() => setPanelMode('generated')}>
                  生成结果
                </button>
                <button className={panelMode === 'example' ? styles.segmentActive : styles.segment} onClick={() => setPanelMode('example')}>
                  来源示例
                </button>
              </div>
            </div>

            {panelMode === 'generated' ? (
              !currentGeneratedImage ? (
                <div className={styles.emptyPanel}>当前还没有可显示的生成结果。</div>
              ) : (
                <>
                  <div className={styles.focusImageCard}>
                    <img src={currentGeneratedImage.src} alt={currentGeneratedImage.label} className={styles.focusImage} />
                  </div>
                  <div className={styles.navigatorRow}>
                    <button className={styles.secondaryButton} onClick={() => setCurrentGeneratedIndex((prev) => clampIndex(prev - 1, generatedImages.length))} disabled={currentGeneratedIndex <= 0}>
                      ← 上一张
                    </button>
                    <div className={styles.navigatorMeta}>{currentGeneratedImage.label} / 共 {generatedImages.length} 张</div>
                    <button className={styles.secondaryButton} onClick={() => setCurrentGeneratedIndex((prev) => clampIndex(prev + 1, generatedImages.length))} disabled={currentGeneratedIndex >= generatedImages.length - 1}>
                      下一张 →
                    </button>
                  </div>
                </>
              )
            ) : promptSourceMode === 'spellbook' ? (
              !spellbookExampleImage ? (
                <div className={styles.emptyPanel}>当前法典条目还没有可显示的本地示例图片。</div>
              ) : (
                <>
                  <div className={styles.focusImageCard}>
                    {spellbookExampleImageSrc ? (
                      <img src={spellbookExampleImageSrc} alt={selectedSpellbookEntry?.title ?? 'spellbook-example'} className={styles.focusImage} />
                    ) : (
                      <div className={styles.imagePlaceholder}>No Preview</div>
                    )}
                  </div>
                  <div className={styles.captionRow}>
                    <span>{selectedSpellbookEntry?.title ?? '法典条目'}</span>
                    <span>提示词来自法典库</span>
                  </div>
                </>
              )
            ) : !currentExampleImage ? (
              <div className={styles.emptyPanel}>当前条目还没有可显示的示例图片。</div>
            ) : (
              <>
                <div className={styles.focusImageCard}>
                  {exampleImageSrc ? (
                    <img src={exampleImageSrc} alt={`example-${currentExampleImage.index + 1}`} className={styles.focusImage} />
                  ) : (
                    <div className={styles.imagePlaceholder}>No Preview</div>
                  )}
                </div>
                <div className={styles.captionRow}>
                  <span>示例图 #{currentExampleImage.index + 1}</span>
                  <span>
                    {promptSourceMode === 'preset'
                      ? '提示词来自预设库'
                      : promptSourceMode === 'anima'
                        ? '提示词来自画师参考页'
                        : imageWorkflowSource?.formatLabel ?? selectedWorkflowSummary?.name ?? '当前图'}
                  </span>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
