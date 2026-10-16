import type { CivitaiModelMatch } from '@shared/types/civitai'
import type { RemoteModelKind } from '@shared/types/remote'

const CIVITAI_API_BASE = 'https://civitai.com/api/v1'
const CIVITAI_REQUEST_TIMEOUT_MS = 15000

export class CivitaiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message)
    this.name = 'CivitaiRequestError'
  }
}

interface CivitaiImagePayload {
  url?: string
}

interface CivitaiFilePayload {
  downloadUrl?: string
}

interface CivitaiModelPayload {
  id?: number
  name?: string
  type?: string
  stats?: {
    rating?: number
  }
}

interface CivitaiVersionPayload {
  id?: number
  name?: string
  modelId?: number
  model?: CivitaiModelPayload
  files?: CivitaiFilePayload[]
  images?: CivitaiImagePayload[]
}

interface CivitaiSearchResponse {
  items?: Array<CivitaiModelPayload & { modelVersions?: CivitaiVersionPayload[] }>
}

function buildPageUrl(modelId: number, modelVersionId: number | null): string {
  return modelVersionId == null
    ? `https://civitai.com/models/${modelId}`
    : `https://civitai.com/models/${modelId}?modelVersionId=${modelVersionId}`
}

function mapKindToCivitaiType(kind: RemoteModelKind): string {
  if (kind === 'checkpoint') {
    return 'Checkpoint'
  }
  if (kind === 'vae') {
    return 'VAE'
  }
  return 'LORA'
}

export class CivitaiClient {
  async getByHash(hash: string, apiKey?: string | null): Promise<CivitaiModelMatch | null> {
    const payload = await this.request<CivitaiVersionPayload>(`/model-versions/by-hash/${encodeURIComponent(hash)}`, apiKey)
    return this.toModelMatch(payload, 'hash', 'exact')
  }

  async getByVersion(versionId: number, apiKey?: string | null): Promise<CivitaiModelMatch | null> {
    const payload = await this.request<CivitaiVersionPayload>(`/model-versions/${versionId}`, apiKey)
    return this.toModelMatch(payload, 'version_id', 'exact')
  }

  async searchByName(query: string, kind: RemoteModelKind, apiKey?: string | null): Promise<CivitaiModelMatch | null> {
    const params = new URLSearchParams({
      query,
      limit: '10',
      types: mapKindToCivitaiType(kind),
    })
    const payload = await this.request<CivitaiSearchResponse>(`/models?${params.toString()}`, apiKey)
    const model = payload.items?.[0]
    const version = model?.modelVersions?.[0]
    if (!model || !version) {
      return null
    }

    return {
      source: 'name_guess',
      modelId: model.id ?? version.modelId ?? 0,
      modelVersionId: version.id ?? null,
      name: model.name ?? 'Unknown Model',
      versionName: version.name ?? null,
      modelType: model.type ?? null,
      rating: model.stats?.rating ?? null,
      downloadUrl: version.files?.[0]?.downloadUrl ?? null,
      thumbnailUrl: version.images?.[0]?.url ?? null,
      pageUrl: buildPageUrl(model.id ?? version.modelId ?? 0, version.id ?? null),
      confidence: 'guessed',
    }
  }

  async test(apiKey?: string | null): Promise<void> {
    await this.request<CivitaiSearchResponse>('/models?limit=1', apiKey)
  }

  private async request<T>(path: string, apiKey?: string | null): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (apiKey && apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${apiKey.trim()}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CIVITAI_REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${CIVITAI_API_BASE}${path}`, {
        headers,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CivitaiRequestError(`Civitai API 请求超时（>${CIVITAI_REQUEST_TIMEOUT_MS}ms）`, null)
      }

      throw new CivitaiRequestError(error instanceof Error ? error.message : String(error), null)
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const message = await response.text()
      throw new CivitaiRequestError(
        `Civitai API ${response.status}: ${message || response.statusText}`,
        response.status,
      )
    }

    return await response.json() as T
  }

  private toModelMatch(
    payload: CivitaiVersionPayload,
    source: CivitaiModelMatch['source'],
    confidence: CivitaiModelMatch['confidence'],
  ): CivitaiModelMatch | null {
    const modelId = payload.model?.id ?? payload.modelId
    if (!modelId || !payload.id) {
      return null
    }

    return {
      source,
      modelId,
      modelVersionId: payload.id ?? null,
      name: payload.model?.name ?? 'Unknown Model',
      versionName: payload.name ?? null,
      modelType: payload.model?.type ?? null,
      rating: payload.model?.stats?.rating ?? null,
      downloadUrl: payload.files?.[0]?.downloadUrl ?? null,
      thumbnailUrl: payload.images?.[0]?.url ?? null,
      pageUrl: buildPageUrl(modelId, payload.id ?? null),
      confidence,
    }
  }
}
