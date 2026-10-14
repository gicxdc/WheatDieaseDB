import { useState } from 'react'

export const emptyGalleryFilters = {
  query: '',
  fields: ['search'],
  sort: 'newest',
}

const filterOptions = [
  { value: 'search', label: 'Tất cả thuộc tính' },
  { value: 'caption', label: 'Chú thích' },
  { value: 'location', label: 'Vị trí' },
  { value: 'background', label: 'Nền' },
  { value: 'weather', label: 'Thời tiết' },
  { value: 'timeOfDay', label: 'Thời điểm trong ngày' },
  { value: 'uploader', label: 'Người tải lên' },
]

export function normalizeFilterValue(value) {
  return String(value || '').trim().toLowerCase()
}

export function imageFilterValue(image, field) {
  if (field === 'search') {
    return [
      image.name,
      image.caption,
      image.location,
      image.background,
      image.weather,
      image.timeOfDay,
      image.created_by,
      image.disease_name,
    ].join(' ')
  }

  if (field === 'uploader') {
    return image.created_by || ''
  }

  return image[field] || ''
}

export function filterGalleryImages(images, filters) {
  const query = normalizeFilterValue(filters.query)
  const selectedFields = Array.isArray(filters.fields) && filters.fields.length > 0 ? filters.fields : ['search']

  if (!query) {
    return images
  }

  return images.filter((image) =>
    selectedFields.some((field) => normalizeFilterValue(imageFilterValue(image, field)).includes(query))
  )
}

function imageDateTime(image) {
  const timestamp = new Date(image?.uploaded_at || '').getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function sortGalleryImages(images, sort) {
  const nextImages = [...images]

  if (sort === 'oldest') {
    return nextImages.sort((a, b) => imageDateTime(a) - imageDateTime(b))
  }

  return nextImages.sort((a, b) => imageDateTime(b) - imageDateTime(a))
}

export function GalleryFilterPanel({ filters, onFilterChange, onClearFilters, resultCount, totalCount }) {
  const [isFieldPickerOpen, setIsFieldPickerOpen] = useState(false)
  const hasActiveFilters = normalizeFilterValue(filters.query)
  const selectedFields = Array.isArray(filters.fields) && filters.fields.length > 0 ? filters.fields : ['search']
  const selectedLabels = selectedFields.includes('search')
    ? 'tất cả thuộc tính'
    : filterOptions
        .filter((option) => selectedFields.includes(option.value))
        .map((option) => option.label.toLowerCase())
        .join(', ')

  function toggleField(field) {
    if (field === 'search') {
      onFilterChange('fields', ['search'])
      return
    }

    const nextFields = selectedFields.includes(field)
      ? selectedFields.filter((selectedField) => selectedField !== field)
      : [...selectedFields.filter((selectedField) => selectedField !== 'search'), field]

    onFilterChange('fields', nextFields.length > 0 ? nextFields : ['search'])
  }

  return (
    <section className="gallery-filters" aria-label="Lọc ảnh thư viện">
      <div className="gallery-filters__head">
        <strong>Bộ lọc</strong>
        <span>
          {resultCount} / {totalCount} ảnh
        </span>
      </div>
      <div className="gallery-filters__bar">
        <label className="gallery-filters__search">
          <span>Tìm kiếm</span>
          <input
            type="search"
            value={filters.query}
            placeholder={`Tìm theo ${selectedLabels}`}
            onChange={(event) => onFilterChange('query', event.target.value)}
          />
        </label>
      </div>
      <div className="gallery-filters__controls">
        <div className="gallery-filters__field">
          <span>Tìm theo</span>
          <button
            type="button"
            className="gallery-filters__field-toggle"
            aria-expanded={isFieldPickerOpen}
            onClick={() => setIsFieldPickerOpen((isOpen) => !isOpen)}
          >
            <span>{selectedLabels}</span>
            <span aria-hidden="true">{isFieldPickerOpen ? '^' : 'v'}</span>
          </button>
          {isFieldPickerOpen ? (
            <fieldset className="gallery-filters__checks">
              {filterOptions.map((option) => (
                <label key={option.value} className="gallery-filters__check">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(option.value)}
                    onChange={() => toggleField(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
        <label className="gallery-filters__sort">
          <span>Sắp xếp theo</span>
          <select value={filters.sort || 'newest'} onChange={(event) => onFilterChange('sort', event.target.value)}>
            <option value="newest">Ngày: mới nhất đến cũ nhất</option>
            <option value="oldest">Ngày: cũ nhất đến mới nhất</option>
          </select>
        </label>
      </div>
      {hasActiveFilters ? (
        <button type="button" className="gallery-filters__clear" onClick={onClearFilters}>
          Xóa bộ lọc
        </button>
      ) : null}
    </section>
  )
}
