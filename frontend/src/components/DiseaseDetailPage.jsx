import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

function formatDate(value) {
  if (!value) {
    return 'Không rõ'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function renderInlineMarkdown(text, keyPrefix) {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|^@[^\s]+|\s@[^\s]+)/g
  const parts = String(text || '').split(pattern).filter((part) => part !== '')

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    const leadingSpace = part.startsWith(' ') ? ' ' : ''
    const trimmedPart = part.trimStart()

    if (trimmedPart.startsWith('`') && trimmedPart.endsWith('`')) {
      return <code key={key}>{trimmedPart.slice(1, -1)}</code>
    }

    if (trimmedPart.startsWith('**') && trimmedPart.endsWith('**')) {
      return <strong key={key}>{trimmedPart.slice(2, -2)}</strong>
    }

    if (trimmedPart.startsWith('*') && trimmedPart.endsWith('*')) {
      return <em key={key}>{trimmedPart.slice(1, -1)}</em>
    }

    const linkMatch = trimmedPart.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (linkMatch) {
      return (
        <a key={key} href={linkMatch[2]} target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>
      )
    }

    if (trimmedPart.startsWith('@')) {
      return (
        <span key={key} className="disease-wiki__mention">
          {leadingSpace}
          {trimmedPart}
        </span>
      )
    }

    return part
  })
}

function renderFormattedBlocks(text, emptyText) {
  const cleanText = String(text || '').trim()
  if (!cleanText) {
    return <p>{emptyText}</p>
  }

  const lines = cleanText.split('\n')
  const blocks = []
  let listItems = []
  let listType = ''

  function flushList() {
    if (listItems.length === 0) {
      return
    }

    const Tag = listType === 'ol' ? 'ol' : 'ul'
    const items = listItems
    const blockIndex = blocks.length
    blocks.push(
      <Tag key={`list-${blockIndex}`}>
        {items.map((item, index) => (
          <li key={`list-${blockIndex}-${index}`}>{renderInlineMarkdown(item, `list-${blockIndex}-${index}`)}</li>
        ))}
      </Tag>
    )
    listItems = []
    listType = ''
  }

  lines.forEach((line, index) => {
    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/)
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/)

    if (unorderedMatch || orderedMatch) {
      const nextListType = orderedMatch ? 'ol' : 'ul'
      if (listType && listType !== nextListType) {
        flushList()
      }
      listType = nextListType
      listItems.push((orderedMatch || unorderedMatch)[1])
      return
    }

    flushList()

    if (!line.trim()) {
      blocks.push(<br key={`break-${index}`} />)
      return
    }

    const quoteMatch = line.match(/^\s*>\s?(.*)$/)
    if (quoteMatch) {
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {renderInlineMarkdown(quoteMatch[1], `quote-${index}`)}
        </blockquote>
      )
      return
    }

    blocks.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(line, `paragraph-${index}`)}</p>)
  })

  flushList()
  return blocks
}

function DiseaseDetailPage({ currentUser }) {
  const { diseaseId } = useParams()
  const navigate = useNavigate()
  const [disease, setDisease] = useState(null)
  const [status, setStatus] = useState('Đang tải chi tiết bệnh...')
  const [editingSection, setEditingSection] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [drafts, setDrafts] = useState({
    name: '',
    pathogen: '',
    condition: '',
    symptoms: '',
    prevention: '',
  })
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'adim'
  const canDeleteDisease = isAdmin || currentUser?.role === 'expert'
  const galleryItemCount = disease?.image_count ?? disease?.images?.length ?? 0

  useEffect(() => {
    let isMounted = true

    async function loadDisease() {
      try {
        const response = await fetch(`/api/wheat-diseases/${diseaseId}/`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Không thể tải chi tiết bệnh.')
        }

        const data = await response.json()
        if (isMounted) {
          setDisease(data)
          setStatus('')
        }
      } catch {
        if (isMounted) {
          setStatus('Hiện chưa thể tải bản ghi bệnh này.')
        }
      }
    }

    loadDisease()

    return () => {
      isMounted = false
    }
  }, [diseaseId])

  useEffect(() => {
    if (!disease) {
      return
    }

    setDrafts({
      name: disease.name || '',
      pathogen: disease.pathogen || '',
      condition: disease.condition || '',
      symptoms: disease.symptoms || '',
      prevention: disease.prevention || '',
    })
  }, [disease])

  function startSectionEdit(section) {
    if (!isAdmin || isSaving) {
      return
    }

    setEditingSection(section)
  }

  function cancelSectionEdit() {
    if (!disease || isSaving) {
      return
    }

    setDrafts({
      name: disease.name || '',
      pathogen: disease.pathogen || '',
      condition: disease.condition || '',
      symptoms: disease.symptoms || '',
      prevention: disease.prevention || '',
    })
    setEditingSection(null)
  }

  async function saveSection(section) {
    if (!isAdmin || !disease) {
      return
    }

    const sectionPayloadMap = {
      name: { name: drafts.name.trim() },
      overview: { pathogen: drafts.pathogen.trim() },
      condition: { condition: drafts.condition.trim() },
      symptoms: { symptoms: drafts.symptoms.trim() },
      prevention: { prevention: drafts.prevention.trim() },
    }

    const payload = sectionPayloadMap[section]
    if (!payload) {
      return
    }

    if (section === 'name' && !payload.name) {
      setStatus('Tên bệnh là bắt buộc.')
      return
    }

    setIsSaving(true)
    setStatus('Đang lưu thay đổi...')

    try {
      const response = await fetch(`/api/wheat-diseases/${diseaseId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Không thể lưu thay đổi.')
      }

      setDisease(data)
      setEditingSection(null)
      setStatus('Đã cập nhật mục thành công.')
    } catch (error) {
      setStatus(error?.message || 'Hiện chưa thể lưu thay đổi.')
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteDisease() {
    if (!canDeleteDisease || !disease || isDeleting) {
      return
    }

    setIsDeleting(true)
    setStatus('Đang xóa bệnh và chuyển ảnh thư viện sang chưa gán nhãn...')

    try {
      const response = await fetch(`/api/wheat-diseases/${diseaseId}/`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Không thể xóa bệnh này.')
      }

      navigate('/database')
    } catch (error) {
      setStatus(error?.message || 'Hiện chưa thể xóa bệnh này.')
      setIsDeleteModalOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  function updateDraft(field, value) {
    setDrafts((current) => ({
      ...current,
      [field]: value,
    }))
  }

  return (
    <main className="disease-detail-page disease-wiki-page">
      <article className="disease-wiki">
        <Link className="disease-detail-back" to="/database">
          Quay về trang chủ
        </Link>

        {status ? (
          <p className="database-status">{status}</p>
        ) : null}

        {disease ? (
          <>
            <header className="disease-wiki__header">
              <div className="disease-wiki__title-row">
                <div className="disease-wiki__title-edit">
                  {editingSection === 'name' ? (
                    <div className="disease-wiki__title-editor">
                      <label>
                        Tên bệnh
                        <input
                          type="text"
                          value={drafts.name}
                          onChange={(event) => updateDraft('name', event.target.value)}
                          placeholder="Nhập tên bệnh"
                        />
                      </label>
                      <div className="disease-wiki__editor-actions">
                        <button type="button" className="secondary-btn disease-wiki__section-btn" disabled={isSaving} onClick={cancelSectionEdit}>
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="primary-btn disease-wiki__section-btn"
                          disabled={isSaving}
                          onClick={() => saveSection('name')}
                        >
                          {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1>{disease.name}</h1>
                      {isAdmin ? (
                        <button
                          type="button"
                          className="disease-wiki__edit-button disease-wiki__title-edit-button"
                          aria-label="Sửa tên bệnh"
                          title="Sửa tên bệnh"
                          disabled={isSaving}
                          onClick={() => startSectionEdit('name')}
                        >
                          <i className="fas fa-edit" aria-hidden="true" />
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="disease-wiki__gallery-actions">
                  <span className="disease-wiki__gallery-count">
                    Ảnh thư viện: {galleryItemCount}
                  </span>
                  <Link className="primary-btn disease-wiki__gallery-link" to={`/database/${diseaseId}/gallery`}>
                    Mở thư viện
                  </Link>
                  {canDeleteDisease ? (
                    <button
                      type="button"
                      className="disease-wiki__delete-button"
                      disabled={isSaving || isDeleting}
                      onClick={() => setIsDeleteModalOpen(true)}
                    >
                      Xóa bệnh
                    </button>
                  ) : null}
                </div>
              </div>
            </header>

            <div className="disease-wiki__layout">
              <aside className="disease-wiki__toc" aria-label="Nội dung trang">
                <h2>Nội dung</h2>
                <ol>
                  <li>
                    <a href="#overview">Tác nhân gây bệnh</a>
                  </li>
                  <li>
                    <a href="#symptoms">Triệu chứng</a>
                  </li>
                  <li>
                    <a href="#condition">Điều kiện phát sinh</a>
                  </li>
                  <li>
                    <a href="#prevention">Biện pháp phòng ngừa</a>
                  </li>
                  <li>
                    <a href="#entry-history">Lịch sử sửa đổi</a>
                  </li>
                </ol>
              </aside>

              <div className="disease-wiki__content">
                <section className="disease-wiki__section" id="overview">
                  <div className="disease-wiki__section-head">
                    <h2>Tác nhân gây bệnh</h2>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="disease-wiki__edit-button"
                        aria-label="Sửa tác nhân gây bệnh"
                        title="Sửa tác nhân gây bệnh"
                        disabled={isSaving}
                        onClick={() => startSectionEdit('overview')}
                      >
                        <i className="fas fa-edit" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {editingSection === 'overview' ? (
                    <div className="disease-wiki__editor">
                      <label>
                        Tác nhân gây bệnh
                        <input
                          type="text"
                          value={drafts.pathogen}
                          onChange={(event) => updateDraft('pathogen', event.target.value)}
                          placeholder="Nhập tên tác nhân gây bệnh"
                        />
                      </label>
                      <div className="disease-wiki__editor-actions">
                        <button type="button" className="secondary-btn disease-wiki__section-btn" disabled={isSaving} onClick={cancelSectionEdit}>
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="primary-btn disease-wiki__section-btn"
                          disabled={isSaving}
                          onClick={() => saveSection('overview')}
                        >
                          {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="disease-wiki__formatted">
                      {renderFormattedBlocks(disease.pathogen, 'Không có')}
                    </div>
                  )}
                </section>

                <section className="disease-wiki__section" id="symptoms">
                  <div className="disease-wiki__section-head">
                    <h2>Triệu chứng</h2>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="disease-wiki__edit-button"
                        aria-label="Sửa triệu chứng"
                        title="Sửa triệu chứng"
                        disabled={isSaving}
                        onClick={() => startSectionEdit('symptoms')}
                      >
                        <i className="fas fa-edit" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {editingSection === 'symptoms' ? (
                    <div className="disease-wiki__editor">
                      <label>
                        Triệu chứng
                        <textarea
                          rows={7}
                          value={drafts.symptoms}
                          onChange={(event) => updateDraft('symptoms', event.target.value)}
                          placeholder="Nhập triệu chứng"
                        />
                      </label>
                      <div className="disease-wiki__editor-actions">
                        <button type="button" className="secondary-btn disease-wiki__section-btn" disabled={isSaving} onClick={cancelSectionEdit}>
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="primary-btn disease-wiki__section-btn"
                          disabled={isSaving}
                          onClick={() => saveSection('symptoms')}
                        >
                          {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="disease-wiki__formatted">
                      {renderFormattedBlocks(disease.symptoms, 'Chưa thêm triệu chứng.')}
                    </div>
                  )}
                </section>

                <section className="disease-wiki__section" id="condition">
                  <div className="disease-wiki__section-head">
                    <h2>Điều kiện phát sinh</h2>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="disease-wiki__edit-button"
                        aria-label="Sửa điều kiện"
                        title="Sửa điều kiện"
                        disabled={isSaving}
                        onClick={() => startSectionEdit('condition')}
                      >
                        <i className="fas fa-edit" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {editingSection === 'condition' ? (
                    <div className="disease-wiki__editor">
                      <label>
                        Điều kiện
                        <textarea
                          rows={7}
                          value={drafts.condition}
                          onChange={(event) => updateDraft('condition', event.target.value)}
                          placeholder="Nhập điều kiện đồng ruộng hoặc môi trường thuận lợi"
                        />
                      </label>
                      <div className="disease-wiki__editor-actions">
                        <button type="button" className="secondary-btn disease-wiki__section-btn" disabled={isSaving} onClick={cancelSectionEdit}>
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="primary-btn disease-wiki__section-btn"
                          disabled={isSaving}
                          onClick={() => saveSection('condition')}
                        >
                          {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="disease-wiki__formatted">
                      {renderFormattedBlocks(disease.condition, 'Chưa thêm chi tiết điều kiện.')}
                    </div>
                  )}
                </section>

                <section className="disease-wiki__section" id="prevention">
                  <div className="disease-wiki__section-head">
                    <h2>Biện pháp phòng ngừa</h2>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="disease-wiki__edit-button"
                        aria-label="Sửa phòng ngừa"
                        title="Sửa phòng ngừa"
                        disabled={isSaving}
                        onClick={() => startSectionEdit('prevention')}
                      >
                        <i className="fas fa-edit" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {editingSection === 'prevention' ? (
                    <div className="disease-wiki__editor">
                      <label>
                        Phòng ngừa
                        <textarea
                          rows={7}
                          value={drafts.prevention}
                          onChange={(event) => updateDraft('prevention', event.target.value)}
                          placeholder="Nhập hướng dẫn phòng ngừa"
                        />
                      </label>
                      <div className="disease-wiki__editor-actions">
                        <button type="button" className="secondary-btn disease-wiki__section-btn" disabled={isSaving} onClick={cancelSectionEdit}>
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="primary-btn disease-wiki__section-btn"
                          disabled={isSaving}
                          onClick={() => saveSection('prevention')}
                        >
                          {isSaving ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="disease-wiki__formatted">
                      {renderFormattedBlocks(disease.prevention, 'Chưa thêm hướng dẫn phòng ngừa.')}
                    </div>
                  )}
                </section>

                <section className="disease-wiki__section" id="entry-history">
                  <h2>Lịch sử sửa đổi</h2>
                  <dl className="disease-wiki__meta-list">
                    <div>
                      <dt>Tác gải bài viết</dt>
                      <dd>{disease.created_by || 'Wheat DB'}</dd>
                    </div>
                    <div>
                      <dt>Ngày thêm</dt>
                      <dd>{formatDate(disease.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Cập nhật lần cuối</dt>
                      <dd>{formatDate(disease.updated_at)}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>
          </>
        ) : null}
      </article>
      {isDeleteModalOpen && disease ? (
        <div className="disease-delete-modal-backdrop" role="presentation">
          <section
            className="disease-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disease-delete-title"
          >
            <div className="disease-delete-modal__head">
              <p className="eyebrow">Xác nhận xóa</p>
              <button
                type="button"
                aria-label="Đóng xác nhận xóa"
                disabled={isDeleting}
                onClick={() => setIsDeleteModalOpen(false)}
              >
                x
              </button>
            </div>
            <h3 id="disease-delete-title">Xóa {disease.name}?</h3>
            <p>
              Thao tác này sẽ xóa bản ghi bệnh và trang thư viện của bệnh. {galleryItemCount} ảnh trong thư viện sẽ được chuyển sang chưa gán nhãn thay vì bị xóa.
            </p>
            <div className="disease-delete-modal__actions">
              <button type="button" disabled={isDeleting} onClick={() => setIsDeleteModalOpen(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="disease-delete-modal__confirm"
                disabled={isDeleting}
                onClick={deleteDisease}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa bệnh'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default DiseaseDetailPage
