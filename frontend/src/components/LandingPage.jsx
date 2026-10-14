import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import riceImage from '../assets/rice.png'

const fallbackUpdates = [
  'Đã thêm ghi chú kháng bệnh gỉ sọc cho lúa vụ xuân.',
  'Đã sắp xếp lại ảnh tham khảo bệnh cháy lá theo giai đoạn sinh trưởng.',
  'Đã xuất bản hướng dẫn đóng góp mới cho sinh viên nông học.',
  'Đã cập nhật tóm tắt bùng phát theo vùng cho các ruộng thử nghiệm.',
]

const fallbackDiscussions = [
  'Nên gắn nhãn mẫu có nhiều loại nấm bệnh như thế nào?',
  'Cách tốt nhất để so sánh triệu chứng giữa bệnh gỉ sắt và phấn trắng?',
  'Báo cáo thực địa có nên ưu tiên gửi hình ảnh trước không?',
  'Ý tưởng để quy trình duyệt của chuyên gia gọn hơn.',
]

const entryPoints = [
  {
    title: 'Cơ sở dữ liệu',
    text: 'Tra cứu bệnh lúa theo tên, triệu chứng, điều kiện, cách phòng ngừa và người tải lên.',
    to: '/database',
    icon: 'fa-book-medical',
    cta: 'Mở cơ sở dữ liệu',
  },
  {
    title: 'Thư viện hình ảnh',
    text: 'Xem mẫu đã tải lên, phân loại hình ảnh chưa gán nhãn và sắp xếp hồ sơ trực quan.',
    to: '/image',
    icon: 'fa-images',
    cta: 'Mở thư viện',
  },
  {
    title: 'Dự đoán',
    text: 'Tải lên ảnh lá và chạy quy trình dự đoán bệnh để đánh giá nhanh.',
    to: '/predict',
    icon: 'fa-wand-magic-sparkles',
    cta: 'Dự đoán bệnh',
  },
]

function normalizeStoredChangeMessage(message) {
  const text = String(message || '').trim()

  if (!text) {
    return ''
  }

  const normalized = text.toLowerCase()

  if (normalized === 'wheat disease image move.') {
    return 'Đã chuyển hình ảnh.'
  }
  if (normalized === 'wheat disease image label update.') {
    return 'Đã cập nhật nhãn hình ảnh.'
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

function formatChangeMessage(log) {
  if (log?.message) {
    return normalizeStoredChangeMessage(log.message)
  }

  const action = log?.action || ''
  const changes = log?.changes && typeof log.changes === 'object' ? log.changes : {}
  const before = changes.before && typeof changes.before === 'object' ? changes.before : {}
  const after = changes.after && typeof changes.after === 'object' ? changes.after : {}

  if (action === 'wheat_disease.create') {
    return `Đã tạo bệnh lúa "${after.name || before.name || 'mục'}".`
  }
  if (action === 'wheat_disease.update' || action === 'wheat_disease.replace') {
    return `Đã cập nhật bệnh lúa "${after.name || before.name || 'mục'}".`
  }
  if (action === 'wheat_disease.delete') {
    return `Đã xóa bệnh lúa "${before.name || 'mục'}".`
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
    return 'Đã cập nhật nhãn hình ảnh.'
  }
  if (action === 'user.role_update') {
    return `Đã đổi vai trò người dùng từ ${before.role || 'không rõ'} sang ${after.role || 'không rõ'}.`
  }
  if (action === 'user.update' || action === 'user.replace') {
    return `Đã cập nhật người dùng "${after.username || before.username || 'hồ sơ'}".`
  }
  if (action === 'user.delete') {
    return `Đã xóa người dùng "${before.username || 'bản ghi'}".`
  }

  return action
    ? action.replaceAll('_', ' ').replaceAll('.', ' ').trim().replace(/^\w/, (c) => c.toUpperCase()) + '.'
    : 'Đã cập nhật dữ liệu.'
}

function LandingPage() {
  const [recentChanges, setRecentChanges] = useState(fallbackUpdates)
  const [recentDiscussions, setRecentDiscussions] = useState(fallbackDiscussions)

  useEffect(() => {
    let isMounted = true

    async function loadRecentChanges() {
      try {
        const response = await fetch('/api/changelog/?page=1&page_size=4', {
          credentials: 'include',
        })
        if (!response.ok) {
          return
        }

        const data = await response.json()
        const logs = Array.isArray(data?.results) ? data.results : []
        const messages = logs
          .map((log) => formatChangeMessage(log))
          .filter(Boolean)

        if (isMounted && messages.length > 0) {
          setRecentChanges(messages)
        }
      } catch {
        // Keep fallback updates when changelog cannot be loaded.
      }
    }

    loadRecentChanges()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadRecentDiscussions() {
      try {
        const response = await fetch('/api/discussions/?page=1&page_size=4', {
          credentials: 'include',
        })
        if (!response.ok) {
          return
        }

        const data = await response.json()
        const threads = Array.isArray(data?.results) ? data.results : []
        const items = threads
          .map((thread) => ({
            id: thread.id,
            title: thread.title,
            board: thread.board,
            replies: thread.replies_count || 0,
          }))
          .filter((thread) => thread.id && thread.title)

        if (isMounted && items.length > 0) {
          setRecentDiscussions(items)
        }
      } catch {
        // Keep fallback discussion prompts when the forum cannot be loaded.
      }
    }

    loadRecentDiscussions()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">Cơ sở dữ liệu bệnh cây lúa</p>
          <h2>Tra cứu bệnh cây lúa, ảnh bệnh,dự đoán bệnh</h2>
         

          <div className="hero-actions">
            <Link className="primary-btn" to="/database">
              Tra cứu thông tin bệnh
            </Link>
            <Link className="secondary-btn" to="/predict">
              Dự đoán ảnh
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-panel visual-panel--tall">
            <img src={riceImage} alt="" className="hero-visual__image" />
          </div>
        </div>
      </section>

      <section className="entry-panels" id="explore" aria-label="Primary WheatDB workflows">
        {entryPoints.map((entry) => (
          <Link key={entry.title} className="entry-card" to={entry.to}>
            <span className="entry-card__icon">
              <i className={`fas ${entry.icon}`} aria-hidden="true" />
            </span>
            <h3>{entry.title}</h3>
            <p>{entry.text}</p>
            <span className="entry-card__cta">{entry.cta}</span>
          </Link>
        ))}
      </section>

      <section className="feed-grid" id="updates">
        <article className="feed-card">
          <div className="feed-card__head">
            <h3>Thay đổi gần đây</h3>
            <Link to="/changelog">Xem nhật ký</Link>
          </div>
          <ul>
            {recentChanges.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="feed-card" id="community">
          <div className="feed-card__head">
            <h3>Diễn đàng thảo luận.</h3>
            <Link to="/discussion">Mở diễn đàng</Link>
          </div>
          <ul>
            {recentDiscussions.map((item) => (
              typeof item === 'string' ? (
                <li key={item}>{item}</li>
              ) : (
                <li key={item.id}>
                  <Link to={`/discussion/${item.id}`}>{item.title}</Link>
                  <span>{item.board} · {item.replies} repl{item.replies === 1 ? 'y' : 'ies'}</span>
                </li>
              )
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}

export default LandingPage
