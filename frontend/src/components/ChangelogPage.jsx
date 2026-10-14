import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const pageSize = 10

function formatDate(value) {
  if (!value) {
    return 'Không có'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function normalizeStoredLogMessage(message) {
  const text = String(message || '').trim()

  if (!text) {
    return ''
  }

  const normalized = text.toLowerCase()

  if (normalized === 'wheat disease image move.') {
    return 'Đã chuyển hình ảnh.'
  }
  if (normalized === 'wheat disease image label update.') {
    return 'Đã cập nhật dữ liệu đặc tả của hình ảnh.'
  }
  if (normalized === 'wheat disease image create.') {
    return 'Đã thêm hình ảnh.'
  }
  if (normalized === 'wheat disease image delete.') {
    return 'Đã xóa hình ảnh.'
  }
  if (normalized === 'wheat disease image bulk upload.') {
    return 'Đã tải lên hình ảnh.'
  }
  if (normalized === 'wheat disease image unlabeled upload.') {
    return 'Đã tải lên hình ảnh chưa gán nhãn.'
  }
  if (normalized === 'wheat disease image bulk delete.') {
    return 'Đã xóa hình ảnh.'
  }
  if (normalized.startsWith('wheat disease image ') && normalized.endsWith('.')) {
    return 'Đã cập nhật hình ảnh.'
  }
  if (normalized.startsWith('wheat disease ') && normalized.endsWith('.')) {
    return 'Đã cập nhật bệnh lúa.'
  }

  return text.replaceAll('lúa mì', 'lúa').replaceAll('Lúa mì', 'Lúa')
}

function getLogMessage(log) {
  if (log.message) {
    return normalizeStoredLogMessage(log.message)
  }

  const action = log?.action || ''
  const resourceType = String(log?.resource_type || '').replaceAll('_', ' ').trim()
  const resourceId = log?.resource_id ? ` #${log.resource_id}` : ''
  const changes = log?.changes && typeof log.changes === 'object' ? log.changes : {}
  const before = changes.before && typeof changes.before === 'object' ? changes.before : {}
  const after = changes.after && typeof changes.after === 'object' ? changes.after : {}


  //return message
  if (action === 'wheat_disease.create') {
    return `Đã tạo bệnh lúa "${after.name || before.name || resourceId.trim() || 'mục'}".`
  }
  if (action === 'wheat_disease.update' || action === 'wheat_disease.replace') {
    return `Đã cập nhật bệnh lúa "${after.name || before.name || resourceId.trim() || 'mục'}".`
  }
  if (action === 'wheat_disease.delete') {
    return `Đã xóa bệnh lúa "${before.name || resourceId.trim() || 'mục'}".`
  }
  if (action === 'wheat_disease_image.bulk_upload') {
    const count = changes.uploaded_count
    const diseaseId = changes.disease_id ? `#${changes.disease_id}` : 'mục'
    return count
      ? `Đã tải lên ${count} hình ảnh cho bệnh lúa ${diseaseId}.`
      : `Đã tải lên hình ảnh cho bệnh lúa ${diseaseId}.`
  }
  if (action === 'wheat_disease_image.unlabeled_upload') {
    const count = changes.uploaded_count
    return count ? `Đã tải lên ${count} hình ảnh chưa gán nhãn.` : 'Đã tải lên hình ảnh chưa gán nhãn.'
  }
  if (action === 'wheat_disease_image.bulk_delete') {
    const count = changes.deleted_count
    const deletedByDisease = changes.deleted_by_disease || {}
    if (count && Object.keys(deletedByDisease).length === 1 && deletedByDisease.unlabeled) {
      return `Đã xóa ${count} hình ảnh chưa gán nhãn.`
    }
    return count ? `Đã xóa ${count} hình ảnh.` : 'Đã xóa hình ảnh.'
  }
  if (action === 'wheat_disease_image.create') {
    const diseaseId = changes.disease_id ? `#${changes.disease_id}` : 'mục'
    return `Đã thêm hình ảnh vào bệnh lúa ${diseaseId}.`
  }
  if (action === 'wheat_disease_image.delete') {
    const diseaseId = changes.disease_id ? `#${changes.disease_id}` : 'mục'
    return `Đã xóa hình ảnh khỏi bệnh lúa ${diseaseId}.`
  }
  if (action === 'wheat_disease_image.move') {
    if (changes.healthy) {
      return 'Đã chuyển hình ảnh vào thư viện khỏe mạnh.'
    }
    const diseaseId = changes.disease_id ? `#${changes.disease_id}` : ''
    return diseaseId ? `Đã chuyển hình ảnh vào bệnh lúa ${diseaseId}.` : 'Đã chuyển hình ảnh.'
  }
  if (action === 'wheat_disease_image.label_update') {
    return 'Đã cập nhật dữ liệu đặc tả của hình ảnh.'
  }
  if (action === 'user.role_update') {
    return `Đã đổi vai trò người dùng từ ${before.role || 'không rõ'} sang ${after.role || 'không rõ'}.`
  }
  if (action === 'user.update' || action === 'user.replace') {
    return `Đã cập nhật người dùng "${after.username || before.username || resourceId.trim() || 'hồ sơ'}".`
  }
  if (action === 'user.delete') {
    return `Đã xóa người dùng "${before.username || resourceId.trim() || 'bản ghi'}".`
  }

  if (action) {
    return action.replaceAll('_', ' ').replaceAll('.', ' ').trim().replace(/^\w/, (c) => c.toUpperCase()) + '.'
  }

  if (resourceType) {
    return `Đã cập nhật ${resourceType}${resourceId}.`
  }

  return 'Đã cập nhật dữ liệu'
}

function formatDiffValue(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return 'Không có'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function renderDiffValue(beforeValue, afterValue, mode) {
  const beforeText = formatDiffValue(beforeValue)
  const afterText = formatDiffValue(afterValue)
  const source = mode === 'before' ? beforeText : afterText

  if (beforeText === afterText) {
    return source
  }

  let prefixLen = 0
  while (
    prefixLen < beforeText.length &&
    prefixLen < afterText.length &&
    beforeText[prefixLen] === afterText[prefixLen]
  ) {
    prefixLen += 1
  }

  let suffixLen = 0
  while (
    suffixLen < beforeText.length - prefixLen &&
    suffixLen < afterText.length - prefixLen &&
    beforeText[beforeText.length - 1 - suffixLen] === afterText[afterText.length - 1 - suffixLen]
  ) {
    suffixLen += 1
  }

  const prefix = source.slice(0, prefixLen)
  const changedPart = source.slice(prefixLen, source.length - suffixLen)
  const suffix = source.slice(source.length - suffixLen)

  if (!changedPart) {
    return source
  }

  return (
    <>
      {prefix}
      <mark className={mode === 'before' ? 'changelog-diff-inline changelog-diff-inline--removed' : 'changelog-diff-inline changelog-diff-inline--added'}>
        {changedPart}
      </mark>
      {suffix}
    </>
  )
}

function getDiffRows(log) {
  const changes = log?.changes && typeof log.changes === 'object' ? log.changes : {}
  const before = changes.before && typeof changes.before === 'object' ? changes.before : {}
  const after = changes.after && typeof changes.after === 'object' ? changes.after : {}
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))

  return keys
    .filter((key) => !['created_at', 'created_by', 'updated_at'].includes(key))
    .map((key) => ({
      key,
      before: before[key],
      after: after[key],
      changed: formatDiffValue(before[key]) !== formatDiffValue(after[key]),
    }))
    .filter((row) => row.changed)
}

function ChangelogPage({ currentUser }) {
  //State
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('Đang tải nhật ký thay đổi...')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [selectedLog, setSelectedLog] = useState(null)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    actor: '',
    change: '',
  })
  const [filterDraft, setFilterDraft] = useState({
    dateFrom: '',
    dateTo: '',
    actor: '',
    change: '',
  })
  const safePage = Math.min(page, totalPages)
  const hasTechnicalDetails = logs.some((log) => {
    const changes = log?.changes
    return Boolean(changes && (changes.before || changes.after))
  })

  useEffect(() => {
    let isMounted = true

    async function loadChangelog() {
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))
        if (filters.dateFrom) {
          params.set('date_from', filters.dateFrom)
        }
        if (filters.dateTo) {
          params.set('date_to', filters.dateTo)
        }
        if (filters.actor.trim()) {
          params.set('actor', filters.actor.trim())
        }
        if (filters.change.trim()) {
          params.set('change', filters.change.trim())
        }

        const endpoint = params.toString()
          ? `/api/changelog/?${params.toString()}`
          : '/api/changelog/'

        const response = await fetch(endpoint, {
          credentials: 'include',
        })
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu nhật ký thay đổi.')
        }

        const data = await response.json()
        const results = Array.isArray(data?.results) ? data.results : []
        const count = Number.isFinite(data?.count) ? data.count : results.length
        const pages = Number.isFinite(data?.total_pages) ? data.total_pages : 1
        const currentPage = Number.isFinite(data?.current_page) ? data.current_page : page

        if (isMounted) {
          setLogs(results)
          setTotalResults(count)
          setTotalPages(Math.max(1, pages))
          if (currentPage !== page) {
            setPage(currentPage)
          }
          setStatus(count > 0 ? '' : 'Chưa có mục nhật ký thay đổi.')
        }
      } catch {
        if (isMounted) {
          setStatus('Hiện chưa thể tải nhật ký thay đổi.')
        }
      }
    }

    loadChangelog()

    return () => {
      isMounted = false
    }
  }, [page, filters])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setPageInput(String(safePage))
  }, [safePage])

  function jumpToPage(value) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      setPageInput(String(safePage))
      return
    }

    const clamped = Math.min(totalPages, Math.max(1, parsed))
    setPage(clamped)
    setPageInput(String(clamped))
  }

  function updateFilterDraft(field, value) {
    setFilterDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setPage(1)
    setFilters({
      dateFrom: filterDraft.dateFrom,
      dateTo: filterDraft.dateTo,
      actor: filterDraft.actor.trim(),
      change: filterDraft.change.trim(),
    })
  }

  function clearFilters() {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      actor: '',
      change: '',
    }
    setFilterDraft(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
  }

  function renderPagination() {
    return (
      <div className="browse-toolbar changelog-pagination-toolbar">
        <div className="browse-pagination users-list-pagination">
          <button type="button" disabled={safePage === 1} onClick={() => setPage(1)}>
            1
          </button>
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
            trước
          </button>
          <input
            type="number"
            className="browse-pagination__input"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(event) => {
              setPageInput(event.target.value)
              if (/^\d+$/.test(event.target.value)) {
                jumpToPage(event.target.value)
              }
            }}
            onBlur={() => jumpToPage(pageInput)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                jumpToPage(pageInput)
              }
            }}
            aria-label="Trang hiện tại"
          />
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))}>
            tiếp
          </button>
          <span>{totalPages}</span>
        </div>
      </div>
    )
  }

  return (
    <main className="users-list-page">
      <section className="users-list-card changelog-card">
        <div className="users-list-head">
          <h2>Nhật ký thay đổi</h2>
          <Link className="disease-detail-back" to="/database">
            Quay lại cơ sở dữ liệu
          </Link>
        </div>

        <p className="browse-results-count">
          {totalResults} mục
        </p>

        <form className="changelog-filters" onSubmit={applyFilters}>
          <div className="changelog-filters__dates">
            <label>
              Từ ngày
              <input
                type="date"
                value={filterDraft.dateFrom}
                onChange={(event) => updateFilterDraft('dateFrom', event.target.value)}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={filterDraft.dateTo}
                onChange={(event) => updateFilterDraft('dateTo', event.target.value)}
              />
            </label>
          </div>
          <label>
            Người thực hiện
            <input
              type="search"
              value={filterDraft.actor}
              onChange={(event) => updateFilterDraft('actor', event.target.value)}
              placeholder="Tìm người thực hiện"
            />
          </label>
          <label>
            Thay đổi
            <select value={filterDraft.change} onChange={(event) => updateFilterDraft('change', event.target.value)}>
              <option value="">Tất cả thay đổi</option>
              <option value="create">Tạo mới</option>
              <option value="update">Cập nhật</option>
              <option value="delete">Xóa</option>
            </select>
          </label>
          <div className="changelog-filters__actions">
            <button type="submit" className="primary-btn">
              tìm kiếm
            </button>
            <button type="button" className="secondary-btn" onClick={clearFilters}>
              xóa tìm kiếm
            </button>
          </div>
        </form>

        {status ? <p className="database-status">{status}</p> : null}

        {!status ? (
          <>
            <div className="users-list-table-wrap">
              <table className="users-list-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Thay đổi</th>
                    {hasTechnicalDetails ? <th>Chi tiết</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.created_at)}</td>
                      <td>{log.actor_username || 'hệ thống'}</td>
                      <td>{getLogMessage(log)}</td>
                      {hasTechnicalDetails ? (
                        <td>
                          {log?.changes && (log.changes.before || log.changes.after) ? (
                            <button
                              type="button"
                              className="users-list-role-save"
                              onClick={() => setSelectedLog(log)}
                            >
                              Xem
                            </button>
                          ) : (
                            'Không có'
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        ) : null}
      </section>

      {selectedLog ? (
        <div className="changelog-modal-backdrop" role="dialog" aria-modal="true" aria-label="Chi tiết phiên bản">
          <section className="changelog-modal">
            {(() => {
              const diffRows = getDiffRows(selectedLog)

              return (
                <>
            <div className="changelog-modal__head">
              <h3>Chi tiết phiên bản</h3>
              <button type="button" className="users-list-role-cancel" onClick={() => setSelectedLog(null)}>
                Đóng
              </button>
            </div>
            <p className="changelog-modal__meta">
              Bởi {selectedLog.actor_username || 'hệ thống'} vào {formatDate(selectedLog.created_at)}
            </p>
            {diffRows.length > 0 ? (
              <table className="changelog-diff-table">
                <thead>
                  <tr>
                    <th>Trường</th>
                    <th>Trước</th>
                    <th>Sau</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      <td className="changelog-diff-table__changed">
                        {renderDiffValue(row.before, row.after, 'before')}
                      </td>
                      <td className="changelog-diff-table__changed">
                        {renderDiffValue(row.before, row.after, 'after')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="database-status">Không có thay đổi chi tiết t cho hành động này.</p>
            )}
                </>
              )
            })()}
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default ChangelogPage
