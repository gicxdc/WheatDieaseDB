import { useCallback, useEffect, useState } from 'react'
import PredictionAssistantBubble from './PredictionAssistantBubble'

const UNLABELED_FOLDER_NAME = 'unlabeled'
const HEALTHY_MOVE_VALUE = 'healthy'

export function formatImageDate(value) {
  if (!value) {
    return 'Không rõ ngày'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Không rõ ngày'
  }

  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function filenameFromImageKey(imageKey) {
  if (!imageKey) {
    return ''
  }

  const parts = String(imageKey).split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

export function normalizeImage(image) {
  return {
    ...image,
    disease_id: image.disease_id,
    disease_name: image.disease_name,
    file_name: image.file_name || filenameFromImageKey(image.image_key) || image.caption || `Ảnh ${image.id}`,
    display_name: image.caption || image.disease_name || filenameFromImageKey(image.image_key) || `Ảnh ${image.id}`,
  }
}

export function isUnlabeledImage(image) {
  const keyParts = String(image?.image_key || '').split('/').filter(Boolean)
  return !image?.disease_id && (keyParts.length <= 1 || keyParts[0] === UNLABELED_FOLDER_NAME)
}

function draftFromImage(image) {
  return {
    caption: image?.caption || '',
    location: image?.location || '',
    background: image?.background || image?.angle || '',
    weather: image?.weather || '',
    timeOfDay: image?.timeOfDay || '',
  }
}

function ImageFocusViewer({
  image,
  canManageImages,
  onClose,
  onImageUpdated,
  onImageDeleted,
  onImageMoved,
}) {
  const [labelDraft, setLabelDraft] = useState(() => draftFromImage(image))
  const [labelStatus, setLabelStatus] = useState('')
  const [moveStatus, setMoveStatus] = useState('')
  const [isSavingLabels, setIsSavingLabels] = useState(false)
  const [isMovingImage, setIsMovingImage] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [diseaseOptions, setDiseaseOptions] = useState([])
  const [moveTargetDiseaseId, setMoveTargetDiseaseId] = useState('')
  const [moveDiseaseSearch, setMoveDiseaseSearch] = useState('')
  const [isMoveSearchOpen, setIsMoveSearchOpen] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [predictionStatus, setPredictionStatus] = useState('')
  const [predictionError, setPredictionError] = useState('')
  const [isPredicting, setIsPredicting] = useState(false)

  const selectedImage = normalizeImage(image)
  const canPredictImage = isUnlabeledImage(selectedImage)
  const moveOptions = [
    { id: HEALTHY_MOVE_VALUE, label: 'Khỏe mạnh' },
    ...diseaseOptions.map((disease) => ({ id: String(disease.id), label: disease.name })),
  ]
  const filteredMoveOptions = moveOptions.filter((option) => {
    const query = moveDiseaseSearch.trim().toLowerCase()
    return option.id === HEALTHY_MOVE_VALUE || !query || String(option.label || '').toLowerCase().includes(query)
  }).slice(0, 5)

  const runPrediction = useCallback(async () => {
    if (!selectedImage?.id) {
      return
    }

    setIsPredicting(true)
    setPrediction(null)
    setPredictionError('')
    setPredictionStatus('Đang dự đoán bệnh...')

    try {
      const response = await fetch('/api/predict/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_id: selectedImage.id,
          top_k: 3,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể dự đoán ảnh này.')
      }

      setPrediction(data)
      setPredictionStatus('Đã có kết quả dự đoán.')
    } catch (error) {
      setPredictionStatus('')
      setPredictionError(error?.message || 'Hiện chưa thể dự đoán ảnh này.')
    } finally {
      setIsPredicting(false)
    }
  }, [selectedImage?.id])

  const loadDiseaseOptions = useCallback(async () => {
    const response = await fetch('/api/wheat-diseases/?choices=true', {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Không thể tải thư mục bệnh.')
    }

    const data = await response.json()
    setDiseaseOptions(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    setLabelDraft(draftFromImage(image))
    setLabelStatus('')
    setMoveStatus('')
    setMoveTargetDiseaseId('')
    setMoveDiseaseSearch('')
    setIsMoveSearchOpen(false)
  }, [image])

  useEffect(() => {
    if (!canManageImages || !isUnlabeledImage(image)) {
      return
    }

    let isMounted = true

    loadDiseaseOptions().catch(() => {
      if (isMounted) {
        setMoveStatus('Không thể tải thư mục bệnh.')
      }
    })

    return () => {
      isMounted = false
    }
  }, [canManageImages, image, loadDiseaseOptions])

  useEffect(() => {
    if (!canPredictImage) {
      setPrediction(null)
      setPredictionStatus('')
      setPredictionError('')
      return
    }

    let isMounted = true

    runPrediction().finally(() => {
      if (!isMounted) {
        setPredictionStatus('')
      }
    })

    return () => {
      isMounted = false
    }
  }, [canPredictImage, runPrediction])

  function closeViewer() {
    if (isSavingLabels || isMovingImage || isDeletingImage) {
      return
    }

    onClose()
  }

  function updateLabelDraft(field, value) {
    setLabelDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  async function handleSaveLabels() {
    if (!selectedImage) {
      return
    }

    setIsSavingLabels(true)
    setLabelStatus('Đang lưu dữ liệu đặc tả...')

    try {
      const response = await fetch(`/api/images/${selectedImage.id}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(labelDraft),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể lưu dữ liệu đặc tả.')
      }

      const updatedImage = normalizeImage(data)
      onImageUpdated(updatedImage)
      setLabelDraft(draftFromImage(updatedImage))
      setLabelStatus('Đã lưu dữ liệu đặc tả.')
    } catch (error) {
      setLabelStatus(error?.message || 'Hiện chưa thể lưu dữ liệu đặc tả.')
    } finally {
      setIsSavingLabels(false)
    }
  }

  async function handleMoveImage(targetDiseaseId = moveTargetDiseaseId) {
    if (!selectedImage || !targetDiseaseId) {
      setMoveStatus('Vui lòng chọn thư mục bệnh trước.')
      return
    }

    setIsMovingImage(true)
    setMoveStatus('Đang chuyển ảnh...')

    try {
      const response = await fetch(`/api/images/${selectedImage.id}/move/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          targetDiseaseId === HEALTHY_MOVE_VALUE
            ? { healthy: true }
            : { disease_id: targetDiseaseId }
        ),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể chuyển ảnh.')
      }

      const updatedImage = normalizeImage(data)
      onImageMoved(updatedImage)
      setLabelDraft(draftFromImage(updatedImage))
      setMoveTargetDiseaseId('')
      setMoveDiseaseSearch('')
      setIsMoveSearchOpen(false)
      setMoveStatus('Đã chuyển ảnh.')
    } catch (error) {
      setMoveStatus(error?.message || 'Hiện chưa thể chuyển ảnh.')
    } finally {
      setIsMovingImage(false)
    }
  }

  async function handleDeleteImage() {
    if (!selectedImage || !window.confirm('Xóa ảnh này?')) {
      return
    }

    setIsDeletingImage(true)
    setLabelStatus('Đang xóa ảnh...')

    try {
      const response = await fetch(`/api/images/${selectedImage.id}/`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.detail || 'Không thể xóa ảnh.')
      }

      onImageDeleted(selectedImage)
      setLabelStatus('')
      setMoveStatus('')
    } catch (error) {
      setLabelStatus(error?.message || 'Hiện chưa thể xóa ảnh.')
    } finally {
      setIsDeletingImage(false)
    }
  }

  function updateMoveSearch(value) {
    setMoveDiseaseSearch(value)
    setMoveTargetDiseaseId('')
    setIsMoveSearchOpen(true)
  }

  function selectMoveOption(option) {
    setMoveTargetDiseaseId(option.id)
    setMoveDiseaseSearch(option.label)
    setIsMoveSearchOpen(false)
  }

  return (
    <section className="image-viewer" role="dialog" aria-modal="true" aria-label={`Gắn nhãn ${selectedImage.file_name}`}>
      <div className="image-viewer__stage">
        <button type="button" className="image-viewer__close" aria-label="Đóng trình xem ảnh" onClick={closeViewer}>
          x
        </button>
        <img src={selectedImage.image_url} alt={selectedImage.display_name || selectedImage.file_name} />
      </div>
      <aside className="image-viewer__panel">
        <div className="image-viewer__panel-head">
          <p className="eyebrow">Gắn nhãn ảnh</p>
          <h3>{selectedImage.file_name}</h3>
        </div>

        <dl className="image-viewer__facts">
          <div>
            <dt>Người tải lên</dt>
            <dd>{selectedImage.created_by || 'Không rõ người tải lên'}</dd>
          </div>
          <div>
            <dt>Ngày tải lên</dt>
            <dd>{formatImageDate(selectedImage.uploaded_at)}</dd>
          </div>
          <div>
            <dt>Thư mục</dt>
            <dd>{selectedImage.image_key?.split('/')[0] || UNLABELED_FOLDER_NAME}</dd>
          </div>
        </dl>

        {canManageImages && isUnlabeledImage(selectedImage) ? (
          <div className="image-move-form">
            <label>
              <span>Chuyển tới thư mục bệnh</span>
              <div className="image-move-combobox">
                <input
                  type="search"
                  value={moveDiseaseSearch}
                  disabled={isMovingImage}
                  onFocus={() => setIsMoveSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setIsMoveSearchOpen(false), 120)}
                  onChange={(event) => updateMoveSearch(event.target.value)}
                  placeholder="Tìm bệnh hoặc chọn Khỏe mạnh"
                  role="combobox"
                  aria-expanded={isMoveSearchOpen}
                  aria-autocomplete="list"
                />
                {isMoveSearchOpen && !isMovingImage ? (
                  <div className="image-move-suggestions" role="listbox">
                    {filteredMoveOptions.length > 0 ? (
                      filteredMoveOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="option"
                          className={option.id === moveTargetDiseaseId ? 'image-move-suggestion image-move-suggestion--selected' : 'image-move-suggestion'}
                          aria-selected={option.id === moveTargetDiseaseId}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectMoveOption(option)}
                        >
                          <i className="fas fa-search" aria-hidden="true" />
                          <span>{option.label}</span>
                        </button>
                      ))
                    ) : (
                      <span className="image-move-suggestion image-move-suggestion--empty">Không có bệnh phù hợp</span>
                    )}
                  </div>
                ) : null}
              </div>
            </label>
            <button
              type="button"
              className="secondary-btn image-move-button"
              disabled={isMovingImage || !moveTargetDiseaseId}
              onClick={() => handleMoveImage()}
            >
              {isMovingImage ? 'Đang chuyển...' : 'Chuyển ảnh'}
            </button>
          </div>
        ) : null}

        {canPredictImage ? (
          <PredictionAssistantBubble
            prediction={prediction}
            predictionStatus={predictionStatus}
            predictionError={predictionError}
            isPredicting={isPredicting}
            isMovingImage={isMovingImage}
            diseaseOptions={diseaseOptions}
            onRetry={runPrediction}
            onMoveToDisease={handleMoveImage}
          />
        ) : null}

        <div className="image-label-form">
          <label>
            <span>Chú thích</span>
            <input
              type="text"
              value={labelDraft.caption}
              disabled={!canManageImages || isSavingLabels}
              onChange={(event) => updateLabelDraft('caption', event.target.value)}
            />
          </label>
          <label>
            <span>Vị trí</span>
            <input
              type="text"
              value={labelDraft.location}
              disabled={!canManageImages || isSavingLabels}
              onChange={(event) => updateLabelDraft('location', event.target.value)}
            />
          </label>
          <label>
            <span>Nền</span>
            <input
              type="text"
              value={labelDraft.background}
              disabled={!canManageImages || isSavingLabels}
              onChange={(event) => updateLabelDraft('background', event.target.value)}
            />
          </label>
          <label>
            <span>Thời tiết</span>
            <input
              type="text"
              value={labelDraft.weather}
              disabled={!canManageImages || isSavingLabels}
              onChange={(event) => updateLabelDraft('weather', event.target.value)}
            />
          </label>
          <label>
            <span>Thời điểm trong ngày</span>
            <input
              type="text"
              value={labelDraft.timeOfDay}
              disabled={!canManageImages || isSavingLabels}
              onChange={(event) => updateLabelDraft('timeOfDay', event.target.value)}
            />
          </label>
        </div>

        {labelStatus ? <p className="image-label-status">{labelStatus}</p> : null}
        {moveStatus ? <p className="image-label-status">{moveStatus}</p> : null}

        {canManageImages ? (
          <button type="button" className="primary-btn image-label-save" disabled={isSavingLabels} onClick={handleSaveLabels}>
            {isSavingLabels ? 'Đang lưu...' : 'lưu dữ liệu đặc tả'}
          </button>
        ) : null}
        {canManageImages ? (
          <button
            type="button"
            className="image-delete-button"
            disabled={isSavingLabels || isMovingImage || isDeletingImage}
            onClick={handleDeleteImage}
          >
            {isDeletingImage ? 'Đang xóa...' : 'Xóa ảnh'}
          </button>
        ) : null}
      </aside>
    </section>
  )
}

export default ImageFocusViewer
