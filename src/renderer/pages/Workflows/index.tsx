import type { EntryListItem } from '@shared/types/entry'
import type { WorkflowBindingTarget, WorkflowDetail, WorkflowExportType, WorkflowSummary } from '@shared/types/workflow'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { buildTestingSearch } from '@renderer/utils/testing-route'

import styles from './Workflows.module.css'

type WorkflowView = 'original' | 'clean' | 'api_prompt' | 'slot_map'

function matchesWorkflow(workflow: WorkflowSummary, sourceTitle: string, query: string): boolean {
  if (!query) {
    return true
  }

  const normalized = query.trim().toLowerCase()
  return [workflow.name, workflow.format, sourceTitle, workflow.notes ?? '', workflow.nonRunnableReason ?? '']
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

function mapViewToExport(view: WorkflowView): WorkflowExportType {
  if (view === 'slot_map') {
    return 'slot_map'
  }
  return view
}

export function Workflows() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialWorkflowId = searchParams.get('workflowId') ?? null

  const [entries, setEntries] = useState<EntryListItem[]>([])
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(initialWorkflowId)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null)
  const [view, setView] = useState<WorkflowView>('clean')
  const [bindingTarget, setBindingTarget] = useState<WorkflowBindingTarget>('preferred_test')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSavingDefault, setIsSavingDefault] = useState(false)
  const [isBinding, setIsBinding] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        setIsLoadingList(true)
        const [workflowRes, entryRes] = await Promise.all([
          window.api.listWorkflows(),
          window.api.listEntries({
            page: 1,
            pageSize: 500,
            sortBy: 'updated_at',
            sortOrder: 'desc',
          }),
        ])

        if (cancelled) {
          return
        }

        if (!workflowRes.success || !workflowRes.data) {
          setError(workflowRes.error?.message ?? '工作流列表加载失败。')
          return
        }

        const workflowItems = workflowRes.data
        setWorkflows(workflowItems)
        setSelectedWorkflowId((current) => current ?? workflowItems[0]?.id ?? null)

        if (entryRes.success && entryRes.data) {
          setEntries(entryRes.data.items)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingList(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!selectedWorkflowId) {
        setSelectedWorkflow(null)
        return
      }

      try {
        setIsLoadingDetail(true)
        const res = await window.api.getWorkflow(selectedWorkflowId)
        if (cancelled) {
          return
        }

        if (!res.success) {
          setError(res.error?.message ?? '工作流详情加载失败。')
          return
        }

        setSelectedWorkflow(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false)
        }
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [selectedWorkflowId])

  const entryTitleMap = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry.displayTitle])),
    [entries],
  )

  const filteredWorkflows = useMemo(
    () =>
      workflows.filter((workflow) =>
        matchesWorkflow(workflow, entryTitleMap.get(workflow.derivedFromEntryId ?? '') ?? workflow.derivedFromEntryId ?? '未绑定来源', search),
      ),
    [entryTitleMap, search, workflows],
  )

  useEffect(() => {
    if (!filteredWorkflows.length) {
      return
    }

    if (!selectedWorkflowId || !filteredWorkflows.some((item) => item.id === selectedWorkflowId)) {
      setSelectedWorkflowId(filteredWorkflows[0].id)
    }
  }, [filteredWorkflows, selectedWorkflowId])

  const currentViewContent = useMemo(() => {
    if (!selectedWorkflow) {
      return ''
    }

    if (view === 'original') {
      return selectedWorkflow.originalJson
    }
    if (view === 'clean') {
      return selectedWorkflow.cleanJson ?? ''
    }
    if (view === 'api_prompt') {
      return selectedWorkflow.apiPromptJson ?? ''
    }

    return JSON.stringify(selectedWorkflow.slotMap, null, 2)
  }, [selectedWorkflow, view])

  const sourceEntryTitle = selectedWorkflow?.derivedFromEntryId
    ? entryTitleMap.get(selectedWorkflow.derivedFromEntryId) ?? selectedWorkflow.derivedFromEntryId
    : '未绑定来源条目'

  const handleRefreshWorkflow = async () => {
    if (!selectedWorkflow) {
      return
    }

    try {
      setIsRefreshing(true)
      const res = await window.api.refreshWorkflow({ workflowId: selectedWorkflow.id })
      if (!res.success || !res.data) {
        setError(res.error?.message ?? '重新净化失败。')
        return
      }

      setSelectedWorkflow(res.data)
      setWorkflows((prev) => prev.map((item) => (item.id === res.data!.id ? res.data! : item)))
      setView('clean')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSetDefault = async (nextValue: boolean) => {
    if (!selectedWorkflow) {
      return
    }

    try {
      setIsSavingDefault(true)
      const res = await window.api.setDefaultWorkflow({ workflowId: selectedWorkflow.id, isDefault: nextValue })
      if (!res.success) {
        setError(res.error?.message ?? '默认工作流设置失败。')
        return
      }

      const workflowRes = await window.api.listWorkflows()
      if (workflowRes.success && workflowRes.data) {
        setWorkflows(workflowRes.data)
      }

      const detailRes = await window.api.getWorkflow(selectedWorkflow.id)
      if (detailRes.success) {
        setSelectedWorkflow(detailRes.data ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSavingDefault(false)
    }
  }

  const handleBind = async (shouldBind: boolean) => {
    if (!selectedWorkflow?.derivedFromEntryId) {
      return
    }

    try {
      setIsBinding(true)
      const res = shouldBind
        ? await window.api.bindWorkflow({
            entryId: selectedWorkflow.derivedFromEntryId,
            workflowId: selectedWorkflow.id,
            target: bindingTarget,
          })
        : await window.api.unbindWorkflow({
            entryId: selectedWorkflow.derivedFromEntryId,
            target: bindingTarget,
          })

      if (!res.success) {
        setError(res.error?.message ?? `${shouldBind ? '绑定' : '解绑'}失败。`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBinding(false)
    }
  }

  const handleExport = async () => {
    if (!selectedWorkflow) {
      return
    }

    const exportType = mapViewToExport(view)
    const res = await window.api.exportWorkflow({
      workflowId: selectedWorkflow.id,
      type: exportType,
    })

    if (!res.success) {
      setError(res.error?.message ?? '导出失败。')
      return
    }

    alert(`已导出到：${res.data}`)
  }

  const handleCopy = async () => {
    if (!currentViewContent) {
      return
    }

    await navigator.clipboard.writeText(currentViewContent)
    alert('当前视图内容已复制到剪贴板')
  }

  if (isLoadingList) {
    return <div className={styles.stateShell}>⏳ 正在加载工作流库...</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>工作流管理台</h1>
          <p className={styles.subtitle}>查看 Original / Clean / API Prompt / SlotMap，绑定来源条目，并一键送去测试。</p>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>工作流总数</span>
            <strong>{workflows.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>当前筛选</span>
            <strong>{filteredWorkflows.length}</strong>
          </div>
        </div>
      </header>

      <section className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <input
              className={styles.searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索工作流名 / 来源条目 / 格式"
            />
          </div>

          <div className={styles.sidebarCard}>
            <div className={styles.sidebarMeta}>共 {filteredWorkflows.length} 条工作流</div>
            <div className={styles.workflowList}>
              {filteredWorkflows.map((workflow) => (
                <button
                  key={workflow.id}
                  className={`${styles.workflowItem} ${workflow.id === selectedWorkflowId ? styles.workflowItemActive : ''}`}
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                >
                  <div className={styles.workflowItemHeader}>
                    <div className={styles.workflowName}>{workflow.name}</div>
                    {workflow.isDefaultTest && <span className={styles.inlineBadge}>默认</span>}
                  </div>
                  <div className={styles.workflowMeta}>
                    {entryTitleMap.get(workflow.derivedFromEntryId ?? '') ?? workflow.derivedFromEntryId ?? '未绑定来源'}
                  </div>
                  <div className={styles.workflowMeta}>
                    {workflow.format} · {workflow.nodeCount} nodes · {workflow.runnable ? '可执行' : '仅查看'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className={styles.detailPanel}>
          {!selectedWorkflowId ? (
            <div className={styles.stateShell}>没有可展示的工作流。</div>
          ) : isLoadingDetail || !selectedWorkflow ? (
            <div className={styles.stateShell}>⏳ 正在加载工作流详情...</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailMeta}>来源：{sourceEntryTitle}</div>
                  <h2 className={styles.detailTitle}>{selectedWorkflow.name}</h2>
                  <div className={styles.detailMeta}>
                    {selectedWorkflow.format} · {selectedWorkflow.nodeCount} nodes · 更新于 {formatTime(selectedWorkflow.updatedAt)}
                  </div>
                </div>

                <div className={styles.actionGroup}>
                  <button className={styles.secondaryButton} onClick={() => void handleCopy()} disabled={!currentViewContent}>
                    复制当前视图
                  </button>
                  <button className={styles.secondaryButton} onClick={() => void handleExport()} disabled={!currentViewContent}>
                    导出当前视图
                  </button>
                  <button className={styles.secondaryButton} onClick={() => void handleRefreshWorkflow()} disabled={isRefreshing}>
                    {isRefreshing ? '净化中...' : '重新净化'}
                  </button>
                  <button
                    className={styles.primaryButton}
                    onClick={() =>
                      void navigate({
                        pathname: '/testing',
                        search: buildTestingSearch({
                          mode: 'comfy',
                          workflowId: selectedWorkflow.id,
                          entryId: selectedWorkflow.derivedFromEntryId,
                        }),
                      })
                    }
                    disabled={!selectedWorkflow.runnable}
                  >
                    发送到测试页
                  </button>
                </div>
              </div>

              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.infoGrid}>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>可执行状态</div>
                  <div className={styles.infoValue}>{selectedWorkflow.runnable ? '可执行 API prompt' : '仅可查看'}</div>
                  {!selectedWorkflow.runnable && selectedWorkflow.nonRunnableReason && (
                    <div className={styles.infoHint}>{selectedWorkflow.nonRunnableReason}</div>
                  )}
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>默认测试工作流</div>
                  <div className={styles.toggleRow}>
                    <button
                      className={selectedWorkflow.isDefaultTest ? styles.primaryButton : styles.secondaryButton}
                      onClick={() => void handleSetDefault(!selectedWorkflow.isDefaultTest)}
                      disabled={isSavingDefault}
                    >
                      {selectedWorkflow.isDefaultTest ? '取消默认' : '设为默认'}
                    </button>
                  </div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>来源条目绑定</div>
                  <div className={styles.bindRow}>
                    <select
                      className={styles.select}
                      value={bindingTarget}
                      onChange={(event) => setBindingTarget(event.target.value as WorkflowBindingTarget)}
                      disabled={!selectedWorkflow.derivedFromEntryId}
                    >
                      <option value="preferred_test">preferred_test</option>
                      <option value="original">original</option>
                      <option value="clean">clean</option>
                    </select>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => void handleBind(true)}
                      disabled={!selectedWorkflow.derivedFromEntryId || isBinding}
                    >
                      绑定
                    </button>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => void handleBind(false)}
                      disabled={!selectedWorkflow.derivedFromEntryId || isBinding}
                    >
                      解绑
                    </button>
                  </div>
                  {selectedWorkflow.derivedFromEntryId && (
                    <button
                      className={styles.linkButton}
                      onClick={() => void navigate(`/entry/${selectedWorkflow.derivedFromEntryId}`)}
                    >
                      打开来源详情
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.viewTabs}>
                {(['original', 'clean', 'api_prompt', 'slot_map'] as WorkflowView[]).map((tab) => (
                  <button
                    key={tab}
                    className={tab === view ? styles.viewTabActive : styles.viewTab}
                    onClick={() => setView(tab)}
                    disabled={
                      (tab === 'clean' && !selectedWorkflow.cleanJson) ||
                      (tab === 'api_prompt' && !selectedWorkflow.apiPromptJson)
                    }
                  >
                    {tab === 'original'
                      ? 'Original'
                      : tab === 'clean'
                        ? 'Clean'
                        : tab === 'api_prompt'
                          ? 'API Prompt'
                          : 'SlotMap'}
                  </button>
                ))}
              </div>

              <pre className={styles.codeBlock}>{currentViewContent || '当前视图没有可显示的内容。'}</pre>
            </>
          )}
        </main>
      </section>
    </div>
  )
}
