import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createDiscussionReply,
  deleteDiscussionReply,
  deleteDiscussionThread,
  displayBoardLabel,
  fetchDiscussionThread,
  formatTimestamp,
} from './discussionData'

const formattingExamples = [
  ['Đậm', '**chữ đậm**'],
  ['Nghiêng', '*chữ nghiêng*'],
  ['Mã', '`mã ngắn`'],
  ['Liên kết', '[văn bản liên kết](https://example.com)'],
  ['Nhắc tên', '@tennguoidung'],
  ['Trích dẫn', '> nội dung trích dẫn'],
  ['Danh sách', '- mục trong danh sách'],
  ['Đánh số', '1. mục có số thứ tự'],
]

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
        <span key={key} className="discussion-thread-post__mention">
          {leadingSpace}
          {trimmedPart}
        </span>
      )
    }

    return part
  })
}

function renderFormattedBlocks(text) {
  const lines = String(text || '').split('\n')
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

    const headingMatch = line.match(/^\s*(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const HeadingTag = `h${Math.min(headingMatch[1].length + 2, 5)}`
      blocks.push(
        <HeadingTag key={`heading-${index}`}>
          {renderInlineMarkdown(headingMatch[2], `heading-${index}`)}
        </HeadingTag>
      )
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

function renderPostContent(content) {
  const text = String(content || '')
  const replyMatch = text.match(/^\[reply:#(\d+) by ([^\]]+)\]\n?([\s\S]*)$/)
  const displayText = replyMatch ? replyMatch[3] : text

  return (
    <>
      {replyMatch ? (
        <span className="discussion-thread-post__reply-context">
          Đang trả lời #{replyMatch[1]} của {replyMatch[2]}
        </span>
      ) : null}
      {renderFormattedBlocks(displayText)}
    </>
  )
}

function DiscussionDetailPage({ currentUser }) {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const [thread, setThread] = useState(undefined)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const replyTextareaRef = useRef(null)
  const [status, setStatus] = useState({
    loading: true,
    error: '',
    reply: '',
  })

  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      setStatus({ loading: true, error: '', reply: '' })

      try {
        const data = await fetchDiscussionThread(threadId)

        if (!cancelled) {
          setThread(data)
          setStatus({ loading: false, error: '', reply: '' })
        }
      } catch (error) {
        if (!cancelled) {
          setThread(null)
          setStatus({
            loading: false,
            error: error instanceof Error ? error.message : 'Không thể tải chủ đề thảo luận.',
            reply: '',
          })
        }
      }
    }

    loadThread()

    return () => {
      cancelled = true
    }
  }, [threadId])

  const posts = useMemo(() => {
    if (!thread) {
      return []
    }

    return [
      {
        id: thread.opening_post.id,
        number: 1,
        author: thread.opening_post.author,
        created_at: thread.opening_post.created_at,
        content: thread.opening_post.content,
        isStarter: true,
      },
      ...(Array.isArray(thread.replies) ? thread.replies : []).map((reply, index) => ({
        ...reply,
        number: index + 2,
        isStarter: false,
      })),
    ]
  }, [thread])

  const canModerateDiscussion = currentUser?.role === 'admin' || currentUser?.role === 'adim' || currentUser?.role === 'expert'

  function canDeletePost(post) {
    return Boolean(currentUser && (canModerateDiscussion || post.author === currentUser.username))
  }

  async function handleReplySubmit(event) {
    event.preventDefault()

    if (!currentUser) {
      setStatus((current) => ({
        ...current,
        reply: 'Bạn cần đăng nhập trước khi gửi phản hồi.',
      }))
      return
    }

    const content = `${replyTarget ? `[reply:#${replyTarget.number} by ${replyTarget.author}]\n` : ''}${replyDraft.trim()}`
    if (!content || !thread) {
      return
    }

    setStatus((current) => ({
      ...current,
      reply: 'Đang gửi phản hồi...',
    }))

    try {
      const createdReply = await createDiscussionReply(thread.id, { content })
      setThread((current) =>
        current
          ? {
              ...current,
              replies: [...(current.replies || []), createdReply],
            }
          : current,
      )
      setReplyDraft('')
      setReplyTarget(null)
      setStatus((current) => ({
        ...current,
        reply: '',
      }))
    } catch (error) {
      setStatus((current) => ({
        ...current,
        reply: error instanceof Error ? error.message : 'Không thể gửi phản hồi.',
      }))
    }
  }

  function handlePostReply(post) {
    setReplyTarget(post)
    setReplyDraft((currentDraft) => {
      if (currentDraft.trim()) {
        return currentDraft
      }

      return `@${post.author} `
    })
    window.setTimeout(() => {
      replyTextareaRef.current?.focus()
      replyTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  function handleDeletePost(post) {
    if (!thread || !canDeletePost(post)) {
      return
    }

    setDeleteTarget(post)
  }

  async function handleConfirmDeletePost() {
    if (!thread || !deleteTarget || !canDeletePost(deleteTarget)) {
      return
    }

    setIsDeletingPost(true)
    setStatus((current) => ({
      ...current,
      reply: deleteTarget.isStarter ? 'Đang xóa chủ đề...' : 'Đang xóa phản hồi...',
    }))

    try {
      if (deleteTarget.isStarter) {
        await deleteDiscussionThread(thread.id)
        navigate('/discussion')
        return
      }

      await deleteDiscussionReply(thread.id, deleteTarget.id)
      setThread((current) =>
        current
          ? {
              ...current,
              replies: (current.replies || []).filter((reply) => reply.id !== deleteTarget.id),
            }
          : current,
      )
      setDeleteTarget(null)
      setStatus((current) => ({
        ...current,
        reply: '',
      }))
    } catch (error) {
      setStatus((current) => ({
        ...current,
        reply: error instanceof Error ? error.message : 'Không thể xóa bài viết này.',
      }))
    } finally {
      setIsDeletingPost(false)
    }
  }

  if (status.loading) {
    return (
      <main className="discussion-page">
        <section className="discussion-thread-shell discussion-thread-shell--empty">
          <p className="eyebrow">Thảo luận</p>
          <h2>Đang tải chủ đề...</h2>
        </section>
      </main>
    )
  }

  if (!thread) {
    return (
      <main className="discussion-page">
        <section className="discussion-thread-shell discussion-thread-shell--empty">
          <p className="eyebrow">Thảo luận</p>
          <h2>Không tìm thấy chủ đề</h2>
          <p>{status.error || 'Chủ đề này có thể đã bị xóa hoặc liên kết không còn hợp lệ.'}</p>
          <Link className="secondary-btn" to="/discussion">
            Quay về diễn đàn
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="discussion-page">
      <section className="discussion-thread-shell">
        <header className="discussion-thread-header">
          <div className="discussion-thread-header__top">
            <Link className="discussion-thread-back" to="/discussion">
              Quay về thảo luận
            </Link>
            <span className="discussion-thread-board">Đăng trong "{displayBoardLabel(thread.board)}"</span>
          </div>
          <h2>{thread.title}</h2>
        </header>

        <section className="discussion-thread-posts">
          {posts.map((post) => (
            <article key={post.id} className="discussion-thread-post">
              <aside className="discussion-thread-post__meta">
                <div>
                  <strong>#{post.number}</strong>
                  <span>bởi {post.author}</span>
                  <span>{formatTimestamp(post.created_at)}</span>
                  {post.isStarter ? <em>Người tạo chủ đề</em> : null}
                </div>
                <div className="discussion-thread-post__actions">
                  <button type="button" className="discussion-thread-post__reply" onClick={() => handlePostReply(post)}>
                    Trả lời
                  </button>
                  {canDeletePost(post) ? (
                    <button
                      type="button"
                      className="discussion-thread-post__delete"
                      disabled={isDeletingPost}
                      onClick={() => handleDeletePost(post)}
                    >
                      {post.isStarter ? 'Xóa chủ đề' : 'Xóa phản hồi'}
                    </button>
                  ) : null}
                </div>
              </aside>

              <div className="discussion-thread-post__body">
                {renderPostContent(post.content)}
              </div>
            </article>
          ))}
        </section>

        <section className="discussion-thread-reply-box">
          <div className="discussion-thread-reply-box__head">
            <div>
              <h3>Thêm phản hồi</h3>
              {replyTarget ? (
                <p className="discussion-thread-reply-target">
                  Đang trả lời #{replyTarget.number} của {replyTarget.author}
                  <button type="button" onClick={() => setReplyTarget(null)}>
                    Hủy
                  </button>
                </p>
              ) : null}
            </div>
            <span>Đăng với tên {currentUser?.username || 'Khách'}</span>
          </div>

          <form className="discussion-reply-form" onSubmit={handleReplySubmit}>
            <label>
              Nội dung
              <textarea
                ref={replyTextareaRef}
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder="Chia sẻ quan sát, nền thực địa hoặc câu hỏi tiếp theo"
              />
            </label>
            <FormattingGuide />
            <div className="discussion-reply-form__actions">
              {status.reply ? <p className="discussion-composer__status">{status.reply}</p> : null}
              <button type="submit" className="primary-btn">
                Gửi phản hồi
              </button>
            </div>
          </form>
        </section>
      </section>
      {deleteTarget ? (
        <div className="discussion-delete-modal-backdrop" role="presentation">
          <section
            className="discussion-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discussion-delete-title"
          >
            <div className="discussion-delete-modal__head">
              <p className="eyebrow">Xác nhận xóa</p>
              <button
                type="button"
                aria-label="Đóng xác nhận xóa"
                disabled={isDeletingPost}
                onClick={() => setDeleteTarget(null)}
              >
                x
              </button>
            </div>
            <h3 id="discussion-delete-title">
              {deleteTarget.isStarter ? 'Xóa chủ đề này?' : 'Xóa phản hồi này?'}
            </h3>
            <p>
              {deleteTarget.isStarter
                ? 'Thao tác này sẽ xóa bài mở đầu và mọi phản hồi trong chủ đề này.'
                : `Thao tác này sẽ xóa phản hồi #${deleteTarget.number} của ${deleteTarget.author}.`}
            </p>
            <div className="discussion-delete-modal__actions">
              <button type="button" disabled={isDeletingPost} onClick={() => setDeleteTarget(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="discussion-delete-modal__confirm"
                disabled={isDeletingPost}
                onClick={handleConfirmDeletePost}
              >
                {isDeletingPost ? 'Đang xóa...' : deleteTarget.isStarter ? 'Xóa chủ đề' : 'Xóa phản hồi'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default DiscussionDetailPage
