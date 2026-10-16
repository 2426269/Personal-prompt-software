import type {
  AppLogExportFormat,
  AppLogLevel,
  AppLogModule,
  AppLogRecord,
  AppLogSummary,
  AppLogTimeRange,
} from '@shared/types/logs'
import { useCallback, useEffect, useMemo, useState } from 'react'

import styles from './Logs.module.css'

const MODULE_OPTIONS: Array<AppLogModule | 'all'> = ['all', 'llm', 'comfy', 'civitai', 'ssh', 'remote_model', 'ipc', 'main']
const LEVEL_OPTIONS: Array<AppLogLevel | 'all'> = ['all', 'debug', 'info', 'warn', 'error']
const TIME_OPTIONS: AppLogTimeRange[] = ['1h', '24h', '7d', 'all']

function formatJson(value: unknown): string {
  return value == null ? '' : JSON.stringify(value, null, 2)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

function getLevelClass(level: AppLogLevel): string {
  if (level === 'error') return styles.levelError
  if (level === 'warn') return styles.levelWarn
  if (level === 'debug') return styles.levelDebug
  return styles.levelInfo
}

export function Logs() {
  const [moduleFilter, setModuleFilter] = useState<AppLogModule | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<AppLogLevel | 'all'>('all')
  const [timeRange, setTimeRange] = useState<AppLogTimeRange>('24h')
  const [query, setQuery] = useState('')
  const [logs, setLogs] = useState<AppLogRecord[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<AppLogSummary | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [selectedLog, setSelectedLog] = useState<AppLogRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [exportFormat, setExportFormat] = useState<AppLogExportFormat>('jsonl')

  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    setNotice('')
    try {
      const [logsRes, summaryRes] = await Promise.all([
        window.api.listLogs({
          module: moduleFilter,
          level: levelFilter,
          timeRange,
          query,
          limit: 200,
          offset: 0,
        }),
        window.api.getLogSummary({
          module: moduleFilter,
          level: levelFilter,
          timeRange,
          query,
        }),
      ])

      const logsData = logsRes.data
      const summaryData = summaryRes.data

      if (logsRes.success && logsData) {
        setLogs(logsData.items)
        setTotal(logsData.total)
        setSelectedId((prev) => {
          if (prev && logsData.items.some((item) => item.id === prev)) {
            return prev
          }
          return logsData.items[0]?.id ?? ''
        })
      } else {
        setNotice(logsRes.error?.message ?? '加载日志失败。')
      }

      if (summaryRes.success && summaryData) {
        setSummary(summaryData)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }, [levelFilter, moduleFilter, query, timeRange])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (!selectedId) {
      setSelectedLog(null)
      return
    }

    void (async () => {
      const response = await window.api.getLog({ id: selectedId })
      if (response.success) {
        setSelectedLog(response.data ?? null)
      }
    })()
  }, [selectedId])

  const selectedRequest = useMemo(() => formatJson(selectedLog?.requestJson ?? null), [selectedLog?.requestJson])
  const selectedResponse = useMemo(() => formatJson(selectedLog?.responseJson ?? null), [selectedLog?.responseJson])
  const selectedError = useMemo(() => formatJson(selectedLog?.errorJson ?? null), [selectedLog?.errorJson])

  const handleClear = async () => {
    const confirmed = window.confirm(moduleFilter === 'all' ? '确认清空全部日志？' : `确认清空 ${moduleFilter} 日志？`)
    if (!confirmed) {
      return
    }

    const res = await window.api.clearLogs({ module: moduleFilter })
    if (res.success && res.data) {
      setNotice(`已清空 ${res.data.deletedCount} 条日志。`)
      await loadLogs()
    } else {
      setNotice(res.error?.message ?? '清空日志失败。')
    }
  }

  const handleExport = async () => {
    const res = await window.api.exportLogs({
      module: moduleFilter,
      level: levelFilter,
      timeRange,
      query,
      format: exportFormat,
    })

    if (res.success && res.data) {
      setNotice(`已导出 ${res.data.recordCount} 条日志到 ${res.data.filePath}`)
    } else {
      setNotice(res.error?.message ?? '导出日志失败。')
    }
  }

  const copyBlock = async (value: string) => {
    if (!value) {
      return
    }
    await navigator.clipboard.writeText(value)
    setNotice('已复制到剪贴板。')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>诊断日志</h1>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={() => void loadLogs()}>刷新</button>
          <button className={styles.secondaryButton} onClick={() => void handleClear()}>清空日志</button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="搜索摘要、错误、请求内容..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value as AppLogModule | 'all')}>
          {MODULE_OPTIONS.map((item) => <option key={item} value={item}>{item === 'all' ? '全部模块' : item}</option>)}
        </select>
        <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as AppLogLevel | 'all')}>
          {LEVEL_OPTIONS.map((item) => <option key={item} value={item}>{item === 'all' ? '全部级别' : item}</option>)}
        </select>
        <select value={timeRange} onChange={(event) => setTimeRange(event.target.value as AppLogTimeRange)}>
          {TIME_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as AppLogExportFormat)}>
          <option value="jsonl">jsonl</option>
          <option value="json">json</option>
        </select>
        <button className={styles.primaryButton} onClick={() => void handleExport()}>导出日志</button>
      </div>

      {notice && <div className={styles.notice}>{notice}</div>}

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>最近问题</div>
          {summary?.problemTags.length ? summary.problemTags.slice(0, 8).map((item) => (
            <div key={item.key} className={styles.summaryRow}>
              <span>{item.key}</span>
              <span>{item.count}</span>
            </div>
          )) : <div className={styles.emptyText}>暂无问题标签</div>}
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>模块分布</div>
          {summary?.modules.length ? summary.modules.map((item) => (
            <div key={item.key} className={styles.summaryRow}>
              <span>{item.key}</span>
              <span>{item.count}</span>
            </div>
          )) : <div className={styles.emptyText}>暂无模块统计</div>}
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>当前筛选</div>
          <div className={styles.summaryRow}><span>总数</span><span>{total}</span></div>
          <div className={styles.summaryRow}><span>模块</span><span>{moduleFilter}</span></div>
          <div className={styles.summaryRow}><span>级别</span><span>{levelFilter}</span></div>
          <div className={styles.summaryRow}><span>时间</span><span>{timeRange}</span></div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.listPane}>
          {isLoading ? (
            <div className={styles.emptyText}>加载中...</div>
          ) : logs.length === 0 ? (
            <div className={styles.emptyText}>当前筛选条件下没有日志。</div>
          ) : logs.map((item) => (
            <button
              key={item.id}
              className={`${styles.logItem} ${selectedId === item.id ? styles.logItemActive : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <div className={styles.logItemTop}>
                <span className={`${styles.levelBadge} ${getLevelClass(item.level)}`}>{item.level}</span>
                <span className={styles.moduleBadge}>{item.module}</span>
                <span className={styles.timeText}>{formatDate(item.createdAt)}</span>
              </div>
              <div className={styles.logAction}>{item.action}</div>
              <div className={styles.logSummary}>{item.summary}</div>
            </button>
          ))}
        </div>

        <div className={styles.detailPane}>
          {!selectedLog ? (
            <div className={styles.emptyText}>选择一条日志查看详情。</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.detailTitle}>{selectedLog.summary}</div>
                  <div className={styles.detailMeta}>
                    <span>{selectedLog.module}</span>
                    <span>{selectedLog.level}</span>
                    <span>{formatDate(selectedLog.createdAt)}</span>
                    <span>{selectedLog.action}</span>
                  </div>
                </div>
                {selectedLog.tags.length > 0 && (
                  <div className={styles.tags}>
                    {selectedLog.tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
                  </div>
                )}
              </div>

              <section className={styles.block}>
                <div className={styles.blockHeader}>
                  <span>请求</span>
                  <button className={styles.inlineButton} onClick={() => void copyBlock(selectedRequest)}>复制</button>
                </div>
                <pre className={styles.code}>{selectedRequest || '无'}</pre>
              </section>

              <section className={styles.block}>
                <div className={styles.blockHeader}>
                  <span>响应</span>
                  <button className={styles.inlineButton} onClick={() => void copyBlock(selectedResponse)}>复制</button>
                </div>
                <pre className={styles.code}>{selectedResponse || '无'}</pre>
              </section>

              <section className={styles.block}>
                <div className={styles.blockHeader}>
                  <span>错误</span>
                  <button className={styles.inlineButton} onClick={() => void copyBlock(selectedError)}>复制</button>
                </div>
                <pre className={styles.code}>{selectedError || '无'}</pre>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
