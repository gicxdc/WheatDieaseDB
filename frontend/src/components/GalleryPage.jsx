import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ImageFocusViewer, { filenameFromImageKey, normalizeImage } from './ImageFocusViewer'
import { GalleryFilterPanel, emptyGalleryFilters, filterGalleryImages, sortGalleryImages } from './galleryFilters'

const GALLERY_PAGE_SIZE = 9

function GalleryPage({ currentUser }) {
  const { diseaseId } = useParams()
  const [disease, setDisease] = useState(null)
  const [status, setStatus] = useState('Đang tải thư viện...')
  const [savedImages, setSavedImages] = useState([])
  const [galleryPage, setGalleryPage] = useState(1)
  const [galleryPageInput, setGalleryPageInput] = useState('1')
  const [selectedImage, setSelectedImage] = useState(null)
  const [galleryFilters, setGalleryFilters] = useState(() => ({ ...emptyGalleryFilters }))
  const canManageImages =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert' ||
    currentUser?.role === 'helper'

  const loadGalleryData = useCallback(async () => {
    const [diseaseResponse, imagesResponse] = await Promise.all([
      fetch(`/api/wheat-diseases/${diseaseId}/`, {
        credentials: 'include',
      }),
      fetch(`/api/wheat-diseases/${diseaseId}/images/`, {
        credentials: 'include',
      }),
    ])

    if (!diseaseResponse.ok) {
      throw new Error('Không thể tải chi tiết thư viện.')
    }

    if (!imagesResponse.ok) {
      throw new Error('Không thể tải ảnh thư viện.')
    }

    const diseaseData = await diseaseResponse.json()
    const imageData = await imagesResponse.json()
    const dbImages = (Array.isArray(imageData) ? imageData : []).map((image) => {
      const normalizedImage = normalizeImage({
        ...image,
        disease_id: image.disease_id || diseaseData.id,
        disease_name: image.disease_name || diseaseData.name,
      })

      return {
        ...normalizedImage,
        name: normalizedImage.caption || filenameFromImageKey(normalizedImage.image_key) || `${diseaseData.name} ảnh ${normalizedImage.id}`,
        isStored: true,
      }
    })

    setDisease(diseaseData)
    setSavedImages(dbImages)
    setStatus('')
  }, [diseaseId])

  useEffect(() => {
    let isMounted = true

    async function loadDisease() {
      try {
        await loadGalleryData()
      } catch {
        if (isMounted) {
          setStatus('Hiện chưa thể tải thư viện này.')
        }
      }
    }

    loadDisease()

    return () => {
      isMounted = false
    }
  }, [loadGalleryData])

  const galleryItems = sortGalleryImages(filterGalleryImages(savedImages, galleryFilters), galleryFilters.sort)
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
    const normalizedImage = normalizeImage({
      ...updatedImage,
      disease_id: updatedImage.disease_id || disease?.id,
      disease_name: updatedImage.disease_name || disease?.name,
    })

    setSavedImages((currentImages) =>
      currentImages.map((image) =>
        image.id === normalizedImage.id
          ? {
              ...normalizedImage,
              name: normalizedImage.caption || filenameFromImageKey(normalizedImage.image_key) || image.name,
              isStored: true,
            }
          : image
      )
    )
    setSelectedImage(normalizedImage)
  }

  function handleImageDeleted(deletedImage) {
    setSavedImages((currentImages) => currentImages.filter((image) => image.id !== deletedImage.id))
    setSelectedImage(null)
  }

  function handleImageMoved(updatedImage) {
    handleImageUpdated(updatedImage)
  }

  return (
    <main className="blank-page gallery-page">
      <section className="blank-page__card gallery-shell">
        <Link className="disease-detail-back" to={`/database/${diseaseId}`}>
          Quay lại về trang thông tin bệnh
        </Link>

        {status ? <p className="database-status">{status}</p> : null}

        {disease ? (
          <>
            <p className="eyebrow">Thư viện</p>
            <div className="gallery-head">
              <h2>Thư viện bệnh {disease.name}</h2>
            </div>

            <GalleryFilterPanel
              filters={galleryFilters}
              onFilterChange={updateGalleryFilter}
              onClearFilters={clearGalleryFilters}
              resultCount={galleryItems.length}
              totalCount={savedImages.length}
            />

            <div className="gallery-grid">
              {galleryItems.length > 0 ? (
                visibleGalleryItems.map((item) => (
                  <article
                    key={item.id || item.image_url}
                    className="gallery-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedImage(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedImage(item)
                      }
                    }}
                  >
                    <img src={item.image_url} alt={item.name} loading='lazy' decoding='async' />
                    <div className="gallery-card__meta">
                      <span>{item.name}</span>
                    </div>
                  </article>
                ))
              ) : (
                <p className="gallery-empty">
                  {savedImages.length > 0
                    ? 'Không có ảnh nào khớp với bộ lọc hiện tại.'
                    : 'Chưa có ảnh nào được thêm vào thư viện bệnh này.'}
                </p>
              )}
            </div>

            {galleryItems.length > GALLERY_PAGE_SIZE ? (
              <div className="gallery-toolbar">
                <div className="browse-pagination">
                  <button type="button" disabled={currentGalleryPage === 1} onClick={() => setGalleryPage(1)}>
                    1
                  </button>
                  <button
                    type="button"
                    disabled={currentGalleryPage <= 1}
                    onClick={() => setGalleryPage(Math.max(1, currentGalleryPage - 1))}
                  >
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
                  <button
                    type="button"
                    disabled={currentGalleryPage >= galleryTotalPages}
                    onClick={() => setGalleryPage(Math.min(galleryTotalPages, currentGalleryPage + 1))}
                  >
                    tiếp
                  </button>
                  <span>{galleryTotalPages}</span>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      {selectedImage ? (
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

export default GalleryPage
