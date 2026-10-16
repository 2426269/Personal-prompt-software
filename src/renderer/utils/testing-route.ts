export type TestingMode = 'comfy' | 'nai'
export type TestingPromptSource = 'entry' | 'preset' | 'anima' | 'spellbook'

export interface TestingRouteIntent {
  mode?: TestingMode
  promptSource?: TestingPromptSource
  entryId?: string | null
  imageIndex?: number | null
  workflowId?: string | null
  presetId?: string | null
  animaArtistIds?: string[] | null
  spellbookEntryId?: string | null
}

export function buildTestingSearch(intent: TestingRouteIntent): string {
  const params = new URLSearchParams()

  if (intent.mode) {
    params.set('mode', intent.mode)
  }

  if (intent.promptSource) {
    params.set('promptSource', intent.promptSource)
  }

  if (intent.entryId) {
    params.set('entryId', intent.entryId)
  }

  if (intent.imageIndex != null && Number.isFinite(intent.imageIndex)) {
    params.set('imageIndex', String(intent.imageIndex))
  }

  if (intent.workflowId) {
    params.set('workflowId', intent.workflowId)
  }

  if (intent.presetId) {
    params.set('presetId', intent.presetId)
  }

  if (intent.animaArtistIds?.length) {
    params.set('animaArtistIds', intent.animaArtistIds.join(','))
  }

  if (intent.spellbookEntryId) {
    params.set('spellbookEntryId', intent.spellbookEntryId)
  }

  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}
