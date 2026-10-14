export const PAGE_SIZE = 10

export const boards = [
  'All boards',
  'Announcements',
  'General discussion',
  'Diagnosis',
  'Field reports',
  'Data quality',
]

const boardLabels = {
  'All boards': 'Tất cả chuyên mục',
  Announcements: 'Thông báo',
  'General discussion': 'Thảo luận chung',
  Diagnosis: 'Chẩn đoán',
  'Field reports': 'Báo cáo thực địa',
  'Data quality': 'Chất lượng dữ liệu',
}

export function displayBoardLabel(board) {
  return boardLabels[board] || board || 'Chưa phân loại'
}

export function formatTimestamp(isoDate) {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

export async function fetchDiscussionThreads({ board = 'All boards', q = '', page = 1, pageSize = PAGE_SIZE }) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  if (board && board !== 'All boards') {
    params.set('board', board)
  }

  if (q.trim()) {
    params.set('q', q.trim())
  }

  const response = await fetch(`/api/discussions/?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Không thể tải thảo luận.')
  }

  return response.json()
}

export async function fetchDiscussionThread(threadId) {
  const response = await fetch(`/api/discussions/${threadId}/`, {
    credentials: 'include',
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error('Không thể tải chủ đề thảo luận.')
  }

  return response.json()
}

export async function createDiscussionThread(payload) {
  const response = await fetch('/api/discussions/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || data?.content?.[0] || 'Không thể tạo thảo luận.')
  }

  return data
}

export async function createDiscussionReply(threadId, payload) {
  const response = await fetch(`/api/discussions/${threadId}/posts/`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || data?.content?.[0] || 'Không thể đăng phản hồi.')
  }

  return data
}

export async function deleteDiscussionThread(threadId) {
  const response = await fetch(`/api/discussions/${threadId}/`, {
    method: 'DELETE',
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || 'Không thể xóa thảo luận.')
  }
}

export async function deleteDiscussionReply(threadId, postId) {
  const response = await fetch(`/api/discussions/${threadId}/posts/${postId}/`, {
    method: 'DELETE',
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data?.detail || 'Không thể xóa phản hồi.')
  }
}
