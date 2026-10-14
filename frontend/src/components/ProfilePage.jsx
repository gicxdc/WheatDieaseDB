import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import avatarPlaceholder from '../assets/avatar-placeholder.svg'

function formatRole(role) {
  if (!role) {
    return 'Người dùng'
  }

  const labels = {
    admin: 'Quản trị viên',
    adim: 'Quản trị viên',
    expert: 'Chuyên gia',
    helper: 'Hỗ trợ viên',
    user: 'Người dùng',
  }

  return labels[role] || String(role).replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase())
}

function formatDateJoined(value) {
  if (!value) {
    return 'Không có'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function ProfilePage({ currentUser, onProfileUpdate }) {
  const [editingField, setEditingField] = useState(null)
  const [draftValues, setDraftValues] = useState({
    username: '',
    first_name: '',
    last_name: '',
  })
  const [savingField, setSavingField] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [avatarLoadError, setAvatarLoadError] = useState(false)

  useEffect(() => {
    setDraftValues({
      username: currentUser?.username || '',
      first_name: currentUser?.first_name || '',
      last_name: currentUser?.last_name || '',
    })
  }, [currentUser?.username, currentUser?.first_name, currentUser?.last_name])

  useEffect(() => {
    setAvatarLoadError(false)
  }, [currentUser?.avatar_url])

  if (!currentUser) {
    return (
      <main className="profile-page">
        <section className="profile-card profile-card--empty">
          <p className="eyebrow">Hồ sơ người dùng</p>
          <h2>Cần đăng nhập</h2>
          <p className="profile-text">
            Đăng nhập để xem hồ sơ Wheat DB và thông tin tài khoản của bạn.
          </p>
          <Link className="primary-btn" to="/login">
            Đi tới đăng nhập
          </Link>
        </section>
      </main>
    )
  }

  const hasAvatar = Boolean(currentUser.avatar_url && !avatarLoadError)
  const avatarSrc = hasAvatar ? currentUser.avatar_url : avatarPlaceholder

  async function saveProfileField(field) {
    if (!currentUser?.id || savingField) {
      return
    }

    setSavingField(field)
    setStatusMessage('Đang lưu thay đổi hồ sơ...')

    const trimmedValue = (draftValues[field] || '').trim()

    if (field === 'username' && !trimmedValue) {
      setSavingField(null)
      setStatusMessage('Tên người dùng là bắt buộc.')
      return
    }

    try {
      const response = await fetch(`/api/user/${currentUser.id}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [field]: trimmedValue,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể cập nhật trường này.')
      }

      onProfileUpdate?.(data)
      setDraftValues((current) => ({
        ...current,
        [field]: data?.[field] || '',
      }))
      setEditingField(null)
      setStatusMessage('Đã cập nhật hồ sơ.')
    } catch (error) {
      setStatusMessage(error?.message || 'Hiện chưa thể cập nhật hồ sơ.')
    } finally {
      setSavingField(null)
    }
  }

  function startEdit(field) {
    setEditingField(field)
    setStatusMessage('')
    setDraftValues((current) => ({
      ...current,
      [field]: currentUser?.[field] || '',
    }))
  }

  function cancelEdit(field) {
    setDraftValues((current) => ({
      ...current,
      [field]: currentUser?.[field] || '',
    }))
    setEditingField(null)
  }

  async function handleAvatarSelect(event) {
    const file = event.target.files?.[0]
    if (!file || !currentUser?.id || savingField) {
      event.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('image', file)

    setSavingField('avatar')
    setStatusMessage('Đang tải ảnh đại diện...')

    try {
      const response = await fetch(`/api/users/${currentUser.id}/avatar/upload/`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể tải ảnh đại diện.')
      }

      onProfileUpdate?.(data?.user || null)
      setAvatarLoadError(false)
      setStatusMessage(data?.detail || 'Đã tải ảnh đại diện thành công.')
    } catch (error) {
      setStatusMessage(error?.message || 'Hiện chưa thể tải ảnh đại diện.')
    } finally {
      setSavingField(null)
      event.target.value = ''
    }
  }

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-hero">
          <div className="profile-avatar-shell">
            <img
              className="profile-avatar-image"
              src={avatarSrc}
              alt={hasAvatar ? `Ảnh đại diện của ${currentUser.username}` : 'Ảnh đại diện mặc định'}
              onError={() => setAvatarLoadError(true)}
            />
            <label className="profile-avatar-edit">
              {savingField === 'avatar' ? 'Đang tải...' : 'Tải ảnh đại diện'}
              <input
                type="file"
                accept="image/*"
                disabled={savingField === 'avatar'}
                onChange={handleAvatarSelect}
              />
            </label>
          </div>
          <div className="profile-hero__copy">
            <p className="eyebrow">Hồ sơ người dùng</p>
            {editingField === 'username' ? (
              <div className="profile-heading-editor">
                <label>
                  Tên người dùng
                  <input
                    type="text"
                    value={draftValues.username}
                    onChange={(event) =>
                      setDraftValues((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    placeholder="Chọn tên người dùng"
                    disabled={savingField === 'username'}
                  />
                </label>
                <div className="profile-field__actions">
                  <button
                    type="button"
                    className="users-list-role-save"
                    disabled={savingField === 'username'}
                    onClick={() => saveProfileField('username')}
                  >
                    {savingField === 'username' ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    className="users-list-role-cancel"
                    disabled={savingField === 'username'}
                    onClick={() => cancelEdit('username')}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-heading-row">
                <h2>
                  {currentUser.username} <span className="profile-heading-id">#{currentUser.id}</span>
                </h2>
                <button
                  type="button"
                  className="profile-field__edit profile-heading-edit"
                  aria-label="Sửa tên người dùng"
                  title="Sửa tên người dùng"
                  onClick={() => startEdit('username')}
                >
                  <i className="fas fa-edit" aria-hidden="true" />
                </button>
              </div>
            )}
            <div className="profile-chips">
              <span className="profile-chip profile-chip--role">{formatRole(currentUser.role)}</span>
            </div>
          </div>
        </div>

        {statusMessage ? <p className="profile-status">{statusMessage}</p> : null}

        <div className="profile-panels">
          <section className="profile-panel profile-panel--identity">
            <p className="profile-panel__label">Thông tin cá nhân</p>
            <div className="profile-grid">
              <article className="profile-field">
                <div className="profile-field__head">
                  <span>Tên</span>
                  <button
                    type="button"
                    className="profile-field__edit"
                    aria-label="Sửa tên"
                    title="Sửa tên"
                    onClick={() => startEdit('first_name')}
                  >
                    <i className="fas fa-edit" aria-hidden="true" />
                  </button>
                </div>
                {editingField === 'first_name' ? (
                  <div className="profile-field__editor">
                    <input
                      className="profile-field__input"
                      type="text"
                      value={draftValues.first_name}
                      onChange={(event) =>
                        setDraftValues((current) => ({
                          ...current,
                          first_name: event.target.value,
                        }))
                      }
                      placeholder="Nhập tên"
                      disabled={savingField === 'first_name'}
                    />
                    <div className="profile-field__actions">
                      <button
                        type="button"
                        className="users-list-role-save"
                        disabled={savingField === 'first_name'}
                        onClick={() => saveProfileField('first_name')}
                      >
                        {savingField === 'first_name' ? 'Đang lưu...' : 'Lưu'}
                      </button>
                      <button
                        type="button"
                        className="users-list-role-cancel"
                        disabled={savingField === 'first_name'}
                        onClick={() => cancelEdit('first_name')}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <strong>{currentUser.first_name || 'Chưa thiết lập'}</strong>
                )}
              </article>
              <article className="profile-field">
                <div className="profile-field__head">
                  <span>Họ</span>
                  <button
                    type="button"
                    className="profile-field__edit"
                    aria-label="Sửa họ"
                    title="Sửa họ"
                    onClick={() => startEdit('last_name')}
                  >
                    <i className="fas fa-edit" aria-hidden="true" />
                  </button>
                </div>
                {editingField === 'last_name' ? (
                  <div className="profile-field__editor">
                    <input
                      className="profile-field__input"
                      type="text"
                      value={draftValues.last_name}
                      onChange={(event) =>
                        setDraftValues((current) => ({
                          ...current,
                          last_name: event.target.value,
                        }))
                      }
                      placeholder="Nhập họ"
                      disabled={savingField === 'last_name'}
                    />
                    <div className="profile-field__actions">
                      <button
                        type="button"
                        className="users-list-role-save"
                        disabled={savingField === 'last_name'}
                        onClick={() => saveProfileField('last_name')}
                      >
                        {savingField === 'last_name' ? 'Đang lưu...' : 'Lưu'}
                      </button>
                      <button
                        type="button"
                        className="users-list-role-cancel"
                        disabled={savingField === 'last_name'}
                        onClick={() => cancelEdit('last_name')}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <strong>{currentUser.last_name || 'Chưa thiết lập'}</strong>
                )}
              </article>
              <article className="profile-field profile-field--wide">
                <span>Email</span>
                <strong>{currentUser.email || 'Không có'}</strong>
              </article>
              <article className="profile-field profile-field--wide">
                <span>Ngày tham gia</span>
                <strong>{formatDateJoined(currentUser.date_joined)}</strong>
              </article>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default ProfilePage
