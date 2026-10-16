import { ipcMain } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  WorkflowBindInput,
  WorkflowCleanInput,
  WorkflowCleanResult,
  WorkflowDetail,
  WorkflowExportInput,
  WorkflowListParams,
  WorkflowRefreshInput,
  WorkflowSetDefaultInput,
  WorkflowSlotMapGuessInput,
  WorkflowSlotMapItem,
  WorkflowSlotMapSaveInput,
  WorkflowSummary,
  WorkflowUnbindInput,
} from '@shared/types/workflow'

import { WorkflowsService } from '../services/workflow/workflows.service'
import { wrapIPC } from './wrap-ipc'

export function registerWorkflowsIPC(): () => void {
  const workflowsService = new WorkflowsService()

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_LIST, async (_event, payload?: WorkflowListParams) =>
    wrapIPC<WorkflowSummary[]>(() => workflowsService.list(payload), { channel: IPC_CHANNELS.WORKFLOW_LIST, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_GET, async (_event, payload: { id: string }) =>
    wrapIPC<WorkflowDetail | null>(() => workflowsService.get(payload.id), { channel: IPC_CHANNELS.WORKFLOW_GET, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_CLEAN, async (_event, payload: WorkflowCleanInput) =>
    wrapIPC<WorkflowCleanResult>(() => workflowsService.clean(payload), { channel: IPC_CHANNELS.WORKFLOW_CLEAN, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_REFRESH, async (_event, payload: WorkflowRefreshInput) =>
    wrapIPC<WorkflowDetail>(() => workflowsService.refresh(payload), { channel: IPC_CHANNELS.WORKFLOW_REFRESH, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_EXPORT, async (_event, payload: WorkflowExportInput) =>
    wrapIPC<string>(() => workflowsService.export(payload), { channel: IPC_CHANNELS.WORKFLOW_EXPORT, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_SET_DEFAULT, async (_event, payload: WorkflowSetDefaultInput) =>
    wrapIPC<boolean>(() => workflowsService.setDefault(payload), { channel: IPC_CHANNELS.WORKFLOW_SET_DEFAULT, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_BIND, async (_event, payload: WorkflowBindInput) =>
    wrapIPC<boolean>(() => workflowsService.bind(payload), { channel: IPC_CHANNELS.WORKFLOW_BIND, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.WORKFLOW_UNBIND, async (_event, payload: WorkflowUnbindInput) =>
    wrapIPC<boolean>(() => workflowsService.unbind(payload), { channel: IPC_CHANNELS.WORKFLOW_UNBIND, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.SLOTMAP_GUESS, async (_event, payload: WorkflowSlotMapGuessInput) =>
    wrapIPC<WorkflowSlotMapItem[]>(() => workflowsService.guessSlotMap(payload), { channel: IPC_CHANNELS.SLOTMAP_GUESS, payload }),
  )

  ipcMain.handle(IPC_CHANNELS.SLOTMAP_SAVE, async (_event, payload: WorkflowSlotMapSaveInput) =>
    wrapIPC<WorkflowDetail>(() => workflowsService.saveSlotMap(payload), { channel: IPC_CHANNELS.SLOTMAP_SAVE, payload }),
  )

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_LIST)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_GET)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_CLEAN)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_REFRESH)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_EXPORT)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_SET_DEFAULT)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_BIND)
    ipcMain.removeHandler(IPC_CHANNELS.WORKFLOW_UNBIND)
    ipcMain.removeHandler(IPC_CHANNELS.SLOTMAP_GUESS)
    ipcMain.removeHandler(IPC_CHANNELS.SLOTMAP_SAVE)
  }
}
