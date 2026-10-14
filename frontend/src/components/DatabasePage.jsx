import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const alphabet = ['ALL', 'A', 'Ă', 'Â', 'B', 'C', 'D', 'Đ', 'E', 'Ê', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'Ô', 'Ơ', 'P', 'Q', 'R', 'S', 'T', 'U', 'Ư', 'V', 'X', 'Y']
const browseTabs = ['Diseases', 'Condition', 'Symptoms', 'Prevention', 'Uploaders']
const allBrowseTabs = [...browseTabs]
const pageSize = 10
const tabFieldMap = {
  Diseases: 'name',
  Condition: 'condition',
  Symptoms: 'symptoms',
  Prevention: 'prevention',
  Uploaders: 'created_by',
}
const tabApiFieldMap = {
  Diseases: 'name',
  Condition: 'condition',
  Symptoms: 'symptoms',
  Prevention: 'prevention',
  Uploaders: 'created_by',
}
const tabLabelMap = {
  Diseases: 'Tên bệnh',
  Condition: 'Điều kiện',
  Symptoms: 'Triệu chứng',
  Prevention: 'Phòng ngừa',
  Uploaders: 'Người tải lên',
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlightedText(text, normalizedQuery) {
  if (!text) {
    return 'Không có'
  }

  if (!normalizedQuery) {
    return text
  }

  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig')
  const parts = String(text).split(pattern)

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  )
}

function getSnippetWithMatch(text, normalizedQuery, maxLength = 170) {
  const safeText = String(text || '')
  if (!safeText || !normalizedQuery) {
    return safeText
  }

  const lowerText = safeText.toLowerCase()
  const index = lowerText.indexOf(normalizedQuery.toLowerCase())
  if (index < 0) {
    return safeText.slice(0, maxLength)
  }

  const context = Math.floor((maxLength - normalizedQuery.length) / 2)
  const start = Math.max(0, index - context)
  const end = Math.min(safeText.length, index + normalizedQuery.length + context)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < safeText.length ? '...' : ''
  return `${prefix}${safeText.slice(start, end)}${suffix}`
}

function DatabasePage({ currentUser }) {
  const [diseases, setDiseases] = useState([])
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [activeLetter, setActiveLetter] = useState('ALL')
  const [activeTabs, setActiveTabs] = useState(['Diseases', 'Condition', 'Symptoms', 'Prevention', 'Uploaders'])
  const [isFieldPickerOpen, setIsFieldPickerOpen] = useState(false)
  const [status, setStatus] = useState('Đang tải dữ liệu...')
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [totalResults, setTotalResults] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const canCreateDisease =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert'

  useEffect(() => {
    let isMounted = true

    async function loadDiseases() {
      try {
        const params = new URLSearchParams()
        if (query.trim()) {
          params.set('q', query.trim())
          params.set(
            'fields',
            activeTabs
              .map((tab) => tabApiFieldMap[tab])
              .filter(Boolean)
              .join(',')
          )
        }
        params.set('letter', activeLetter)
        params.set('page', String(page))
        params.set('page_size', String(pageSize))

        const endpoint = params.toString()
          ? `/api/wheat-diseases/?${params.toString()}`
          : '/api/wheat-diseases/'

        const response = await fetch(endpoint, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Could not load disease data.')
        }

        const data = await response.json()
        const results = Array.isArray(data?.results) ? data.results : []
        const count = Number.isFinite(data?.count) ? data.count : results.length
        const pages = Number.isFinite(data?.total_pages) ? data.total_pages : 1
        const currentPage = Number.isFinite(data?.current_page) ? data.current_page : page

        if (isMounted) {
          setDiseases(results)
          setTotalResults(count)
          setTotalPages(Math.max(1, pages))
          if (currentPage !== page) {
            setPage(currentPage)
          }
          setStatus(count > 0 ? '' : 'Chưa có bản ghi bệnh.')
        }
      } catch {
        if (isMounted) {
          setStatus('Hiện chưa thể tải cơ sở dữ liệu.')
        }
      }
    }

    loadDiseases()

    return () => {
      isMounted = false
    }
  }, [query, activeTabs, activeLetter, page])

  const normalizedQuery = query.trim().toLowerCase()
  const activeSearchFields = activeTabs.map((tab) => tabFieldMap[tab]).filter(Boolean)
  const selectedSearchLabel =
    activeTabs.length === allBrowseTabs.length
      ? 'tất cả thuộc tính'
      : activeTabs.map((tab) => tabLabelMap[tab] || tab).join(', ')
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [query, activeLetter, activeTabs])

  function applySearch() {
    setQuery(searchInput.trim())
  }

  function toggleTabFilter(tab) {
    setActiveTabs((currentTabs) => {
      if (currentTabs.includes(tab)) {
        return currentTabs.length === 1 ? currentTabs : currentTabs.filter((currentTab) => currentTab !== tab)
      }

      return [...currentTabs, tab]
    })
  }

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

  return (
    <main className="database-page database-page--browse">
      <section className="browse-shell">
        <header className="browse-header">
          <h2>Tra cứu bệnh lúa</h2>

          <form
            className="browse-search-row"
            onSubmit={(event) => {
              event.preventDefault()
              applySearch()
            }}
          >
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={`Tìm kiếm theo ${selectedSearchLabel}`}
            />
            <div className="browse-search-by">
              <button
                type="button"
                className="browse-search-by__toggle"
                aria-expanded={isFieldPickerOpen}
                onClick={() => setIsFieldPickerOpen((isOpen) => !isOpen)}
              >
                <span>{selectedSearchLabel}</span>
                <span aria-hidden="true">{isFieldPickerOpen ? '^' : 'v'}</span>
              </button>
              {isFieldPickerOpen ? (
                <fieldset className="browse-search-by__checks">
                  {browseTabs.map((tab) => (
                    <label key={tab} className="browse-search-by__check">
                      <input
                        type="checkbox"
                        checked={activeTabs.includes(tab)}
                        onChange={() => toggleTabFilter(tab)}
                      />
                      {tabLabelMap[tab] || tab}
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </div>
            <button type="submit" className="browse-search-button">
              Tìm kiếm
            </button>
          </form>

          <div className="browse-alphabet">
            {alphabet.map((letter) => (
              <button
                key={letter}
                type="button"
                className={letter === activeLetter ? 'browse-letter browse-letter--active' : 'browse-letter'}
                onClick={() => setActiveLetter(letter)}
              >
                {letter === 'ALL' ? 'Tất cả' : letter}
              </button>
            ))}
          </div>

          <p className="browse-results-count">
            {totalResults} kết quả
          </p>
        </header>

        <div className="browse-toolbar">
          <div className="browse-pagination">
            <button type="button" disabled={safePage === 1} onClick={() => setPage(1)}>1</button>
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
          <div className="browse-toolbar-actions">
            {canCreateDisease ? (
              <Link
                className="browse-add-disease-button"
                aria-label="Thêm bệnh lúa mới"
                title="Thêm bệnh lúa mới"
                to="/database/new"
              >
                <i className="fas fa-plus" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        {status ? <p className="database-status database-status--browse">{status}</p> : null}

        <div className="browse-table-wrap">
          <table className="browse-table">
            <thead>
              <tr>
                <th>Tên bệnh</th>
                <th className="browse-table__right">Cập nhật</th>
                <th className="browse-table__right">Người tải lên</th>
              </tr>
            </thead>
            <tbody>
              {diseases.length > 0 ? (
                diseases.map((disease) => (
                  (() => {
                    const matchedSnippets = normalizedQuery
                      ? activeSearchFields
                          .filter((field) => field !== 'name')
                          .map((field) => {
                            const rawValue = String(disease?.[field] || '')
                            if (!rawValue.toLowerCase().includes(normalizedQuery)) {
                              return null
                            }

                            return {
                              label: tabLabelMap[activeTabs.find((tab) => tabFieldMap[tab] === field)] || field,
                              snippet: getSnippetWithMatch(rawValue, normalizedQuery),
                            }
                          })
                          .filter(Boolean)
                      : []

                    return (
                      <tr key={disease.id}>
                        <td className="browse-title-cell">
                          <strong>
                            <Link className="browse-title-link" to={`/database/${disease.id}`}>
                              {renderHighlightedText(
                                disease.name,
                                activeSearchFields.includes('name') ? normalizedQuery : ''
                              )}
                            </Link>
                          </strong>
                          {matchedSnippets.map((item) => (
                            <span className="browse-match-snippet" key={`${disease.id}-${item.label}`}>
                              <em>{item.label}:</em>{' '}
                              {renderHighlightedText(item.snippet, normalizedQuery)}
                            </span>
                          ))}
                        </td>
                        <td className="browse-table__right">
                          {disease.updated_at ? disease.updated_at.slice(0, 10) : 'Không có'}
                        </td>
                        <td className="browse-table__right">
                          {disease.created_by || 'Wheat DB'}
                        </td>
                      </tr>
                    )
                  })()
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Không tìm thấy bệnh lúa phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default DatabasePage
