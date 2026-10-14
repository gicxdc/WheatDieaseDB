import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PredictionAssistantBubble from './PredictionAssistantBubble'

const ROOT_FOLDER_NAME = 'WD_IMG'
const UNLABELED_FOLDER_NAME = 'unlabeled'
const HEALTHY_MOVE_VALUE = 'healthy'
const IMAGE_UPLOAD_BATCH_SIZE = 50

function uploadFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function formatImageDate(value) {
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

function formatImageCount(count) {
  return `${count} ảnh`
}

function displayFolderName(folderName) {
  if (folderName === UNLABELED_FOLDER_NAME) {
    return 'Chưa gán nhãn'
  }

  if (folderName === 'healthy') {
    return 'Khỏe mạnh'
  }

  return folderName
}

function uploadFileStateLabel(fileState) {
  if (fileState === 'done') {
    return 'Đã tải lên'
  }

  if (fileState === 'failed') {
    return 'Thất bại'
  }

  if (fileState === 'uploading') {
    return 'Đang tải lên'
  }

  return 'Đang chờ'
}

function filenameFromImageKey(imageKey) {
  if (!imageKey) {
    return ''
  }

  const parts = String(imageKey).split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

function buildImageTree(images) {
  const folders = new Map()

  images.forEach((image) => {
    const keyParts = String(image.image_key || '').split('/').filter(Boolean)
    if (keyParts.length <= 1 || keyParts[0] === UNLABELED_FOLDER_NAME) {
      return
    }

    const folderName = keyParts[0]
    const fileName = keyParts.slice(1).join('/')

    if (!folders.has(folderName)) {
      folders.set(folderName, [])
    }

    folders.get(folderName).push({
      ...image,
      file_name: fileName || filenameFromImageKey(image.image_key) || image.display_name,
    })
  })

  return Array.from(folders.entries())
    .map(([folderName, folderImages]) => ({
      folderName,
      images: folderImages.sort((a, b) => a.file_name.localeCompare(b.file_name)),
    }))
    .sort((a, b) => a.folderName.localeCompare(b.folderName))
}

function buildUnlabeledImages(images) {
  return images
    .filter((image) => {
      const keyParts = String(image.image_key || '').split('/').filter(Boolean)
      return keyParts.length <= 1 || keyParts[0] === UNLABELED_FOLDER_NAME
    })
    .map((image) => ({
      ...image,
      file_name: filenameFromImageKey(image.image_key) || image.display_name,
    }))
    .sort((a, b) => a.file_name.localeCompare(b.file_name))
}

function normalizeImage(image) {
  return {
    ...image,
    disease_id: image.disease_id,
    disease_name: image.disease_name,
    display_name: image.caption || image.disease_name || filenameFromImageKey(image.image_key) || `Ảnh ${image.id}`,
  }
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

function emptyUploadDraft() {
  return {
    location: '',
    background: '',
    weather: '',
    timeOfDay: '',
  }
}

function isUnlabeledImage(image) {
  const keyParts = String(image?.image_key || '').split('/').filter(Boolean)
  return !image?.disease_id && (keyParts.length <= 1 || keyParts[0] === UNLABELED_FOLDER_NAME)
}

function diseaseIdFromFolderName(folderName) {
  const match = String(folderName || '').match(/^disease_(\d+)$/)
  return match ? match[1] : ''
}

function isHealthyFolder(folderName) {
  return folderName === HEALTHY_MOVE_VALUE
}

function ImageFileRow({ image, onOpen }) {
  return (
    <button type="button" className="image-file" onClick={() => onOpen(image)}>
      <div className="image-file__name-cell">
        <span className="image-file__icon" aria-hidden="true" />
        <span title={image.file_name}>{image.file_name}</span>
      </div>
      <span className="image-file__date">{formatImageDate(image.uploaded_at)}</span>
      <span className="image-file__uploader">{image.created_by || 'Không rõ người tải lên'}</span>
    </button>
  )
}

function ImagePage({ currentUser }) {
  const navigate = useNavigate()
  const [images, setImages] = useState([])
  const [status, setStatus] = useState('Đang tải ảnh...')
  const [uploadStatus, setUploadStatus] = useState('')
  const [labelStatus, setLabelStatus] = useState('')
  const [moveStatus, setMoveStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingLabels, setIsSavingLabels] = useState(false)
  const [isMovingImage, setIsMovingImage] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState([])
  const [uploadFileStates, setUploadFileStates] = useState({})
  const [uploadDraft, setUploadDraft] = useState(() => emptyUploadDraft())
  const [isUploadAttributeConfirmed, setIsUploadAttributeConfirmed] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [labelDraft, setLabelDraft] = useState(() => draftFromImage(null))
  const [diseaseOptions, setDiseaseOptions] = useState([])
  const [moveTargetDiseaseId, setMoveTargetDiseaseId] = useState('')
  const [moveDiseaseSearch, setMoveDiseaseSearch] = useState('')
  const [isMoveSearchOpen, setIsMoveSearchOpen] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [predictionStatus, setPredictionStatus] = useState('')
  const [predictionError, setPredictionError] = useState('')
  const [isPredicting, setIsPredicting] = useState(false)
  const [openFolders, setOpenFolders] = useState(() => new Set([ROOT_FOLDER_NAME, UNLABELED_FOLDER_NAME]))
  const fileInputRef = useRef(null)
  const canUploadImages =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert' ||
    currentUser?.role === 'helper'

  const loadImages = useCallback(async () => {
    const response = await fetch('/api/images/', {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Không thể tải ảnh.')
    }

    const data = await response.json()
    const nextImages = (Array.isArray(data) ? data : []).map(normalizeImage)

    setImages(nextImages)
    setStatus('')
  }, [])

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
    let isMounted = true

    loadImages().catch(() => {
      if (isMounted) {
        setStatus('Hiện chưa thể tải ảnh.')
      }
    })

    return () => {
      isMounted = false
    }
  }, [loadImages])

  useEffect(() => {
    if (!canUploadImages) {
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
  }, [canUploadImages, loadDiseaseOptions])

  const imageTree = buildImageTree(images)
  const unlabeledImages = buildUnlabeledImages(images)
  const moveOptions = [
    { id: HEALTHY_MOVE_VALUE, label: 'Khỏe mạnh' },
    ...diseaseOptions.map((disease) => ({ id: String(disease.id), label: disease.name })),
  ]
  const filteredMoveOptions = moveOptions.filter((option) => {
    const query = moveDiseaseSearch.trim().toLowerCase()
    return option.id === HEALTHY_MOVE_VALUE || !query || String(option.label || '').toLowerCase().includes(query)
  }).slice(0, 5)
  const storedImageCount = imageTree.reduce((total, folder) => total + folder.images.length, 0)
  const canPredictSelectedImage = selectedImage && isUnlabeledImage(selectedImage)

  const runSelectedImagePrediction = useCallback(async () => {
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

  useEffect(() => {
    if (!canPredictSelectedImage) {
      setPrediction(null)
      setPredictionStatus('')
      setPredictionError('')
      return
    }

    runSelectedImagePrediction()
  }, [canPredictSelectedImage, runSelectedImagePrediction])

  function toggleFolder(folderName) {
    setOpenFolders((currentFolders) => {
      const nextFolders = new Set(currentFolders)

      if (nextFolders.has(folderName)) {
        nextFolders.delete(folderName)
      } else {
        nextFolders.add(folderName)
      }

      return nextFolders
    })
  }

  function isFolderOpen(folderName) {
    return openFolders.has(folderName)
  }

  function openImageModal(image) {
    setSelectedImage(image)
    setLabelDraft(draftFromImage(image))
    setLabelStatus('')
    setMoveStatus('')
    setMoveTargetDiseaseId('')
    setMoveDiseaseSearch('')
    setIsMoveSearchOpen(false)
    setPrediction(null)
    setPredictionStatus('')
    setPredictionError('')
  }

  function openUnlabeledGallery(event) {
    event.stopPropagation()
    navigate('/image/unlabeled-gallery')
  }

  function openHealthyGallery(event) {
    event.stopPropagation()
    navigate('/image/healthy-gallery')
  }

  function openDiseaseGallery(event, diseaseId) {
    event.stopPropagation()
    if (diseaseId) {
      navigate(`/database/${diseaseId}/gallery`)
    }
  }

  function closeImageModal() {
    if (isSavingLabels || isMovingImage || isDeletingImage) {
      return
    }

    setSelectedImage(null)
    setLabelStatus('')
    setPrediction(null)
    setPredictionStatus('')
    setPredictionError('')
  }

  function updateLabelDraft(field, value) {
    setLabelDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  function updateUploadDraft(field, value) {
    setIsUploadAttributeConfirmed(false)
    setUploadFiles([])
    setUploadFileStates({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setUploadDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }))
  }

  function openUploadModal() {
    setUploadStatus('')
    setIsUploadModalOpen(true)
  }

  function closeUploadModal() {
    if (isUploading) {
      return
    }

    setIsUploadModalOpen(false)
    setUploadFiles([])
    setUploadFileStates({})
    setUploadDraft(emptyUploadDraft())
    setIsUploadAttributeConfirmed(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
      setImages((currentImages) =>
        currentImages.map((image) => (image.id === updatedImage.id ? updatedImage : image))
      )
      setSelectedImage(updatedImage)
      setLabelDraft(draftFromImage(updatedImage))
      setLabelStatus('Đã lưu dữ liệu đặc tả.')
    } catch (error) {
      setLabelStatus(error?.message || 'Hiện chưa thể lưu dữ liệu đặc tả.')
    } finally {
      setIsSavingLabels(false)
    }
  }

  async function uploadImages(filesToUpload) {
    if (!isUploadAttributeConfirmed) {
      setUploadStatus('Xác nhận thuộc tính ảnh trước khi chọn ảnh.')
      return
    }

    if (filesToUpload.length === 0) {
      setUploadStatus('Hãy chọn ít nhất một ảnh trước.')
      return
    }

    setIsUploading(true)
    setUploadFileStates(
      Object.fromEntries(filesToUpload.map((file) => [uploadFileKey(file), 'waiting']))
    )
    setUploadStatus(`Đang tải lên ${formatImageCount(filesToUpload.length)}...`)

    try {
      const batchCount = Math.ceil(filesToUpload.length / IMAGE_UPLOAD_BATCH_SIZE)
      let uploadedCount = 0

      for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
        const batchStart = batchIndex * IMAGE_UPLOAD_BATCH_SIZE
        const filesInBatch = filesToUpload.slice(batchStart, batchStart + IMAGE_UPLOAD_BATCH_SIZE)
        const formData = new FormData()

        filesInBatch.forEach((file) => {
          formData.append('images', file)
        })
        formData.append('location', uploadDraft.location)
        formData.append('background', uploadDraft.background)
        formData.append('weather', uploadDraft.weather)
        formData.append('timeOfDay', uploadDraft.timeOfDay)
        formData.append('audit_mode', batchIndex === batchCount - 1 ? 'summary' : 'skip')
        formData.append('audit_prior_count', String(uploadedCount))

        setUploadStatus(
          `Đang tải lô ${batchIndex + 1}/${batchCount}: đã tải ${uploadedCount}/${filesToUpload.length} ảnh.`
        )
        setUploadFileStates((currentStates) => {
          const nextStates = { ...currentStates }
          filesInBatch.forEach((file) => {
            nextStates[uploadFileKey(file)] = 'uploading'
          })
          return nextStates
        })

        const response = await fetch('/api/images/upload/', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          setUploadFileStates((currentStates) => {
            const nextStates = { ...currentStates }
            filesInBatch.forEach((file) => {
              nextStates[uploadFileKey(file)] = 'failed'
            })
            return nextStates
          })
          throw new Error(data?.detail || `Không thể tải lô ${batchIndex + 1}.`)
        }

        uploadedCount += filesInBatch.length
        setUploadFileStates((currentStates) => {
          const nextStates = { ...currentStates }
          filesInBatch.forEach((file) => {
            nextStates[uploadFileKey(file)] = 'done'
          })
          return nextStates
        })
      }

      await loadImages()
      setOpenFolders((currentFolders) => new Set([...currentFolders, UNLABELED_FOLDER_NAME]))
      setUploadStatus(`Đã tải lên ${formatImageCount(filesToUpload.length)}.`)
      setIsUploadModalOpen(false)
      setUploadFiles([])
      setUploadFileStates({})
      setUploadDraft(emptyUploadDraft())
      setIsUploadAttributeConfirmed(false)
    } catch (error) {
      setUploadStatus(error?.message || 'Hiện chưa thể tải ảnh lên.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleMoveImage(targetDiseaseId = moveTargetDiseaseId) {
    if (!selectedImage || !targetDiseaseId) {
      setMoveStatus('Hãy chọn thư mục bệnh trước.')
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
      setImages((currentImages) =>
        currentImages.map((image) => (image.id === updatedImage.id ? updatedImage : image))
      )
      setSelectedImage(updatedImage)
      setLabelDraft(draftFromImage(updatedImage))
      setMoveTargetDiseaseId('')
      setMoveDiseaseSearch('')
      setIsMoveSearchOpen(false)
      setMoveStatus('Đã chuyển ảnh.')
      setOpenFolders((currentFolders) => {
        const nextFolders = new Set(currentFolders)
        nextFolders.add(ROOT_FOLDER_NAME)
        if (updatedImage.disease_id) {
          nextFolders.add(`disease_${updatedImage.disease_id}`)
        } else if (String(updatedImage.image_key || '').startsWith('healthy/')) {
          nextFolders.add('healthy')
        }
        return nextFolders
      })
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

      setImages((currentImages) => currentImages.filter((image) => image.id !== selectedImage.id))
      setSelectedImage(null)
      setLabelStatus('')
      setMoveStatus('')
    } catch (error) {
      setLabelStatus(error?.message || 'Hiện chưa thể xóa ảnh.')
    } finally {
      setIsDeletingImage(false)
    }
  }

  function handleUploadPickerBlocked() {
    if (!isUploadAttributeConfirmed) {
      setUploadStatus('Xác nhận thuộc tính ảnh trước khi chọn ảnh.')
    }
  }

  function handleUploadFileSelection(event) {
    const selectedFiles = Array.from(event.target.files || [])
    setUploadFiles(selectedFiles)
    setUploadFileStates(
      Object.fromEntries(selectedFiles.map((file) => [uploadFileKey(file), 'waiting']))
    )
    if (selectedFiles.length > 0) {
      uploadImages(selectedFiles)
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
    <main className="blank-page image-page">
      <section className="blank-page__card image-shell">
        <p className="eyebrow">Hình ảnh</p>
        <div className="image-page__head">
          <h2>Thư viện hình ảnh</h2>
          {canUploadImages ? (
            <>
              <button
                type="button"
                className="primary-btn image-upload-button"
                disabled={isUploading}
                onClick={openUploadModal}
              >
                {isUploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
              </button>
            </>
          ) : null}
        </div>

        {status ? <p className="database-status">{status}</p> : null}
        {uploadStatus ? <p className="image-upload-status">{uploadStatus}</p> : null}

        <div className="image-tree" aria-label="Cây thư mục hình ảnh">
          <section className="image-folder image-folder--root">
            <button
              type="button"
              className="image-folder__row"
              aria-expanded={isFolderOpen(ROOT_FOLDER_NAME)}
              onClick={() => toggleFolder(ROOT_FOLDER_NAME)}
            >
              <span className={isFolderOpen(ROOT_FOLDER_NAME) ? 'image-folder__caret image-folder__caret--open' : 'image-folder__caret'} />
              <span className="image-folder__icon" aria-hidden="true" />
              <span className="image-folder__name">{ROOT_FOLDER_NAME}</span>
              <span className="image-folder__count">{formatImageCount(storedImageCount)}</span>
            </button>

            {isFolderOpen(ROOT_FOLDER_NAME) ? (
              <div className="image-folder__children">
                {imageTree.length === 0 ? (
                  <p className="image-file-list__empty">Thư mục này đang trống.</p>
                ) : null}
                {imageTree.map((folder) => (
                  <section key={folder.folderName} className="image-folder">
                    <button
                      type="button"
                      className="image-folder__row"
                      aria-expanded={isFolderOpen(folder.folderName)}
                      onClick={() => toggleFolder(folder.folderName)}
                    >
                      <span className={isFolderOpen(folder.folderName) ? 'image-folder__caret image-folder__caret--open' : 'image-folder__caret'} />
                      <span className="image-folder__icon" aria-hidden="true" />
                      <span className="image-folder__name">{displayFolderName(folder.folderName)}</span>
                      <span className="image-folder__actions">
                        <span className="image-folder__count">
                          {formatImageCount(folder.images.length)}
                        </span>
                        {diseaseIdFromFolderName(folder.folderName) || isHealthyFolder(folder.folderName) ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="image-folder__move-button"
                            onClick={(event) => {
                              if (isHealthyFolder(folder.folderName)) {
                                openHealthyGallery(event)
                              } else {
                                openDiseaseGallery(event, diseaseIdFromFolderName(folder.folderName))
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                if (isHealthyFolder(folder.folderName)) {
                                  openHealthyGallery(event)
                                } else {
                                  openDiseaseGallery(event, diseaseIdFromFolderName(folder.folderName))
                                }
                              }
                            }}
                          >
                            Mở thư viện
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {isFolderOpen(folder.folderName) ? (
                      <div className="image-file-list">
                        {folder.images.length === 0 ? (
                          <p className="image-file-list__empty">Thư mục này đang trống.</p>
                        ) : null}
                        {folder.images.map((image) => (
                          <ImageFileRow
                            key={`${image.disease_id || 'unlabeled'}-${image.id}`}
                            image={image}
                            onOpen={openImageModal}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            ) : null}
          </section>

          <section className="image-folder image-folder--root">
            <button
              type="button"
              className="image-folder__row"
              aria-expanded={isFolderOpen(UNLABELED_FOLDER_NAME)}
              onClick={() => toggleFolder(UNLABELED_FOLDER_NAME)}
            >
              <span className={isFolderOpen(UNLABELED_FOLDER_NAME) ? 'image-folder__caret image-folder__caret--open' : 'image-folder__caret'} />
              <span className="image-folder__icon" aria-hidden="true" />
              <span className="image-folder__name">{displayFolderName(UNLABELED_FOLDER_NAME)}</span>
              <span className="image-folder__actions">
                <span className="image-folder__count">
                  {formatImageCount(unlabeledImages.length)}
                </span>
                {unlabeledImages.length > 0 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    className="image-folder__move-button"
                    onClick={openUnlabeledGallery}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openUnlabeledGallery(event)
                      }
                    }}
                  >
                    Mở thư viện
                  </span>
                ) : null}
              </span>
            </button>

            {isFolderOpen(UNLABELED_FOLDER_NAME) ? (
              <div className="image-file-list image-file-list--root">
                {unlabeledImages.length === 0 ? (
                  <p className="image-file-list__empty">Thư mục này đang trống.</p>
                ) : null}
                {unlabeledImages.map((image) => (
                  <ImageFileRow key={`unlabeled-${image.id}`} image={image} onOpen={openImageModal} />
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </section>
      {isUploadModalOpen ? (
        <section className="image-upload-modal" role="dialog" aria-modal="true" aria-label="Tải ảnh lên">
          <div className="image-upload-modal__workspace">
            <div className="image-upload-dropzone">
              <p className="eyebrow">Chọn ảnh</p>
              {isUploadAttributeConfirmed ? (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploading}
                  onChange={handleUploadFileSelection}
                />
              ) : (
                <button type="button" className="image-upload-picker__blocked" onClick={handleUploadPickerBlocked}>
                  Chọn ảnh
                </button>
              )}
              <div className="image-upload-progress">
                <strong>
                  {uploadFiles.length > 0
                    ? `Đã chọn ${formatImageCount(uploadFiles.length)}`
                    : isUploadAttributeConfirmed
                      ? 'Chưa chọn ảnh'
                      : 'Chưa chọn ảnh'}
                </strong>
                {!isUploadAttributeConfirmed ? <span>{uploadStatus || 'Xác nhận thuộc tính trước.'}</span> : null}
                {isUploadAttributeConfirmed && uploadStatus ? <span>{uploadStatus}</span> : null}
              </div>
              {uploadFiles.length > 0 ? (
                <div className="image-upload-file-list" aria-label="Ảnh đã chọn">
                  {uploadFiles.map((file) => {
                    const fileState = uploadFileStates[uploadFileKey(file)] || 'waiting'

                    return (
                      <div key={uploadFileKey(file)} className="image-upload-file-row">
                        <span className="image-upload-tray__file-icon" aria-hidden="true" />
                        <span title={file.name}>{file.name}</span>
                        <span
                          className={`image-upload-tray__state image-upload-tray__state--${fileState}${
                            fileState === 'uploading' ? ' image-upload-tray__spinner--active' : ''
                          }`}
                          aria-label={uploadFileStateLabel(fileState)}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
          <aside className="image-upload-modal__card">
            <div className="image-upload-tray__head">
              <div className="image-upload-tray__head-actions">
                <button type="button" aria-label="Đóng bảng tải ảnh" disabled={isUploading} onClick={closeUploadModal}>
                  x
                </button>
              </div>
            </div>
            <div className="image-label-form image-upload-modal__form">
              <label>
                <span>Vị trí</span>
                <input
                  type="text"
                  value={uploadDraft.location}
                  disabled={isUploading}
                  onChange={(event) => updateUploadDraft('location', event.target.value)}
                />
              </label>
              <label>
                <span>Nền</span>
                <input
                  type="text"
                  value={uploadDraft.background}
                  disabled={isUploading}
                  onChange={(event) => updateUploadDraft('background', event.target.value)}
                />
              </label>
              <label>
                <span>Thời tiết</span>
                <input
                  type="text"
                  value={uploadDraft.weather}
                  disabled={isUploading}
                  onChange={(event) => updateUploadDraft('weather', event.target.value)}
                />
              </label>
              <label>
                <span>Thời điểm trong ngày</span>
                <input
                  type="text"
                  value={uploadDraft.timeOfDay}
                  disabled={isUploading}
                  onChange={(event) => updateUploadDraft('timeOfDay', event.target.value)}
                />
              </label>
            </div>
            <div className="image-upload-modal__actions">
              <button
                type="button"
                className="primary-btn"
                disabled={isUploading || isUploadAttributeConfirmed}
                onClick={() => {
                  setIsUploadAttributeConfirmed(true)
                  setUploadStatus('Đã xác nhận thuộc tính. Bây giờ bạn có thể chọn ảnh.')
                }}
              >
                {isUploadAttributeConfirmed ? 'Đã xác nhận thuộc tính' : 'Xác nhận thuộc tính'}
              </button>
            </div>
          </aside>
        </section>
      ) : null}
      {selectedImage ? (
        <section className="image-viewer" role="dialog" aria-modal="true" aria-label={`Gắn nhãn ${selectedImage.file_name}`}>
          <div className="image-viewer__stage">
            <button type="button" className="image-viewer__close" aria-label="Đóng trình xem ảnh" onClick={closeImageModal}>
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
                <dd>{displayFolderName(selectedImage.image_key?.split('/')[0] || UNLABELED_FOLDER_NAME)}</dd>
              </div>
            </dl>

            {canUploadImages && isUnlabeledImage(selectedImage) ? (
              <div className="image-move-form">
                <label>
                  <span>Chuyển vào thư mục bệnh</span>
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

            {canPredictSelectedImage ? (
              <PredictionAssistantBubble
                prediction={prediction}
                predictionStatus={predictionStatus}
                predictionError={predictionError}
                isPredicting={isPredicting}
                isMovingImage={isMovingImage}
                diseaseOptions={diseaseOptions}
                onRetry={runSelectedImagePrediction}
                onMoveToDisease={handleMoveImage}
              />
            ) : null}

            <div className="image-label-form">
              <label>
                <span>Chú thích</span>
                <input
                  type="text"
                  value={labelDraft.caption}
                  disabled={!canUploadImages || isSavingLabels}
                  onChange={(event) => updateLabelDraft('caption', event.target.value)}
                />
              </label>
              <label>
                <span>Vị trí</span>
                <input
                  type="text"
                  value={labelDraft.location}
                  disabled={!canUploadImages || isSavingLabels}
                  onChange={(event) => updateLabelDraft('location', event.target.value)}
                />
              </label>
              <label>
                <span>Nền</span>
                <input
                  type="text"
                  value={labelDraft.background}
                  disabled={!canUploadImages || isSavingLabels}
                  onChange={(event) => updateLabelDraft('background', event.target.value)}
                />
              </label>
              <label>
                <span>Thời tiết</span>
                <input
                  type="text"
                  value={labelDraft.weather}
                  disabled={!canUploadImages || isSavingLabels}
                  onChange={(event) => updateLabelDraft('weather', event.target.value)}
                />
              </label>
              <label>
                <span>Thời điểm trong ngày</span>
                <input
                  type="text"
                  value={labelDraft.timeOfDay}
                  disabled={!canUploadImages || isSavingLabels}
                  onChange={(event) => updateLabelDraft('timeOfDay', event.target.value)}
                />
              </label>
            </div>

            {labelStatus ? <p className="image-label-status">{labelStatus}</p> : null}
            {moveStatus ? <p className="image-label-status">{moveStatus}</p> : null}

            {canUploadImages ? (
              <button type="button" className="primary-btn image-label-save" disabled={isSavingLabels} onClick={handleSaveLabels}>
                {isSavingLabels ? 'Đang lưu...' : 'lưu dữ liệu đặc tả'}
              </button>
            ) : null}
            {canUploadImages ? (
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
      ) : null}
    </main>
  )
}

export default ImagePage
