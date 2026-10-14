import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const pageSize = 10 
const roleLabels = {
  user: 'Người dùng',
  helper: 'Hỗ trợ viên',
  expert: 'Chuyên gia',
  admin: 'Quản trị viên',
  adim: 'Quản trị viên',
}

function formatRole(role) {
  return roleLabels[role] || role || 'Không có'
}

function UsersListPage({ currentUser }) {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('Đang tải người dùng...')
  const [actionStatus, setActionStatus] = useState('')
  const [draftRoles, setDraftRoles] = useState({})
  const [savingUserId, setSavingUserId] = useState(null)
  const [editingUserId, setEditingUserId] = useState(null)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [filters, setFilters] = useState({
    role: '',
    email: '',
    username: '',
  })
  const [filterDraft, setFilterDraft] = useState({
    role: '',
    email: '',
    username: '',
  })
  const canViewUsers =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert'
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'adim'
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    let isMounted = true

    async function loadUsers() {
      if (!canViewUsers) {
        if (isMounted) {
          setStatus('Chỉ quản trị viên và chuyên gia có thể xem trang này.')
        }
        return
      }

      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('page_size', String(pageSize))
        if (filters.role) {
          params.set('role', filters.role)
        }
        if (filters.email.trim()) {
          params.set('email', filters.email.trim())
        }
        if (filters.username.trim()) {
          params.set('username', filters.username.trim())
        }

        const endpoint = params.toString()
          ? `/api/users/?${params.toString()}`
          : '/api/users/'

        const response = await fetch(endpoint, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Không thể tải danh sách người dùng.')
        }

        const data = await response.json()
        const results = Array.isArray(data?.results) ? data.results : []
        const count = Number.isFinite(data?.count) ? data.count : results.length
        const pages = Number.isFinite(data?.total_pages) ? data.total_pages : 1
        const currentPage = Number.isFinite(data?.current_page) ? data.current_page : page

        if (isMounted) {
          setUsers(results)
          setDraftRoles(
            results.length > 0
              ? Object.fromEntries(results.map((user) => [user.id, user.role || 'user']))
              : {}
          )
          setTotalResults(count)
          setTotalPages(Math.max(1, pages))
          if (currentPage !== page) {
            setPage(currentPage)
          }
          setEditingUserId(null)
          setStatus(count > 0 ? '' : 'Không tìm thấy người dùng.')
        }
      } catch {
        if (isMounted) {
          setStatus('Hiện chưa thể tải danh sách người dùng.')
        }
      }
    }

    loadUsers()

    return () => {
      isMounted = false
    }
  }, [canViewUsers, page, filters])

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
      role: filterDraft.role,
      email: filterDraft.email.trim(),
      username: filterDraft.username.trim(),
    })
  }

  function clearFilters() {
    const emptyFilters = {
      role: '',
      email: '',
      username: '',
    }
    setFilterDraft(emptyFilters)
    setFilters(emptyFilters)
    setPage(1)
  }

  function renderPagination() {
    return (
      <div className="browse-toolbar users-list-pagination-toolbar">
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

  async function saveUserRole(userId) {
    if (!isAdmin || savingUserId) {
      return
    }

    const role = draftRoles[userId]
    if (!role) {
      return
    }

    setSavingUserId(userId)
    setActionStatus('Đang cập nhật vai trò người dùng...')

    try {
      const response = await fetch(`/api/users/${userId}/role/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể cập nhật vai trò người dùng.')
      }

      setUsers((current) =>
        current.map((user) => (user.id === userId ? { ...user, role: data.role } : user))
      )
      setDraftRoles((current) => ({
        ...current,
        [userId]: data.role,
      }))
      setEditingUserId(null)
      setActionStatus('Đã cập nhật vai trò người dùng.')
    } catch (error) {
      setActionStatus(error?.message || 'Hiện chưa thể cập nhật vai trò người dùng.')
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <main className="users-list-page">
      <section className="users-list-card">
        <div className="users-list-head">
          <h2>Danh sách người dùng</h2>
          <Link className="disease-detail-back" to="/database">
            Quay lại cơ sở dữ liệu
          </Link>
        </div>

        <p className="browse-results-count">
          {totalResults} người dùng
        </p>

        {canViewUsers ? (
          <form className="users-filters" onSubmit={applyFilters}>
            <label>
              Vai trò
              <select value={filterDraft.role} onChange={(event) => updateFilterDraft('role', event.target.value)}>
                <option value="">Tất cả vai trò</option>
                <option value="user">Người dùng</option>
                <option value="helper">Hỗ trợ viên</option>
                <option value="expert">Chuyên gia</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </label>
            <label>
              Email
              <input
                type="search"
                value={filterDraft.email}
                onChange={(event) => updateFilterDraft('email', event.target.value)}
                placeholder="Tìm email"
              />
            </label>
            <label>
              Tên người dùng
              <input
                type="search"
                value={filterDraft.username}
                onChange={(event) => updateFilterDraft('username', event.target.value)}
                placeholder="Tìm tên người dùng"
              />
            </label>
            <div className="users-filters__actions">
              <button type="submit" className="primary-btn">
                Áp dụng
              </button>
              <button type="button" className="secondary-btn" onClick={clearFilters}>
                Xóa lọc
              </button>
            </div>
          </form>
        ) : null}

        {status ? <p className="database-status">{status}</p> : null}
        {!status && actionStatus ? <p className="database-status">{actionStatus}</p> : null}

        {!status ? (
          <>
            <div className="users-list-table-wrap">
              <table className="users-list-table">
                <thead>
                  <tr>
                    <th>Tên người dùng</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Tên</th>
                    <th>Họ</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username || 'Không có'}</td>
                      <td>{user.email || 'Không có'}</td>
                      <td className="users-list-role-cell">
                        {isAdmin ? (
                          editingUserId === user.id ? (
                            <div className="users-list-role-editor">
                              <select
                                value={draftRoles[user.id] || 'user'}
                                onChange={(event) =>
                                  setDraftRoles((current) => ({
                                    ...current,
                                    [user.id]: event.target.value,
                                  }))
                                }
                                disabled={savingUserId === user.id}
                              >
                                <option value="user">Người dùng</option>
                                <option value="helper">Hỗ trợ viên</option>
                                <option value="expert">Chuyên gia</option>
                                <option value="admin">Quản trị viên</option>
                              </select>
                              <div className="users-list-role-actions">
                                <button
                                  type="button"
                                  className="users-list-role-save"
                                  disabled={savingUserId === user.id || draftRoles[user.id] === user.role}
                                  onClick={() => saveUserRole(user.id)}
                                >
                                  {savingUserId === user.id ? 'Đang lưu...' : 'Lưu'}
                                </button>
                                <button
                                  type="button"
                                  className="users-list-role-cancel"
                                  disabled={savingUserId === user.id}
                                  onClick={() => {
                                    setDraftRoles((current) => ({
                                      ...current,
                                      [user.id]: user.role || 'user',
                                    }))
                                    setEditingUserId(null)
                                  }}
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="users-list-role-display">
                              <span>{formatRole(user.role)}</span>
                              <button
                                type="button"
                                className="users-list-role-edit"
                                aria-label={`Sửa vai trò cho ${user.username || 'người dùng'}`}
                                title="Sửa vai trò"
                                onClick={() => setEditingUserId(user.id)}
                              >
                                <i className="fas fa-edit" aria-hidden="true" />
                              </button>
                            </div>
                          )
                        ) : (
                          formatRole(user.role)
                        )}
                      </td>
                      <td>{user.first_name || 'Không có'}</td>
                      <td>{user.last_name || 'Không có'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        ) : null}
      </section>
    </main>
  )
}

export default UsersListPage
