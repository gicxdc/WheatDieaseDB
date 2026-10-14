import { useEffect, useMemo, useRef, useState } from 'react'

const PREDICT_API_URL = import.meta.env.VITE_PREDICT_API_URL || '/api/predict/'

function formatConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0%'
  }

  return `${Math.round(value * 1000) / 10}%`
}

function shortenFileName(name, maxLength = 34) {
  if (!name || name.length <= maxLength) {
    return name || 'Chưa chọn ảnh nào'
  }

  const dotIndex = name.lastIndexOf('.')
  const extension = dotIndex > 0 ? name.slice(dotIndex) : ''
  const baseName = extension ? name.slice(0, dotIndex) : name
  const availableLength = Math.max(12, maxLength - extension.length - 3)
  const startLength = Math.ceil(availableLength * 0.58)
  const endLength = Math.max(4, availableLength - startLength)

  return `${baseName.slice(0, startLength)}...${baseName.slice(-endLength)}${extension}`
}

function PredictPage() {
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [prediction, setPrediction] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isPredicting, setIsPredicting] = useState(false)

  const predictions = prediction?.predictions || []
  const topPrediction = predictions[0] || null
  const isUnsupported = prediction?.is_supported === false
  const endpoint = useMemo(() => PREDICT_API_URL, [])
  const selectedFileName = selectedFile?.name || ''

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    setPrediction(null)
    setError('')
    setStatus('')

    if (!file) {
      setSelectedFile(null)
      setPreviewUrl('')
      return
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null)
      setPreviewUrl('')
      setError('Vui lòng chọn tệp hình ảnh.')
      return
    }

    setSelectedFile(file)
    setPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
      return URL.createObjectURL(file)
    })
  }

  async function handlePredict() {
    if (!selectedFile) {
      setError('Vui lòng chọn ảnh trước.')
      return
    }

    const formData = new FormData()
    formData.append('image', selectedFile)
    formData.append('top_k', '3')

    setIsPredicting(true)
    setError('')
    setStatus('Đang phân tích ảnh...')
    setPrediction(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.detail || 'Dự đoán thất bại.')
      }

      setPrediction(data)
      setStatus(data.is_supported === false ? 'Ảnh đã bị bộ lọc an toàn từ chối.' : 'Dự đoán thành công.')
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Không thể kết nối backend. Hãy khởi động API chính và dịch vụ dự đoán, rồi thử lại.'
          : err.message,
      )
      setStatus('')
    } finally {
      setIsPredicting(false)
    }
  }

  function clearSelection() {
    setSelectedFile(null)
    setPreviewUrl('')
    setPrediction(null)
    setStatus('')
    setError('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <main className="predict-page">
      <section className="predict-shell">
        <header className="predict-header">
          <div>
            <p className="eyebrow">Dự đoán bệnh lúa</p>
            <h2>Dự đoán bệnh cây lúa từ ảnh</h2>
          </div>
          <span className="predict-endpoint"></span>
        </header>

        <div className="predict-workspace">
          

          <section className="predict-result-panel">
            {topPrediction ? (
              <>
                <p className="eyebrow">{isUnsupported ? 'Bộ lọc an toàn' : 'Kết quả'}</p>
                <h3 className={isUnsupported ? 'predict-result-title--unsupported' : undefined}>
                  {isUnsupported ? prediction.label : topPrediction.label}
                </h3>
                {isUnsupported ? (
                  <p className="predict-unsupported-message">
                    {prediction.detail || 'Vui lòng tải lên ảnh lá cây trồng được hỗ trợ và đủ rõ để dự đoán bệnh.'}
                  </p>
                ) : (
                  <div className="predict-confidence">
                    <span>{formatConfidence(topPrediction.confidence)}</span>
                    <div>
                      <i style={{ width: `${Math.round(topPrediction.confidence * 100)}%` }} />
                    </div>
                  </div>
                )}

                {!isUnsupported ? (
                  <div className="predict-ranking">
                    {predictions.map((item) => (
                      <div key={item.label} className="predict-ranking-row">
                        <span>{item.label}</span>
                        <strong>{formatConfidence(item.confidence)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="predict-empty">
                <p className="eyebrow">Đang chờ</p>
                <h3>Kết quả dự đoán sẽ hiển thị ở đây.</h3>
              </div>
            )}

            {status ? <p className="predict-status predict-status--ok">{status}</p> : null}
            {error ? <p className="predict-status predict-status--error">{error}</p> : null}
          </section>

            <section className="predict-uploader">
            <button
              type="button"
              className={`predict-dropzone${previewUrl ? ' predict-dropzone--filled' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Ảnh lá lúa đã chọn" />
              ) : (
                <span>Chọn ảnh</span>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="predict-file-input"
              onChange={handleFileChange}
            />

            <div className="predict-file-row">
              <span title={selectedFileName}>{shortenFileName(selectedFileName)}</span>
              {selectedFile ? (
                <button type="button" onClick={clearSelection}>
                  Xóa
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="primary-btn predict-submit"
              disabled={isPredicting || !selectedFile}
              onClick={handlePredict}
            >
              {isPredicting ? 'Đang dự đoán...' : 'Dự đoán bệnh'}
            </button>
          </section>


        </div>
      </section>
    </main>
  )
}

export default PredictPage
