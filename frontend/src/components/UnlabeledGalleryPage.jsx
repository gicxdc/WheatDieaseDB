import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ImageFocusViewer, { filenameFromImageKey, isUnlabeledImage, normalizeImage } from './ImageFocusViewer'
import { GalleryFilterPanel, emptyGalleryFilters, filterGalleryImages, sortGalleryImages } from './galleryFilters'

const GALLERY_PAGE_SIZE = 9
const DELETE_BATCH_SIZE = 50
const GALLERY_MODES = {
  unlabeled: {
    statusLoading: 'Đang tải thư viện chưa gán nhãn...',
    loadError: 'Không thể tải ảnh chưa gán nhãn.',
    statusError: 'Hiện chưa thể tải thư viện này.',
    eyebrow: 'Thư viện',
    title: 'Thư viện chưa gán nhãn',
    auditFolder: 'unlabeled',
    emptyText: 'Không có ảnh chưa gán nhãn.',
    filterImage(image) {
      return isUnlabeledImage(image)
    },
  },
  healthy: {
    statusLoading: 'Đang tải thư viện khỏe mạnh...',
    loadError: 'Không thể tải ảnh khỏe mạnh.',
    statusError: 'Hiện chưa thể tải thư viện này.',
    eyebrow: 'Thư viện',
    title: 'Thư viện khỏe mạnh',
    auditFolder: 'healthy',
    emptyText: 'Không có ảnh khỏe mạnh.',
    filterImage(image) {
      const keyParts = String(image?.image_key || '').split('/').filter(Boolean)
      return !image?.disease_id && keyParts[0] === 'healthy'
    },
  },
}

function imageIdKey(imageId) {
  return String(imageId)
}

function imageName(image) {
  return image.caption || filenameFromImageKey(image.image_key) || `Ảnh ${image.id}`
}

function UnlabeledGalleryPage({ currentUser, mode = 'unlabeled' }) {
  const galleryMode = GALLERY_MODES[mode] || GALLERY_MODES.unlabeled
  const [images, setImages] = useState([])
  const [status, setStatus] = useState(galleryMode.statusLoading)
  const [galleryPage, setGalleryPage] = useState(1)
  const [galleryPageInput, setGalleryPageInput] = useState('1')
  const [selectedImage, setSelectedImage] = useState(null)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [selectedDeleteImageIds, setSelectedDeleteImageIds] = useState(() => new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteStatus, setBulkDeleteStatus] = useState('')
  const [galleryFilters, setGalleryFilters] = useState(() => ({ ...emptyGalleryFilters }))
  const canManageImages =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert' ||
    currentUser?.role === 'helper'

  const loadImages = useCallback(async () => {
    const response = await fetch('/api/images/', {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(galleryMode.loadError)
    }

    const data = await response.json()
    const nextImages = (Array.isArray(data) ? data : []).filter(galleryMode.filterImage).map(normalizeImage)
    setImages(nextImages)
    setStatus('')
  }, [galleryMode])

  useEffect(() => {
    let isMounted = true

    loadImages().catch(() => {
      if (isMounted) {
        setStatus(galleryMode.statusError)
      }
    })

    return () => {
      isMounted = false
    }
  }, [galleryMode, loadImages])

  const galleryItems = sortGalleryImages(filterGalleryImages(images, galleryFilters), galleryFilters.sort)
  const galleryTotalPages = Math.max(1, Math.ceil(galleryItems.length / GALLERY_PAGE_SIZE))
  const currentGalleryPage = Math.min(galleryPage, galleryTotalPages)
  const galleryPageStart = (currentGalleryPage - 1) * GALLERY_PAGE_SIZE
  const visibleGalleryItems = galleryItems.slice(galleryPageStart, galleryPageStart + GALLERY_PAGE_SIZE)

  useEffect(() => {
    if (galleryPage > galleryTotalPages) {
      setGalleryPage(galleryTotalPages)
    }
  }, [galleryPage, galleryTotalPages])

  useEffect(() => {
    setGalleryPageInput(String(currentGalleryPage))
  }, [currentGalleryPage])

  function jumpToGalleryPage(value) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) {
      setGalleryPageInput(String(currentGalleryPage))
      return
    }

    const clamped = Math.min(galleryTotalPages, Math.max(1, parsed))
    setGalleryPage(clamped)
    setGalleryPageInput(String(clamped))
  }

  function updateGalleryFilter(field, value) {
    setGalleryFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }))
    setGalleryPage(1)
  }

  function clearGalleryFilters() {
    setGalleryFilters({ ...emptyGalleryFilters })
    setGalleryPage(1)
  }

  function handleImageUpdated(updatedImage) {
    const normalizedImage = normalizeImage(updatedImage)

    setImages((currentImages) =>
      currentImages.map((image) => (image.id === normalizedImage.id ? normalizedImage : image))
    )
    setSelectedImage(normalizedImage)
  }

  function handleImageDeleted(deletedImage) {
    setImages((currentImages) => currentImages.filter((image) => image.id !== deletedImage.id))
    setSelectedImage(null)
  }

  function handleImageMoved(updatedImage) {
    setImages((currentImages) => currentImages.filter((image) => image.id !== updatedImage.id))
    setSelectedImage(null)
  }

  function startDeleteMode() {
    setSelectedImage(null)
    setSelectedDeleteImageIds(new Set())
    setBulkDeleteStatus('Chọn ảnh cần xóa.')
    setIsDeleteMode(true)
  }

  function cancelDeleteMode() {
    if (isBulkDeleting) {
      return
    }

    setSelectedDeleteImageIds(new Set())
    setBulkDeleteStatus('')
    setIsDeleteMode(false)
  }

  function toggleDeleteSelection(image) {
    setSelectedDeleteImageIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(image.id)) {
        nextIds.delete(image.id)
      } else {
        nextIds.add(image.id)
      }

      return nextIds
    })
  }

  function openGalleryImage(image) {
    if (isDeleteMode) {
      toggleDeleteSelection(image)
      return
    }

    setSelectedImage(image)
  }

  async function handleBulkDelete() {
    const imageIds = Array.from(selectedDeleteImageIds)

    if (imageIds.length === 0) {
      setBulkDeleteStatus('Chọn ít nhất một ảnh để xóa.')
      return
    }

    setIsBulkDeleting(true)
    setBulkDeleteStatus(`Đang xóa ${imageIds.length} ảnh...`)

    const deleteResults = []
    const deletedImageIds = new Set()
    const batchCount = Math.ceil(imageIds.length / DELETE_BATCH_SIZE)

    try {
      for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
        const batchStart = batchIndex * DELETE_BATCH_SIZE
        const imageIdsInBatch = imageIds.slice(batchStart, batchStart + DELETE_BATCH_SIZE)

        setBulkDeleteStatus(
          `Đang xóa lô ${batchIndex + 1}/${batchCount}: đã xóa ${deletedImageIds.size}/${imageIds.length} ảnh.`
        )

        let response
        let data = {}

        try {
          response = await fetch('/api/images/bulk-delete/', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_ids: imageIdsInBatch,
              audit_mode: batchIndex === batchCount - 1 ? 'summary' : 'skip',
              audit_prior_count: deletedImageIds.size,
              audit_folder: galleryMode.auditFolder,
            }),
          })
          data = await response.json().catch(() => ({}))
        } catch {
          imageIdsInBatch.forEach((imageId) => {
            deleteResults.push({
              imageId,
              ok: false,
              detail: 'Không thể kết nối máy chủ.',
            })
          })
          continue
        }

        const deletedIds = new Set(
          Array.isArray(data?.deleted_image_ids) ? data.deleted_image_ids.map(imageIdKey) : []
        )
        const failuresById = new Map(
          Array.isArray(data?.failed)
            ? data.failed.map((failure) => [imageIdKey(failure.id), failure.detail || 'Không thể xóa ảnh.'])
            : []
        )

        const batchResults = imageIdsInBatch.map((imageId) => {
          const idKey = imageIdKey(imageId)
          if (deletedIds.has(idKey)) {
            return { imageId, ok: true }
          }

          return {
            imageId,
            ok: false,
            detail: failuresById.get(idKey) || data?.detail || 'Không thể xóa ảnh.',
          }
        })

        if (!response.ok && deletedIds.size === 0) {
          batchResults.forEach((result) => {
            result.ok = false
            result.detail = data?.detail || 'Không thể xóa ảnh.'
          })
        }

        batchResults.forEach((result) => {
          deleteResults.push(result)
          if (result.ok) {
            deletedImageIds.add(result.imageId)
          }
        })

        const deletedImageIdKeys = new Set(Array.from(deletedImageIds).map(imageIdKey))
        setImages((currentImages) =>
          currentImages.filter((image) => !deletedImageIdKeys.has(imageIdKey(image.id)))
        )
      }

      const failedImageIds = new Set(deleteResults.filter((result) => !result.ok).map((result) => result.imageId))

      setSelectedDeleteImageIds(failedImageIds)

      if (failedImageIds.size > 0) {
        setBulkDeleteStatus(
          `Đã xóa ${deletedImageIds.size} ảnh. ${failedImageIds.size} ảnh chưa thể xóa.`
        )
      } else {
        setBulkDeleteStatus('')
        setIsDeleteMode(false)
      }
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <main className="blank-page gallery-page">
      <section className="blank-page__card gallery-shell">
        <Link className="disease-detail-back" to="/image">
          Quay lại hình ảnh
        </Link>

        {status ? <p className="database-status">{status}</p> : null}

        <p className="eyebrow">{galleryMode.eyebrow}</p>
        <div className="gallery-head">
          <h2>{galleryMode.title}</h2>
          {canManageImages ? (
            <div className="gallery-delete-actions">
              {isDeleteMode ? (
                <>
                  <button type="button" disabled={isBulkDeleting} onClick={cancelDeleteMode}>
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="gallery-delete-actions__confirm"
                    disabled={isBulkDeleting || selectedDeleteImageIds.size === 0}
                    onClick={handleBulkDelete}
                  >
                    {isBulkDeleting ? 'Đang xóa...' : 'Xác nhận'}
                  </button>
                </>
              ) : (
                <button type="button" className="gallery-delete-actions__start" onClick={startDeleteMode}>
                  Xóa ảnh
                </button>
              )}
            </div>
          ) : null}
        </div>
        {bulkDeleteStatus ? <p className="gallery-delete-status">{bulkDeleteStatus}</p> : null}

        <GalleryFilterPanel
          filters={galleryFilters}
          onFilterChange={updateGalleryFilter}
          onClearFilters={clearGalleryFilters}
          resultCount={galleryItems.length}
          totalCount={images.length}
        />

        <div className="gallery-grid">
          {galleryItems.length > 0 ? (
            visibleGalleryItems.map((image) => (
              <article
                key={image.id || image.image_url}
                className={`gallery-card${isDeleteMode ? ' gallery-card--delete-mode' : ''}${
                  selectedDeleteImageIds.has(image.id) ? ' gallery-card--selected' : ''
                }`}
                role="button"
                tabIndex={0}
                aria-pressed={isDeleteMode ? selectedDeleteImageIds.has(image.id) : undefined}
                onClick={() => openGalleryImage(image)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openGalleryImage(image)
                  }
                }}
              >
                <img src={image.image_url} alt={imageName(image)} loading='lazy' decoding='async' />
                <div className="gallery-card__meta">
                  <span>{imageName(image)}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="gallery-empty">
              {images.length > 0 ? 'Không có ảnh nào khớp với bộ lọc hiện tại.' : galleryMode.emptyText}
            </p>
          )}
        </div>

        {galleryItems.length > GALLERY_PAGE_SIZE ? (
          <div className="gallery-toolbar">
            <div className="browse-pagination">
              <button type="button" disabled={currentGalleryPage === 1} onClick={() => setGalleryPage(1)}>
                1
              </button>
              <button type="button" disabled={currentGalleryPage <= 1} onClick={() => setGalleryPage(Math.max(1, currentGalleryPage - 1))}>
                trước
              </button>
              <input
                type="number"
                className="browse-pagination__input"
                min={1}
                max={galleryTotalPages}
                value={galleryPageInput}
                onChange={(event) => {
                  setGalleryPageInput(event.target.value)
                  if (/^\d+$/.test(event.target.value)) {
                    jumpToGalleryPage(event.target.value)
                  }
                }}
                onBlur={() => jumpToGalleryPage(galleryPageInput)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    jumpToGalleryPage(galleryPageInput)
                  }
                }}
                aria-label="Trang thư viện hiện tại"
              />
              <button type="button" disabled={currentGalleryPage >= galleryTotalPages} onClick={() => setGalleryPage(Math.min(galleryTotalPages, currentGalleryPage + 1))}>
                tiếp
              </button>
              <span>{galleryTotalPages}</span>
            </div>
          </div>
        ) : null}
      </section>
      {selectedImage && !isDeleteMode ? (
        <ImageFocusViewer
          image={selectedImage}
          canManageImages={canManageImages}
          onClose={() => setSelectedImage(null)}
          onImageUpdated={handleImageUpdated}
          onImageDeleted={handleImageDeleted}
          onImageMoved={handleImageMoved}
        />
      ) : null}
    </main>
  )
}

export default UnlabeledGalleryPage
