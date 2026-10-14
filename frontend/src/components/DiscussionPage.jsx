import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  boards,
  createDiscussionThread,
  fetchDiscussionThreads,
  formatTimestamp,
  PAGE_SIZE,
} from './discussionData'

const formattingExamples = [
  ['In đậm', '**in đậm**'],
  ['In nghiêng', '*in nghiêng*'],
  ['Mã', '`mã nội dòng`'],
  ['Liên kết', '[văn bản liên kết](https://example.com)'],
  ['Nhắc tên', '@username'],
  ['Trích dẫn', '> nội dung trích dẫn'],
  ['Danh sách', '- một mục danh sách'],
  ['Đánh số', '1. một mục có số thứ tự'],
]

const boardLabelMap = {
  'All boards': 'Tất cả',
  Announcements: 'Thông báo',
  'General discussion': 'Thảo luận chung',
  Diagnosis: 'Dán nhãn',
  'Field reports': 'Nghiên cứu',
  'Data quality': 'Bài viết',
}

function getBoardLabel(board) {
  return boardLabelMap[board] || board
}

function FormattingGuide() {
  return (
    <details className="discussion-format-guide">
      <summary>Hướng dẫn định dạng</summary>
      <div className="discussion-format-guide__grid">
        {formattingExamples.map(([label, example]) => (
          <div key={label} className="discussion-format-guide__item">
            <span>{label}</span>
            <code>{example}</code>
          </div>
        ))}
      </div>
    </details>
  )
}

function DiscussionPage({ currentUser }) {
  const navigate = useNavigate()
  const [selectedBoard, setSelectedBoard] = useState('All boards')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [threadsPayload, setThreadsPayload] = useState({
    count: 0,
    current_page: 1,
    page_size: PAGE_SIZE,
    total_pages: 1,
    results: [],
  })
  const [status, setStatus] = useState({
    loading: true,
    error: '',
  })
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerStatus, setComposerStatus] = useState('')
  const [newThread, setNewThread] = useState({
    title: '',
    board: 'General discussion',
    content: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadThreads() {
      setStatus({ loading: true, error: '' })

      try {
        const data = await fetchDiscussionThreads({
          board: selectedBoard,
          q: searchTerm,
          page,
          pageSize: PAGE_SIZE,
        })

        if (!cancelled) {
          setThreadsPayload(data)
          setStatus({ loading: false, error: '' })
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            loading: false,
            error: error instanceof Error ? error.message : 'Không thể tải thảo luận.',
          })
        }
      }
    }

    loadThreads()

    return () => {
      cancelled = true
    }
  }, [page, searchTerm, selectedBoard])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedBoard])

  function handleThreadFieldChange(event) {
    const { name, value } = event.target
    setNewThread((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleCreateThread(event) {
    event.preventDefault()

    if (!currentUser) {
      setComposerStatus('Bạn cần đăng nhập trước khi đăng thảo luận.')
      return
    }

    setComposerStatus('Đang đăng thảo luận...')

    try {
      const createdThread = await createDiscussionThread(newThread)
      setComposerStatus('')
      setComposerOpen(false)
      setNewThread({
        title: '',
        board: 'General discussion',
        content: '',
      })
      navigate(`/discussion/${createdThread.id}`)
    } catch (error) {
      setComposerStatus(error instanceof Error ? error.message : 'Không thể tạo thảo luận.')
    }
  }

  const threads = Array.isArray(threadsPayload.results) ? threadsPayload.results : []
  const totalPages = threadsPayload.total_pages || 1
  const currentPage = threadsPayload.current_page || page
  const pageNumbers = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    const start = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4))
    return start + index
  }).filter((pageNumber) => pageNumber <= totalPages)

  return (
    <main className="discussion-page">
      <section className="discussion-board-shell">
        <header className="discussion-board-header">
          <div className="discussion-board-heading">
            <h2>Diễn đàn thảo luận</h2>
          </div>

          <div className="discussion-board-actions">
            <div className="discussion-board-tabs" aria-label="Bảng thảo luận">
              {boards.map((board) => (
                <button
                  key={board}
                  type="button"
                  className={
                    board === selectedBoard
                      ? 'discussion-board-tab discussion-board-tab--active'
                      : 'discussion-board-tab'
                  }
                  onClick={() => setSelectedBoard(board)}
                >
                  {getBoardLabel(board)}
                </button>
              ))}
            </div>

            <div className="discussion-board-search-row">
              <label className="discussion-board-search">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo tiêu đề, bảng hoặc tác giả"
                />
                <span>Tìm kiếm</span>
              </label>

              <button
                type="button"
                className="secondary-btn discussion-compose-toggle"
                onClick={() => setComposerOpen((current) => !current)}
              >
                {composerOpen ? 'Đóng' : 'Tạo cuộc thảo luận mới'}
              </button>
            </div>
          </div>

          {composerOpen ? (
            <form className="discussion-composer" onSubmit={handleCreateThread}>
              <div className="discussion-composer__grid">
                <label>
                  Tiêu đề
                  <input
                    name="title"
                    value={newThread.title}
                    onChange={handleThreadFieldChange}
                    placeholder="Bạn muốn thảo luận điều gì?"
                  />
                </label>

                <label>
                  Bảng
                  <select name="board" value={newThread.board} onChange={handleThreadFieldChange}>
                    {boards
                      .filter((board) => board !== 'All boards')
                      .map((board) => (
                        <option key={board} value={board}>
                          {getBoardLabel(board)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <label>
                Nội dung mở đầu
                <textarea
                  name="content"
                  value={newThread.content}
                  onChange={handleThreadFieldChange}
                  placeholder="Viết tin nhắn đầu tiên cho thảo luận này."
                />
              </label>
              <FormattingGuide />

              <div className="discussion-composer__actions">
                {composerStatus ? <p className="discussion-composer__status">{composerStatus}</p> : null}
                <button type="submit" className="primary-btn">
                  Đăng thảo luận
                </button>
              </div>
            </form>
          ) : null}
        </header>

        <section className="discussion-index">
          <div className="discussion-index__toolbar">
            <div className="discussion-index__pagination">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
              >
                trước
              </button>
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={
                    pageNumber === currentPage
                      ? 'discussion-page-pill discussion-page-pill--active'
                      : 'discussion-page-pill'
                  }
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
              >
                tiếp
              </button>
            </div>

            <div className="discussion-index__summary">
              <span>{threadsPayload.count} chủ đề</span>
              <span>{threads.reduce((sum, thread) => sum + (thread.replies_count || 0), 0)} phản hồi trên trang này</span>
              <span>Đăng với tên {currentUser?.username || 'Khách'}</span>
            </div>
          </div>

          <div className="discussion-table-wrap">
            <table className="discussion-table">
              <thead>
                <tr>
                  <th>Chủ đề</th>
                  <th>Phản hồi</th>
                  <th>Người mở đầu</th>
                  <th>Bài mới nhất</th>
                </tr>
              </thead>
              <tbody>
                {status.loading ? (
                  <tr>
                    <td colSpan="4" className="discussion-table__empty">
                      Đang tải thảo luận...
                    </td>
                  </tr>
                ) : status.error ? (
                  <tr>
                    <td colSpan="4" className="discussion-table__empty">
                      {status.error}
                    </td>
                  </tr>
                ) : threads.length > 0 ? (
                  threads.map((thread) => (
                    <tr key={thread.id} className="discussion-table__row">
                      <td className="discussion-topic-cell">
                        <Link className="discussion-topic-button" to={`/discussion/${thread.id}`}>
                          <strong>{thread.title}</strong>
                          <span className="discussion-topic-cell__meta">{getBoardLabel(thread.board)}</span>
                        </Link>
                      </td>
                      <td className="discussion-table__numeric">{thread.replies_count}</td>
                      <td>{thread.author}</td>
                      <td className="discussion-last-post">
                        <strong>{thread.last_post?.author || thread.author}</strong>
                        <span>{formatTimestamp(thread.last_post?.created_at || thread.created_at)}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="discussion-table__empty">
                      Hiện không có chủ đề nào khớp với bảng hoặc tìm kiếm này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

export default DiscussionPage
