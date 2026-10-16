import type { CivitaiConfigSummary } from '@shared/types/civitai'
import type { ImageCacheCleanupMode, ImageCacheCleanupResult, ImageCacheStatus } from '@shared/types/image-cache'
import type {
  LLMAdvancedSettings,
  LLMConnectionTestResult,
  LLMModelConfigInput,
  LLMModelConfigSummary,
  LLMModelDescriptor,
  LLMProvider,
} from '@shared/types/llm'
import type {
  RemoteModelIndexItem,
  RemoteModelScanProgress,
  RemoteProfileInput,
  RemoteProfileSummary,
} from '@shared/types/remote'
import type { StorageInfo, StorageLocationKey } from '@shared/types/storage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TemplateEditor } from '../../components/template/TemplateEditor'
import styles from './Settings.module.css'

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(value: string | null): string {
  if (!value) {
    return '尚未扫描'
  }

  return new Date(value).toLocaleString('zh-CN')
}

function createEmptyProfile(isDefault: boolean): RemoteProfileInput {
  return {
    name: 'SeetaCloud ComfyUI',
    comfyBaseUrl: 'https://u779173-pgwa-9aaa58e3.westd.seetacloud.com:8443',
    comfyHistoryRoute: '/history',
    sshHost: 'connect.westd.seetacloud.com',
    sshPort: 25764,
    sshUser: 'root',
    sshPassword: '',
    comfyRootPath: '/root/autodl-tmp/ComfyUI',
    lorasPaths: ['models/loras', 'models/lycoris', 'models/checkpoints'],
    isDefault,
  }
}

function profileToForm(profile: RemoteProfileSummary): RemoteProfileInput {
  return {
    id: profile.id,
    name: profile.name,
    comfyBaseUrl: profile.comfyBaseUrl,
    comfyHistoryRoute: profile.comfyHistoryRoute,
    sshHost: profile.sshHost ?? '',
    sshPort: profile.sshPort,
    sshUser: profile.sshUser ?? '',
    sshPassword: '',
    comfyRootPath: profile.comfyRootPath ?? '',
    lorasPaths: profile.lorasPaths,
    isDefault: profile.isDefault,
  }
}

function getKindLabel(kind: RemoteModelIndexItem['kind']): string {
  if (kind === 'checkpoint') return 'Checkpoint'
  if (kind === 'vae') return 'VAE'
  return 'LoRA'
}

const LLM_PROVIDER_PRESETS: Record<LLMProvider, {
  label: string
  endpoint: string
  defaultModelName: string
  defaultTemperature: number
  defaultAdvanced: LLMAdvancedSettings
}> = {
  openai: {
    label: 'OpenAI Compatible',
    endpoint: 'https://api.openai.com/v1',
    defaultModelName: 'gpt-5.4-mini',
    defaultTemperature: 0.2,
    defaultAdvanced: {
      strictJsonMode: true,
      maxTokens: 8192,
      thinkingEnabled: false,
    },
  },
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com',
    defaultModelName: 'deepseek-v4-flash',
    defaultTemperature: 0.2,
    defaultAdvanced: {
      strictJsonMode: true,
      maxTokens: 8192,
      thinkingEnabled: false,
    },
  },
  qwen: {
    label: 'Qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModelName: 'qwen-plus',
    defaultTemperature: 0.2,
    defaultAdvanced: {
      strictJsonMode: true,
      maxTokens: 8192,
      thinkingEnabled: false,
    },
  },
  glm: {
    label: 'GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModelName: 'glm-4.5',
    defaultTemperature: 0.2,
    defaultAdvanced: {
      strictJsonMode: true,
      maxTokens: 8192,
      thinkingEnabled: false,
    },
  },
  ollama: {
    label: 'Ollama',
    endpoint: 'http://127.0.0.1:11434/v1',
    defaultModelName: 'qwen2.5:7b',
    defaultTemperature: 0.2,
    defaultAdvanced: {
      strictJsonMode: true,
      maxTokens: 8192,
      thinkingEnabled: false,
    },
  },
}

function cloneAdvancedSettings(value: LLMAdvancedSettings): LLMAdvancedSettings {
  return {
    strictJsonMode: value.strictJsonMode,
    maxTokens: value.maxTokens,
    thinkingEnabled: value.thinkingEnabled,
  }
}

function buildPreferredModel(provider: LLMProvider, models: LLMModelDescriptor[], currentModel: string): string {
  if (currentModel && models.some((item) => item.id === currentModel)) {
    return currentModel
  }

  const preferredIds =
    provider === 'deepseek'
      ? ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner']
      : [LLM_PROVIDER_PRESETS[provider].defaultModelName]

  const preferred = preferredIds.find((id) => models.some((item) => item.id === id))
  if (preferred) {
    return preferred
  }

  return models[0]?.id ?? ''
}

function ensureModelOption(models: LLMModelDescriptor[], modelName: string): LLMModelDescriptor[] {
  if (!modelName || models.some((item) => item.id === modelName)) {
    return models
  }

  return [{ id: modelName, ownedBy: null }, ...models]
}

function createEmptyLLMConfig(isDefault: boolean): LLMModelConfigInput {
  const preset = LLM_PROVIDER_PRESETS.openai
  return {
    name: 'OpenAI Compatible',
    provider: 'openai',
    endpoint: preset.endpoint,
    apiKey: '',
    modelName: '',
    temperature: preset.defaultTemperature,
    advanced: cloneAdvancedSettings(preset.defaultAdvanced),
    isDefault,
  }
}

function llmSummaryToForm(config: LLMModelConfigSummary): LLMModelConfigInput {
  return {
    id: config.id,
    name: config.name,
    provider: config.provider,
    endpoint: config.endpoint,
    apiKey: '',
    modelName: config.modelName,
    temperature: config.temperature,
    advanced: cloneAdvancedSettings(config.advanced),
    isDefault: config.isDefault,
  }
}

export function Settings() {
  const [status, setStatus] = useState<ImageCacheStatus | null>(null)
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [profiles, setProfiles] = useState<RemoteProfileSummary[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [indexItems, setIndexItems] = useState<RemoteModelIndexItem[]>([])
  const [llmConfigs, setLlmConfigs] = useState<LLMModelConfigSummary[]>([])
  const [selectedLLMConfigId, setSelectedLLMConfigId] = useState('')
  const [llmForm, setLlmForm] = useState<LLMModelConfigInput>(createEmptyLLMConfig(true))
  const [availableLLMModels, setAvailableLLMModels] = useState<LLMModelDescriptor[]>([])
  const [civitaiConfig, setCivitaiConfig] = useState<CivitaiConfigSummary | null>(null)
  const [civitaiApiKey, setCivitaiApiKey] = useState('')
  const [civitaiNotice, setCivitaiNotice] = useState('')
  const [llmNotice, setLlmNotice] = useState('')
  const [lastLLMTest, setLastLLMTest] = useState<LLMConnectionTestResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStorageLoading, setIsStorageLoading] = useState(true)
  const [isProfilesLoading, setIsProfilesLoading] = useState(true)
  const [isLLMConfigsLoading, setIsLLMConfigsLoading] = useState(true)
  const [isCleaning, setIsCleaning] = useState(false)
  const [isExportingBackup, setIsExportingBackup] = useState(false)
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const [isMigratingAppData, setIsMigratingAppData] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isScanningProfile, setIsScanningProfile] = useState(false)
  const [isSavingLLMConfig, setIsSavingLLMConfig] = useState(false)
  const [isTestingLLMConfig, setIsTestingLLMConfig] = useState(false)
  const [isDiscoveringLLMModels, setIsDiscoveringLLMModels] = useState(false)
  const [scanProgress, setScanProgress] = useState<RemoteModelScanProgress | null>(null)
  const [isSavingCivitai, setIsSavingCivitai] = useState(false)
  const [isTestingCivitai, setIsTestingCivitai] = useState(false)
  const [lastResult, setLastResult] = useState<ImageCacheCleanupResult | null>(null)
  const [profileNotice, setProfileNotice] = useState('')
  const [storageNotice, setStorageNotice] = useState('')
  const [profileForm, setProfileForm] = useState<RemoteProfileInput>(createEmptyProfile(true))
  const selectedProfileIdRef = useRef(selectedProfileId)
  const selectedLLMConfigIdRef = useRef(selectedLLMConfigId)

  useEffect(() => {
    selectedProfileIdRef.current = selectedProfileId
  }, [selectedProfileId])

  useEffect(() => {
    selectedLLMConfigIdRef.current = selectedLLMConfigId
  }, [selectedLLMConfigId])

  const indexCounts = useMemo(() => ({
    lora: indexItems.filter((item) => item.kind === 'lora').length,
    checkpoint: indexItems.filter((item) => item.kind === 'checkpoint').length,
    vae: indexItems.filter((item) => item.kind === 'vae').length,
  }), [indexItems])

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await window.api.getImageCacheStatus()
      if (res.success && res.data) {
        setStatus(res.data)
      }
    } catch (err) {
      console.error('Failed to load cache status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadStorageInfo = useCallback(async () => {
    try {
      setIsStorageLoading(true)
      const res = await window.api.getStorageInfo()
      if (res.success && res.data) {
        setStorageInfo(res.data)
      }
    } catch (err) {
      console.error('Failed to load storage info:', err)
    } finally {
      setIsStorageLoading(false)
    }
  }, [])

  const loadCivitaiConfig = useCallback(async () => {
    try {
      const res = await window.api.getCivitaiConfig()
      if (res.success && res.data) {
        setCivitaiConfig(res.data)
      }
    } catch (err) {
      console.error('Failed to load Civitai config:', err)
    }
  }, [])

  const loadLLMConfigs = useCallback(async (preferredId?: string) => {
    try {
      setIsLLMConfigsLoading(true)
      const res = await window.api.listLLMConfigs()
      if (!res.success || !res.data) {
        return
      }

      setLlmConfigs(res.data)
      const nextSelectedId = preferredId ?? (selectedLLMConfigIdRef.current || res.data[0]?.id || '')
      const selectedConfig = res.data.find((item) => item.id === nextSelectedId) ?? res.data[0] ?? null

      if (selectedConfig) {
        setSelectedLLMConfigId(selectedConfig.id)
        setLlmForm(llmSummaryToForm(selectedConfig))
      } else {
        setSelectedLLMConfigId('')
        setLlmForm(createEmptyLLMConfig(true))
      }
    } catch (err) {
      console.error('Failed to load LLM configs:', err)
    } finally {
      setIsLLMConfigsLoading(false)
    }
  }, [])

  const loadIndex = useCallback(async (profileId: string) => {
    if (!profileId) {
      setIndexItems([])
      return
    }

    try {
      const res = await window.api.getRemoteModelIndex(profileId)
      if (res.success && res.data) {
        setIndexItems(res.data)
      }
    } catch (err) {
      console.error('Failed to load remote model index:', err)
    }
  }, [])

  const loadProfiles = useCallback(async (preferredId?: string) => {
    try {
      setIsProfilesLoading(true)
      const res = await window.api.listRemoteProfiles()
      if (!res.success || !res.data) {
        return
      }

      setProfiles(res.data)
      const nextSelectedId = preferredId ?? (selectedProfileIdRef.current || res.data[0]?.id || '')
      const selectedProfile = res.data.find((item) => item.id === nextSelectedId) ?? res.data[0] ?? null

      if (selectedProfile) {
        setSelectedProfileId(selectedProfile.id)
        setProfileForm(profileToForm(selectedProfile))
        await loadIndex(selectedProfile.id)
      } else {
        setSelectedProfileId('')
        setProfileForm(createEmptyProfile(true))
        setIndexItems([])
      }
    } catch (err) {
      console.error('Failed to load remote profiles:', err)
    } finally {
      setIsProfilesLoading(false)
    }
  }, [loadIndex])

  useEffect(() => {
    void loadStorageInfo()
    void loadStatus()
    void loadProfiles()
    void loadCivitaiConfig()
    void loadLLMConfigs()
  }, [loadCivitaiConfig, loadLLMConfigs, loadProfiles, loadStatus, loadStorageInfo])

  useEffect(() => {
    const unsubscribe = window.api.onRemoteModelScanProgress((progress) => {
      setScanProgress(progress)
    })

    return unsubscribe
  }, [])

  const handleCleanup = async (mode: ImageCacheCleanupMode) => {
    if (mode === 'all') {
      const confirmed = window.confirm('⚠ 警告：此操作将清空所有本地图片缓存并断开数据库图片关联！若原始来源失效将无法恢复。\n如果您只想清理冗余文件，请选择另外两项功能。\n\n您确定要进行全量本地图片清空吗？')
      if (!confirmed) return
    }

    try {
      setIsCleaning(true)
      setLastResult(null)
      const res = await window.api.cleanupImageCache({ mode })
      if (res.success && res.data) {
        setLastResult(res.data)
        void loadStatus()
      } else {
        const errorMsg = res.error ? (typeof res.error === 'string' ? res.error : (res.error.message || JSON.stringify(res.error))) : '未知错误'
        alert(`清理失败: ${errorMsg}`)
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      alert(`清理出错: ${errorMsg}`)
    } finally {
      setIsCleaning(false)
    }
  }

  const handleOpenStorageLocation = async (target: StorageLocationKey) => {
    try {
      setStorageNotice('')
      const res = await window.api.openStorageLocation({ target })
      if (!res.success) {
        throw new Error(res.error?.message ?? '打开目录失败')
      }
    } catch (err) {
      setStorageNotice(`打开目录失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleExportDatabaseBackup = async () => {
    try {
      setIsExportingBackup(true)
      setStorageNotice('')
      const res = await window.api.exportDatabaseBackup()
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '导出失败')
      }

      if (res.data.cancelled) {
        return
      }

      setStorageNotice(`数据库备份已导出到 ${res.data.filePath}（${formatBytes(res.data.bytes)}）。`)
      await loadStorageInfo()
    } catch (err) {
      setStorageNotice(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsExportingBackup(false)
    }
  }

  const handleImportDatabaseBackup = async () => {
    const confirmed = window.confirm('导入备份会用选中的数据库文件覆盖当前本地数据库。请确认当前没有未保存的重要操作。是否继续？')
    if (!confirmed) {
      return
    }

    try {
      setIsImportingBackup(true)
      setStorageNotice('')
      const res = await window.api.importDatabaseBackup()
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '恢复失败')
      }

      if (res.data.cancelled) {
        return
      }

      setStorageNotice(`数据库已从 ${res.data.filePath} 恢复。当前设置页数据已刷新；如果其他页面仍显示旧数据，重新进入对应页面即可。`)
      await Promise.all([
        loadStorageInfo(),
        loadStatus(),
        loadProfiles(),
        loadCivitaiConfig(),
        loadLLMConfigs(),
      ])
    } catch (err) {
      setStorageNotice(`恢复失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsImportingBackup(false)
    }
  }

  const handleMigrateAppData = async () => {
    const confirmed = window.confirm('迁移会复制当前应用数据目录到一个新的空文件夹，并将后续数据库、缓存、导出都切换到新位置。为避免误覆盖，请先准备一个空目录。是否继续？')
    if (!confirmed) {
      return
    }

    try {
      setIsMigratingAppData(true)
      setStorageNotice('')
      const res = await window.api.migrateAppDataDirectory()
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '迁移失败')
      }

      if (res.data.cancelled) {
        return
      }

      setStorageNotice(`应用数据已迁移到 ${res.data.targetPath}，共复制 ${res.data.copiedFiles} 个文件。当前会话已切换到新目录；确认无误后，可手动删除旧目录 ${res.data.sourcePath} 以释放 C 盘空间。`)
      await Promise.all([
        loadStorageInfo(),
        loadStatus(),
        loadProfiles(),
        loadCivitaiConfig(),
        loadLLMConfigs(),
      ])
    } catch (err) {
      setStorageNotice(`迁移失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsMigratingAppData(false)
    }
  }

  const handleSelectProfile = (profile: RemoteProfileSummary) => {
    setSelectedProfileId(profile.id)
    setProfileNotice('')
    setProfileForm(profileToForm(profile))
    void loadIndex(profile.id)
  }

  const handleCreateProfile = () => {
    setSelectedProfileId('')
    setProfileNotice('')
    setProfileForm(createEmptyProfile(profiles.length === 0))
    setIndexItems([])
  }

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true)
      setProfileNotice('')
      const payload: RemoteProfileInput = {
        ...profileForm,
        sshPort: Number(profileForm.sshPort) || 22,
        lorasPaths: profileForm.lorasPaths.map((item) => item.trim()).filter(Boolean),
        sshPassword: profileForm.sshPassword?.trim() ? profileForm.sshPassword : undefined,
      }
      const res = await window.api.saveRemoteProfile(payload)
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '保存失败')
      }

      const savedProfile = res.data
      setProfileNotice('远端配置已保存。')
      await loadProfiles(savedProfile.id)
      setProfileForm((prev) => ({ ...prev, id: savedProfile.id, sshPassword: '' }))
    } catch (err) {
      setProfileNotice(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleDeleteProfile = async () => {
    if (!profileForm.id) {
      handleCreateProfile()
      return
    }

    const confirmed = window.confirm('确定删除当前远端配置吗？其模型索引缓存也会一并移除。')
    if (!confirmed) {
      return
    }

    try {
      const res = await window.api.deleteRemoteProfile(profileForm.id)
      if (!res.success) {
        throw new Error(res.error?.message ?? '删除失败')
      }

      setProfileNotice('远端配置已删除。')
      setSelectedProfileId('')
      setProfileForm(createEmptyProfile(false))
      setIndexItems([])
      await loadProfiles()
    } catch (err) {
      setProfileNotice(`删除失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleScanProfile = async () => {
    if (!profileForm.id) {
      setProfileNotice('请先保存远端配置，再执行扫描。')
      return
    }

    try {
      setIsScanningProfile(true)
      setScanProgress(null)
      setProfileNotice('')
      const res = await window.api.scanRemoteModels({ profileId: profileForm.id })
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '扫描失败')
      }

      setProfileNotice(`扫描完成：共索引 ${res.data.scannedCount} 个模型文件（LoRA ${res.data.counts.lora}，Checkpoint ${res.data.counts.checkpoint}）。`)
      await loadProfiles(profileForm.id)
    } catch (err) {
      setProfileNotice(`扫描失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsScanningProfile(false)
      setScanProgress(null)
    }
  }

  const handleSaveCivitaiConfig = async () => {
    try {
      setIsSavingCivitai(true)
      setCivitaiNotice('')
      const res = await window.api.saveCivitaiConfig({ apiKey: civitaiApiKey.trim() ? civitaiApiKey : null })
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '保存失败')
      }

      setCivitaiConfig(res.data)
      setCivitaiApiKey('')
      setCivitaiNotice('Civitai API Key 已保存。')
    } catch (err) {
      setCivitaiNotice(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSavingCivitai(false)
    }
  }

  const handleTestCivitaiConfig = async () => {
    try {
      setIsTestingCivitai(true)
      setCivitaiNotice('')
      const res = await window.api.testCivitaiConfig()
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '测试失败')
      }

      setCivitaiNotice(`连接正常，耗时 ${res.data.latencyMs}ms。`)
    } catch (err) {
      setCivitaiNotice(`测试失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsTestingCivitai(false)
    }
  }

  const handleSelectLLMConfig = (config: LLMModelConfigSummary) => {
    setSelectedLLMConfigId(config.id)
    setLlmNotice('')
    setLastLLMTest(null)
    setLlmForm(llmSummaryToForm(config))
    setAvailableLLMModels(ensureModelOption([], config.modelName))
  }

  const handleCreateLLMConfig = () => {
    setSelectedLLMConfigId('')
    setLlmNotice('')
    setLastLLMTest(null)
    setLlmForm(createEmptyLLMConfig(llmConfigs.length === 0))
    setAvailableLLMModels([])
  }

  const handleLLMProviderChange = (provider: LLMProvider) => {
    setLlmForm((prev) => {
      const previousPreset = LLM_PROVIDER_PRESETS[prev.provider]
      const nextPreset = LLM_PROVIDER_PRESETS[provider]
      const shouldReplaceEndpoint = !prev.endpoint.trim() || prev.endpoint === previousPreset.endpoint

      return {
        ...prev,
        provider,
        endpoint: shouldReplaceEndpoint ? nextPreset.endpoint : prev.endpoint,
        modelName: '',
        temperature: nextPreset.defaultTemperature,
        advanced: cloneAdvancedSettings(nextPreset.defaultAdvanced),
        name:
          !prev.id && (!prev.name.trim() || prev.name === previousPreset.label)
            ? nextPreset.label
            : prev.name,
      }
    })
    setAvailableLLMModels([])
    setLastLLMTest(null)
  }

  const buildLLMFormPayload = (): LLMModelConfigInput => ({
    ...llmForm,
    apiKey: llmForm.id
      ? llmForm.apiKey?.trim()
        ? llmForm.apiKey.trim()
        : undefined
      : llmForm.apiKey?.trim()
        ? llmForm.apiKey.trim()
        : null,
    endpoint: llmForm.endpoint.trim(),
    modelName: llmForm.modelName.trim(),
    name: llmForm.name.trim(),
    advanced: {
      strictJsonMode: llmForm.advanced.strictJsonMode,
      maxTokens: llmForm.advanced.maxTokens,
      thinkingEnabled: llmForm.advanced.thinkingEnabled,
    },
  })

  const handleSaveLLMConfig = async () => {
    try {
      setIsSavingLLMConfig(true)
      setLlmNotice('')
      if (!llmForm.modelName.trim()) {
        throw new Error('请先测试连接并从模型列表中选择一个可用模型。')
      }
      const res = await window.api.saveLLMConfig(buildLLMFormPayload())
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '保存失败')
      }

      const savedConfig = res.data
      setLlmNotice('AI API 配置已保存。')
      await loadLLMConfigs(savedConfig.id)
      setLlmForm((prev) => ({ ...prev, id: savedConfig.id, apiKey: '' }))
    } catch (err) {
      setLlmNotice(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsSavingLLMConfig(false)
    }
  }

  const handleDeleteLLMConfig = async () => {
    if (!llmForm.id) {
      handleCreateLLMConfig()
      return
    }

    const confirmed = window.confirm('确定删除当前 AI API 配置吗？')
    if (!confirmed) {
      return
    }

    try {
      const res = await window.api.deleteLLMConfig(llmForm.id)
      if (!res.success) {
        throw new Error(res.error?.message ?? '删除失败')
      }

      setLlmNotice('AI API 配置已删除。')
      setSelectedLLMConfigId('')
      setLastLLMTest(null)
      setLlmForm(createEmptyLLMConfig(false))
      await loadLLMConfigs()
    } catch (err) {
      setLlmNotice(`删除失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleTestLLMConfig = async () => {
    try {
      setIsTestingLLMConfig(true)
      setLlmNotice('')
      setLastLLMTest(null)
      const res = await window.api.testLLMConfig({
        configId: llmForm.id ?? null,
        config: buildLLMFormPayload(),
      })
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '测试失败')
      }

      const testResult = res.data
      const discoveredModels = testResult.availableModels ?? []
      setLastLLMTest(testResult)
      setAvailableLLMModels(ensureModelOption(discoveredModels, testResult.model))
      setLlmForm((prev) => ({
        ...prev,
        modelName: buildPreferredModel(prev.provider, discoveredModels, prev.modelName || testResult.model),
      }))
      setLlmNotice(`连接正常，耗时 ${testResult.latencyMs}ms，已获取 ${discoveredModels.length} 个模型。`)
    } catch (err) {
      setLlmNotice(`测试失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsTestingLLMConfig(false)
    }
  }

  const handleDiscoverLLMModels = async () => {
    try {
      setIsDiscoveringLLMModels(true)
      setLlmNotice('')
      const res = await window.api.discoverLLMModels({
        configId: llmForm.id ?? null,
        config: buildLLMFormPayload(),
      })
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? '获取模型列表失败')
      }

      const discoveredModels = res.data ?? []
      setAvailableLLMModels(ensureModelOption(discoveredModels, llmForm.modelName))
      setLlmForm((prev) => ({
        ...prev,
        modelName: buildPreferredModel(prev.provider, discoveredModels, prev.modelName),
      }))
      setLlmNotice(`已获取 ${discoveredModels.length} 个可用模型。`)
    } catch (err) {
      setLlmNotice(`获取模型列表失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsDiscoveringLLMModels(false)
    }
  }

  return (
    <div className={styles.settingsPage}>
      <h1 className={styles.title}>系统设置</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>存储与备份</h2>

        {isStorageLoading && !storageInfo ? (
          <div className={styles.loading}>正在读取存储路径...</div>
        ) : storageInfo ? (
          <>
            <div className={styles.storageGrid}>
              <div className={styles.storageCard}>
                <div className={styles.storageHeader}>
                  <div className={styles.storageTitle}>数据库目录</div>
                  <button className={styles.btnAction} onClick={() => void handleOpenStorageLocation('databaseDir')}>
                    打开目录
                  </button>
                </div>
                <div className={styles.storagePath}>{storageInfo.databasePath}</div>
              </div>
              <div className={styles.storageCard}>
                <div className={styles.storageHeader}>
                  <div className={styles.storageTitle}>图片缓存目录</div>
                  <button className={styles.btnAction} onClick={() => void handleOpenStorageLocation('imageCache')}>
                    打开目录
                  </button>
                </div>
                <div className={styles.storagePath}>{storageInfo.imageCachePath}</div>
              </div>
              <div className={styles.storageCard}>
                <div className={styles.storageHeader}>
                  <div className={styles.storageTitle}>日志/导出目录</div>
                  <button className={styles.btnAction} onClick={() => void handleOpenStorageLocation('exports')}>
                    打开目录
                  </button>
                </div>
                <div className={styles.storagePath}>{storageInfo.exportsPath}</div>
              </div>
              <div className={styles.storageCard}>
                <div className={styles.storageHeader}>
                  <div className={styles.storageTitle}>应用数据根目录</div>
                  <button className={styles.btnAction} onClick={() => void handleOpenStorageLocation('userData')}>
                    打开目录
                  </button>
                </div>
                <div className={styles.storagePath}>{storageInfo.userDataPath}</div>
                <div className={styles.storageMeta}>
                  {storageInfo.usingCustomUserDataPath ? '当前使用自定义数据目录' : '当前使用默认数据目录'}
                </div>
              </div>
              <div className={styles.storageCard}>
                <div className={styles.storageHeader}>
                  <div className={styles.storageTitle}>默认应用数据根目录</div>
                </div>
                <div className={styles.storagePath}>{storageInfo.defaultUserDataPath}</div>
                <div className={styles.storageMeta}>覆盖配置文件：{storageInfo.bootstrapConfigPath}</div>
              </div>
            </div>

            <div className={styles.storageActions}>
              <button className={styles.btnAction} onClick={() => void handleExportDatabaseBackup()} disabled={isExportingBackup}>
                {isExportingBackup ? '导出中...' : '导出数据库备份'}
              </button>
              <button className={styles.btnAction} onClick={() => void handleImportDatabaseBackup()} disabled={isImportingBackup}>
                {isImportingBackup ? '恢复中...' : '导入数据库备份'}
              </button>
              <button className={styles.btnAction} onClick={() => void handleMigrateAppData()} disabled={isMigratingAppData}>
                {isMigratingAppData ? '迁移中...' : '迁移应用数据目录'}
              </button>
            </div>

            {storageNotice && <div className={styles.resultBox}>{storageNotice}</div>}
          </>
        ) : (
          <div className={styles.loading}>无法读取存储路径信息。</div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>图片缓存管理</h2>

        {isLoading && !status ? (
          <div className={styles.loading}>正在计算缓存占用...</div>
        ) : status ? (
          <>
            <div className={styles.cacheGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>总占用空间</div>
                <div className={styles.statValue}>{formatBytes(status.totalBytes)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>物理文件总数</div>
                <div className={styles.statValue}>{status.fileCount} 个</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>被引用的有效文件</div>
                <div className={styles.statValue}>{status.referencedFileCount} 个</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>无引用的幽灵文件 (Orphans)</div>
                <div className={`${styles.statValue} ${status.orphanFileCount > 0 ? styles.warning : ''}`}>
                  {status.orphanFileCount} 个 ({formatBytes(status.orphanBytes)})
                </div>
              </div>
            </div>

            {status.missingReferenceCount > 0 && (
              <div className={styles.warningBox}>
                ⚠ 数据库中有 {status.missingReferenceCount} 条图片记录的指向本地文件不存在（物理丢失）。
              </div>
            )}

            <div className={styles.actions}>
              <div className={styles.actionRow}>
                <div className={styles.actionDesc}>
                  <div className={styles.actionTitle}>清理幽灵缓存 (Orphans)</div>
                  <div className={styles.actionSub}>删除硬盘上存在但数据库中没有任何记录引用的孤儿文件，安全释放空间。</div>
                </div>
                <button className={styles.btnAction} onClick={() => void handleCleanup('orphans')} disabled={isCleaning || status.orphanFileCount === 0}>
                  {isCleaning ? '清理中...' : '清理幽灵缓存'}
                </button>
              </div>

              <div className={styles.actionRow}>
                <div className={styles.actionDesc}>
                  <div className={styles.actionTitle}>修复失效引用 (Missing Refs)</div>
                  <div className={styles.actionSub}>清理数据库中指向失效或丢失的本地文件路径的关联引用（将其置回未缓存状态）。</div>
                </div>
                <button className={styles.btnAction} onClick={() => void handleCleanup('missing_refs')} disabled={isCleaning || status.missingReferenceCount === 0}>
                  {isCleaning ? '修复中...' : '修复失效引用'}
                </button>
              </div>

              <div className={styles.actionRow}>
                <div className={styles.actionDesc}>
                  <div className={`${styles.actionTitle} ${styles.dangerText}`}>危险：全量清空所有缓存 (All)</div>
                  <div className={styles.actionSub}>彻底清空所有本地图片文件，并清空数据库中所有的本地关联。仅在极端空间不足时使用。</div>
                </div>
                <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={() => void handleCleanup('all')} disabled={isCleaning}>
                  清空全部库
                </button>
              </div>
            </div>

            {lastResult && (
              <div className={styles.resultBox}>
                <strong>✅ 清理完成:</strong><br />
                {lastResult.mode === 'orphans' && `释放了 ${formatBytes(lastResult.freedBytes)} 空间，删除了 ${lastResult.deletedFiles} 个幽灵文件。`}
                {lastResult.mode === 'missing_refs' && `移除了 ${lastResult.clearedReferences} 条失效的数据库内联引用。`}
                {lastResult.mode === 'all' && `删除了 ${lastResult.deletedFiles} 个缓存文件，清空了 ${lastResult.clearedReferences} 条数据库关联，共释放 ${formatBytes(lastResult.freedBytes)} 空间。`}
              </div>
            )}
          </>
        ) : (
          <div className={styles.loading}>无法读取缓存状态数据。</div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>AI API 配置</h2>
          <button className={styles.btnAction} onClick={handleCreateLLMConfig}>新建配置</button>
        </div>

        <div className={styles.remoteLayout}>
          <div className={styles.profileList}>
            {isLLMConfigsLoading ? (
              <div className={styles.loading}>加载 AI API 配置...</div>
            ) : llmConfigs.length === 0 ? (
              <div className={styles.emptyHint}>还没有 AI API 配置。先在右侧填写一组 endpoint / apiKey / model 后保存。</div>
            ) : (
              llmConfigs.map((config) => (
                <button
                  key={config.id}
                  className={`${styles.profileCard} ${selectedLLMConfigId === config.id ? styles.profileCardActive : ''}`}
                  onClick={() => handleSelectLLMConfig(config)}
                >
                  <div className={styles.profileCardHeader}>
                    <strong>{config.name}</strong>
                    {config.isDefault && <span className={styles.defaultBadge}>默认</span>}
                  </div>
                  <div className={styles.profileMeta}>{LLM_PROVIDER_PRESETS[config.provider].label}</div>
                  <div className={styles.profileMeta}>{config.modelName}</div>
                  <div className={styles.profileMeta}>{formatDate(config.updatedAt)}</div>
                </button>
              ))
            )}
          </div>

          <div className={styles.profileEditor}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>配置名称</span>
                <input value={llmForm.name} onChange={(event) => setLlmForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>Provider</span>
                <select value={llmForm.provider} onChange={(event) => handleLLMProviderChange(event.target.value as LLMProvider)}>
                  {Object.entries(LLM_PROVIDER_PRESETS).map(([provider, preset]) => (
                    <option key={provider} value={provider}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>基础 URL</span>
                <input value={llmForm.endpoint} onChange={(event) => setLlmForm((prev) => ({ ...prev, endpoint: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>模型</span>
                <select
                  value={llmForm.modelName}
                  onChange={(event) => setLlmForm((prev) => ({ ...prev, modelName: event.target.value }))}
                  disabled={availableLLMModels.length === 0}
                >
                  <option value="">
                    {availableLLMModels.length === 0 ? '先测试连接或刷新模型列表' : '选择可用模型'}
                  </option>
                  {availableLLMModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id}{model.ownedBy ? ` · ${model.ownedBy}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>API Key</span>
                <input
                  type="password"
                  placeholder={llmForm.id ? '留空表示保持当前 API Key' : '输入 API Key（使用系统安全存储加密保存）'}
                  value={llmForm.apiKey ?? ''}
                  onChange={(event) => setLlmForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>Temperature</span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={llmForm.temperature}
                  onChange={(event) =>
                    setLlmForm((prev) => ({
                      ...prev,
                      temperature: Number(event.target.value),
                    }))}
                />
              </label>
              <label className={styles.field}>
                <span>max_tokens</span>
                <input
                  type="number"
                  min="256"
                  step="256"
                  value={llmForm.advanced.maxTokens ?? ''}
                  placeholder="8192"
                  onChange={(event) =>
                    setLlmForm((prev) => ({
                      ...prev,
                      advanced: {
                        ...prev.advanced,
                        maxTokens: event.target.value ? Number(event.target.value) : null,
                      },
                    }))}
                />
              </label>
              <label className={`${styles.checkboxField} ${styles.fieldWide}`}>
                <input
                  type="checkbox"
                  checked={llmForm.advanced.strictJsonMode}
                  onChange={(event) =>
                    setLlmForm((prev) => ({
                      ...prev,
                      advanced: {
                        ...prev.advanced,
                        strictJsonMode: event.target.checked,
                      },
                    }))}
                />
                <span>启用严格 JSON 模式（推荐用于结构化分析）</span>
              </label>
              {llmForm.provider === 'deepseek' && (
                <label className={`${styles.checkboxField} ${styles.fieldWide}`}>
                  <input
                    type="checkbox"
                    checked={llmForm.advanced.thinkingEnabled}
                    onChange={(event) =>
                      setLlmForm((prev) => ({
                        ...prev,
                        advanced: {
                          ...prev.advanced,
                          thinkingEnabled: event.target.checked,
                        },
                      }))}
                  />
                  <span>启用 DeepSeek Thinking 模式</span>
                </label>
              )}
              <label className={`${styles.checkboxField} ${styles.fieldWide}`}>
                <input
                  type="checkbox"
                  checked={llmForm.isDefault === true}
                  onChange={(event) => setLlmForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                />
                <span>设为默认 AI API 配置</span>
              </label>
            </div>

            <div className={styles.editorActions}>
              <button className={styles.btnAction} onClick={() => void handleSaveLLMConfig()} disabled={isSavingLLMConfig}>
                {isSavingLLMConfig ? '保存中...' : '保存配置'}
              </button>
              <button className={styles.btnAction} onClick={() => void handleTestLLMConfig()} disabled={isTestingLLMConfig}>
                {isTestingLLMConfig ? '测试中...' : '测试连接'}
              </button>
              <button className={styles.btnAction} onClick={() => void handleDiscoverLLMModels()} disabled={isDiscoveringLLMModels}>
                {isDiscoveringLLMModels ? '读取中...' : '刷新模型列表'}
              </button>
              <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={() => void handleDeleteLLMConfig()} disabled={!llmForm.id}>
                删除配置
              </button>
            </div>

            <div className={styles.emptyHint}>
              当前 provider：{LLM_PROVIDER_PRESETS[llmForm.provider].label}
              {selectedLLMConfigId ? '；当前正在编辑已保存配置' : '；当前为新建配置'}
            </div>
            <div className={styles.storageMeta}>
              当前模型来源：通过 `/models` 自动发现后选择，不再手填。
            </div>
            {llmForm.provider === 'deepseek' && (
              <div className={styles.storageMeta}>
                DeepSeek 默认预设已切换到 `deepseek-v4-flash`；`deepseek-chat / deepseek-reasoner` 属于兼容别名，官方已给出退役时间。
              </div>
            )}
            {lastLLMTest && (
              <div className={styles.storageMeta}>
                最近测试：{lastLLMTest.provider}:{lastLLMTest.model} · {lastLLMTest.endpoint} · {lastLLMTest.latencyMs}ms · 发现 {lastLLMTest.availableModels.length} 个模型
              </div>
            )}
            {llmNotice && <div className={styles.resultBox}>{llmNotice}</div>}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Prompt 模板管理</h2>
        <TemplateEditor />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Civitai 配置</h2>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Civitai API Key</span>
            <input
              type="password"
              placeholder={civitaiConfig?.hasApiKey ? '留空表示保持当前 API Key' : '输入 Civitai API Key'}
              value={civitaiApiKey}
              onChange={(event) => setCivitaiApiKey(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.editorActions}>
          <button className={styles.btnAction} onClick={() => void handleSaveCivitaiConfig()} disabled={isSavingCivitai}>
            {isSavingCivitai ? '保存中...' : '保存 API Key'}
          </button>
          <button className={styles.btnAction} onClick={() => void handleTestCivitaiConfig()} disabled={isTestingCivitai}>
            {isTestingCivitai ? '测试中...' : '测试连接'}
          </button>
        </div>
        <div className={styles.emptyHint}>当前状态：{civitaiConfig?.hasApiKey ? `已配置 API Key（更新时间 ${formatDate(civitaiConfig.updatedAt)})` : '未配置 API Key'}</div>
        {civitaiNotice && <div className={styles.resultBox}>{civitaiNotice}</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>远端模型索引</h2>
          <button className={styles.btnAction} onClick={handleCreateProfile}>新建配置</button>
        </div>

        <div className={styles.remoteLayout}>
          <div className={styles.profileList}>
            {isProfilesLoading ? (
              <div className={styles.loading}>加载远端配置...</div>
            ) : profiles.length === 0 ? (
              <div className={styles.emptyHint}>还没有远端配置。先在右侧填写一组 SSH/ComfyUI 参数并保存。</div>
            ) : (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  className={`${styles.profileCard} ${selectedProfileId === profile.id ? styles.profileCardActive : ''}`}
                  onClick={() => handleSelectProfile(profile)}
                >
                  <div className={styles.profileCardHeader}>
                    <strong>{profile.name}</strong>
                    {profile.isDefault && <span className={styles.defaultBadge}>默认</span>}
                  </div>
                  <div className={styles.profileMeta}>{profile.sshHost ?? '未配置 SSH'} · {profile.indexedFileCount} 个模型</div>
                  <div className={styles.profileMeta}>LoRA {profile.indexedLoraCount} · Checkpoint {profile.indexedCheckpointCount}</div>
                  <div className={styles.profileMeta}>{formatDate(profile.lastSyncedAt)}</div>
                </button>
              ))
            )}
          </div>

          <div className={styles.profileEditor}>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>配置名称</span>
                <input value={profileForm.name} onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>ComfyUI 地址</span>
                <input value={profileForm.comfyBaseUrl} onChange={(event) => setProfileForm((prev) => ({ ...prev, comfyBaseUrl: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>History 路径</span>
                <input value={profileForm.comfyHistoryRoute ?? '/history'} onChange={(event) => setProfileForm((prev) => ({ ...prev, comfyHistoryRoute: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>SSH 主机</span>
                <input value={profileForm.sshHost ?? ''} onChange={(event) => setProfileForm((prev) => ({ ...prev, sshHost: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>SSH 端口</span>
                <input type="number" value={profileForm.sshPort} onChange={(event) => setProfileForm((prev) => ({ ...prev, sshPort: Number(event.target.value) || 22 }))} />
              </label>
              <label className={styles.field}>
                <span>SSH 用户名</span>
                <input value={profileForm.sshUser ?? ''} onChange={(event) => setProfileForm((prev) => ({ ...prev, sshUser: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>SSH 密码</span>
                <input type="password" placeholder={profileForm.id ? '留空表示保持原密码' : ''} value={profileForm.sshPassword ?? ''} onChange={(event) => setProfileForm((prev) => ({ ...prev, sshPassword: event.target.value }))} />
              </label>
              <label className={styles.field}>
                <span>ComfyUI 根目录</span>
                <input value={profileForm.comfyRootPath ?? ''} onChange={(event) => setProfileForm((prev) => ({ ...prev, comfyRootPath: event.target.value }))} />
              </label>
              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span>模型目录（每行一个，相对 ComfyUI 根目录）</span>
                <textarea rows={4} value={profileForm.lorasPaths.join('\n')} onChange={(event) => setProfileForm((prev) => ({ ...prev, lorasPaths: event.target.value.split(/\r?\n/) }))} />
              </label>
              <label className={`${styles.checkboxField} ${styles.fieldWide}`}>
                <input type="checkbox" checked={profileForm.isDefault === true} onChange={(event) => setProfileForm((prev) => ({ ...prev, isDefault: event.target.checked }))} />
                <span>设为默认远端配置（详情页远端模型存在性优先使用它）</span>
              </label>
            </div>

            <div className={styles.editorActions}>
              <button className={styles.btnAction} onClick={() => void handleSaveProfile()} disabled={isSavingProfile}>
                {isSavingProfile ? '保存中...' : '保存配置'}
              </button>
              <button className={styles.btnAction} onClick={() => void handleScanProfile()} disabled={isScanningProfile || !profileForm.id}>
                {isScanningProfile ? '扫描中...' : '扫描远端模型'}
              </button>
              <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={() => void handleDeleteProfile()} disabled={!profileForm.id}>
                删除配置
              </button>
            </div>

            {profileNotice && <div className={styles.resultBox}>{profileNotice}</div>}
            {isScanningProfile && scanProgress && (
              <div className={styles.progressBox}>
                <strong>
                  {scanProgress.phase === 'discovering' ? '正在发现模型文件...' : '正在计算模型哈希...'}
                </strong>
                <div className={styles.progressMeta}>
                  {scanProgress.phase === 'discovering'
                    ? `已发现 ${scanProgress.processed} 个文件`
                    : `已处理 ${scanProgress.processed} / ${scanProgress.total} 个文件`}
                </div>
                {scanProgress.currentPath && (
                  <div className={styles.progressPath}>{scanProgress.currentPath}</div>
                )}
              </div>
            )}

            <div className={styles.indexPanel}>
              <div className={styles.indexHeader}>
                <strong>已缓存索引</strong>
                <span>{indexItems.length} 个文件（LoRA {indexCounts.lora} · Checkpoint {indexCounts.checkpoint}）</span>
              </div>
              {indexItems.length === 0 ? (
                <div className={styles.emptyHint}>当前配置还没有扫描结果。</div>
              ) : (
                <div className={styles.indexList}>
                  {indexItems.slice(0, 120).map((item) => (
                    <div key={`${item.kind}:${item.path}`} className={styles.indexRow}>
                      <div className={styles.profileCardHeader}>
                        <div className={styles.indexName}>{item.filename}</div>
                        <span className={styles.defaultBadge}>{getKindLabel(item.kind)}</span>
                      </div>
                      <div className={styles.indexPath}>{item.path}</div>
                      {item.sha256 && <div className={styles.indexPath}>sha256: {item.sha256.slice(0, 16)}...</div>}
                    </div>
                  ))}
                  {indexItems.length > 120 && <div className={styles.indexOverflow}>仅显示前 120 条，实际已索引 {indexItems.length} 条。</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
