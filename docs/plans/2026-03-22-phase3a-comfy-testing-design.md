# Phase 3A ComfyUI Testing Design

## Scope

Implement Phase 3A only:

- `C-3.6` ComfyUI client
- `C-3.7` prompt injection engine
- `C-3.8` connection status, polling, timeout, cancel
- `A-3.10` `/testing` page UI

Exclude Phase 3B/3C from this iteration.

## Constraints

- Reuse the existing `workflows` and `entry_workflow_binding` data.
- Do not introduce remote profile persistence yet; the testing page carries connection inputs locally.
- Prefer a reliable HTTP polling flow over a WebSocket-first implementation.
- Only submit workflows that have an executable API prompt payload:
  - `api_prompt_json`, or
  - `original_json` when the stored workflow is already `api_prompt`
- UI workflows without executable API payload are surfaced as non-runnable with a clear reason.

## Backend Design

### Shared Types

Add `src/shared/types/comfy.ts` for:

- connection input/result
- submit input/result
- queue status input/result
- cancel input/result
- generated image descriptors

### Main Process

Add:

- `src/main/services/comfy/comfy-client.ts`
- `src/main/services/comfy/prompt-injection-engine.ts`
- `src/main/services/comfy/comfy-service.ts`
- `src/main/ipc/comfy.ipc.ts`

#### ComfyUIClient

Responsibilities:

- normalize base URL
- `GET /system_stats`
- `GET /queue`
- `POST /prompt`
- `GET /history/{prompt_id}`
- `POST /interrupt`
- build result image URLs from `/view`

#### PromptInjectionEngine

Responsibilities:

- load workflow executable JSON
- apply `slot_map_json`
- inject:
  - positive prompt
  - negative prompt
  - sampler overrides (`seed`, `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise`)
  - optional checkpoint override
- reject workflows without prompt slots

#### ComfyService

Responsibilities:

- `testConnection`
- `submit`
- `getQueueStatus`
- `cancel`
- select workflow payload in this order:
  1. `api_prompt_json`
  2. `original_json` if workflow format is `api_prompt`
- derive default example images from selected entry

## Frontend Design

Replace the `/testing` placeholder with a complete single-page tester:

- top connection panel
- left rail:
  - entry selector
  - workflow selector
  - workflow capability notice
- main editor:
  - positive prompt
  - negative prompt
  - seed / steps / cfg / sampler / scheduler / checkpoint
- right result panel:
  - connection status
  - queue status
  - prompt id
  - generated results
  - source example image gallery

## Error Handling

- invalid URL / network timeout
- non-ComfyUI service response
- non-runnable workflow (missing executable payload)
- prompt submit failure
- polling timeout
- failed history status

Every renderer error should come from structured IPC responses rather than uncaught exceptions.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Manual smoke target:

1. open `/testing`
2. fill Comfy base URL
3. test connection
4. choose a runnable workflow
5. submit
6. observe queued/running/completed
7. view generated images
