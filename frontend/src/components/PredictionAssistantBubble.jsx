import { useRef, useState } from 'react'
import riceIcon from '../assets/rice.png'

function normalizeDiseaseName(value) {
  return String(value || '').trim().toLowerCase()
}

function formatConfidence(value) {
  const confidence = Number(value || 0)
  return `${Math.round(confidence * 1000) / 10}%`
}

function PredictionAssistantBubble({
  prediction,
  predictionStatus,
  predictionError,
  isPredicting,
  isMovingImage,
  diseaseOptions,
  onRetry,
  onMoveToDisease,
}) {
  const panelRef = useRef(null)
  const dragRef = useRef(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [panelPosition, setPanelPosition] = useState(null)
  const [messageDraft, setMessageDraft] = useState('')
  const [messages, setMessages] = useState([])
  const isUnsupported = prediction?.is_supported === false
  const predictedDisease = prediction?.label
    ? diseaseOptions.find((disease) =>
        [prediction.label, prediction.original_label].some(
          (label) => normalizeDiseaseName(disease.name) === normalizeDiseaseName(label),
        ),
      )
    : null

  function clampPanelPosition(left, top, width, height) {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const margin = 12

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, viewportWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - height - margin)),
    }
  }

  function handleBubblePointerDown(event) {
    const panelRect = panelRef.current?.getBoundingClientRect()
    if (!panelRect) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panelLeft: panelRect.left,
      panelTop: panelRect.top,
      panelWidth: panelRect.width,
      panelHeight: panelRect.height,
      moved: false,
    }
  }

  function handleBubblePointerMove(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    const moved = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4

    if (moved) {
      drag.moved = true
    }

    if (!drag.moved) {
      return
    }

    setPanelPosition(
      clampPanelPosition(
        drag.panelLeft + deltaX,
        drag.panelTop + deltaY,
        drag.panelWidth,
        drag.panelHeight,
      ),
    )
  }

  function handleBubblePointerUp(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null

    if (!drag.moved) {
      setIsCollapsed((current) => !current)
    }
  }

  function handleBubblePointerCancel(event) {
    const drag = dragRef.current
    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  function handleSendMessage(event) {
    event.preventDefault()

    const content = messageDraft.trim()
    if (!content) {
      return
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `${Date.now()}-${content}`,
        content,
      },
    ])
    setMessageDraft('')
  }

  return (
    <div
      ref={panelRef}
      className={`image-prediction-panel${isCollapsed ? ' image-prediction-panel--collapsed' : ''}`}
      style={panelPosition ? { left: `${panelPosition.left}px`, top: `${panelPosition.top}px`, bottom: 'auto' } : undefined}
    >
      <button
        type="button"
        className="image-prediction-bubble-mark"
        aria-label={isCollapsed ? 'Hiện trợ lý dự đoán' : 'Ẩn trợ lý dự đoán'}
        aria-expanded={!isCollapsed}
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        onPointerCancel={handleBubblePointerCancel}
      >
        <img src={riceIcon} alt="" />
      </button>

      {!isCollapsed ? (
        <div className="image-prediction-panel__body">
          <div className="image-prediction-chat-head">
            <img src={riceIcon} alt="" />
            <div>
              <h4>Trợ lý bệnh lúa</h4>
              <span>{isPredicting ? 'Đang dự đoán...' : 'Đang hoạt động'}</span>
            </div>
            <button type="button" className="image-prediction-panel__retry" disabled={isPredicting} onClick={onRetry}>
              Thử lại
            </button>
          </div>

          <div className="image-prediction-chat-log">
            <div className="image-prediction-message image-prediction-message--assistant">
              {isUnsupported ? (
                <>
                  <span className="image-prediction-message__label">Kiểm tra an toàn</span>
                  <strong>{prediction.detail || 'Ảnh này có vẻ không phải ảnh lá cây trồng được hỗ trợ.'}</strong>
                </>
              ) : prediction?.label ? (
                <>
                  <span className="image-prediction-message__label">Tôi nghĩ đây là</span>
                  <strong>{prediction.label}</strong>
                </>
              ) : (
                <strong>{isPredicting ? 'Đang kiểm tra ảnh này...' : 'Mở một ảnh chưa gán nhãn và tôi sẽ dự đoán.'}</strong>
              )}
            </div>

            {prediction?.predictions?.length ? (
              <div className="image-prediction-message image-prediction-message--assistant image-prediction-message--wide">
                <span className="image-prediction-message__label">Kết quả phù hợp nhất</span>
                <div className="image-prediction-ranking">
                  {prediction.predictions.map((item) => (
                    <div key={item.label} className="image-prediction-ranking-row">
                      <span>{item.label}</span>
                      <strong>{formatConfidence(item.confidence)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {prediction?.label && !isUnsupported ? (
              <div className="image-prediction-message image-prediction-message--action">
                <span className="image-prediction-message__label">Hành động đề xuất</span>
                <button
                  type="button"
                  className="image-prediction-move"
                  disabled={isMovingImage || !predictedDisease}
                  onClick={() => onMoveToDisease(predictedDisease?.id)}
                >
                  {predictedDisease ? 'Chuyển tới bệnh đã dự đoán' : 'Không có thư mục phù hợp'}
                </button>
              </div>
            ) : null}

            {predictionError ? (
              <div className="image-prediction-message image-prediction-message--error">
                {predictionError}
              </div>
            ) : null}

            {messages.map((message) => (
              <div key={message.id} className="image-prediction-message image-prediction-message--user">
                {message.content}
              </div>
            ))}
          </div>

          <form className="image-prediction-chat-composer" onSubmit={handleSendMessage}>
            <input
              type="text"
              value={messageDraft}
              placeholder={predictionStatus || 'Nhắn cho trợ lý bệnh lúa'}
              onChange={(event) => setMessageDraft(event.target.value)}
            />
            <div className="image-prediction-chat-actions">
              <button type="submit" className="image-prediction-send" disabled={!messageDraft.trim()}>
                Gửi
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default PredictionAssistantBubble
