import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function DiseaseCreatePage({ currentUser }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    pathogen: '',
    condition: '',
    symptoms: '',
    prevention: '',
  })
  const [status, setStatus] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isDetailWarningOpen, setIsDetailWarningOpen] = useState(false)

  const canCreateDisease =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert'

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!canCreateDisease || isCreating) {
      return
    }

    const payload = {
      name: form.name.trim(),
      pathogen: form.pathogen.trim(),
      condition: form.condition.trim(),
      symptoms: form.symptoms.trim(),
      prevention: form.prevention.trim(),
    }

    if (!payload.name) {
      setStatus('Name is required.')
      return
    }

    if (!payload.pathogen && !payload.condition && !payload.symptoms && !payload.prevention) {
      setStatus('Add at least one detail before creating the disease entry.')
      setIsDetailWarningOpen(true)
      return
    }

    setIsCreating(true)
    setStatus('Creating disease entry...')

    try {
      const response = await fetch('/api/wheat-diseases/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const nameError = Array.isArray(data?.name) ? data.name[0] : ''
        throw new Error(nameError || data?.detail || 'Could not create disease entry.')
      }

      navigate(`/database/${data.id}`)
    } catch (error) {
      setStatus(error?.message || 'Could not create disease entry right now.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <main className="disease-create-page">
        <section className="disease-create-card">
          <Link className="disease-detail-back" to="/database">
            Back to database
          </Link>

          <h2>Create New Wheat Disease</h2>

          {!canCreateDisease ? (
            <p className="database-status">
              You do not have permission to create a disease entry.
            </p>
          ) : (
            <form className="disease-create-form" onSubmit={handleSubmit}>
              <div className="disease-create-grid">
                <label>
                  Name
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="e.g. Rust Blight"
                    disabled={isCreating}
                    required
                  />
                </label>
                <label>
                  Pathogen
                  <input
                    type="text"
                    value={form.pathogen}
                    onChange={(event) => updateField('pathogen', event.target.value)}
                    placeholder="Optional"
                    disabled={isCreating}
                  />
                </label>
                <label className="disease-create-grid__full">
                  Symptoms
                  <textarea
                    rows={5}
                    value={form.symptoms}
                    onChange={(event) => updateField('symptoms', event.target.value)}
                    placeholder="Describe symptoms"
                    disabled={isCreating}
                  />
                </label>
                <label className="disease-create-grid__full">
                  Condition
                  <textarea
                    rows={4}
                    value={form.condition}
                    onChange={(event) => updateField('condition', event.target.value)}
                    placeholder="Describe favorable field or environmental conditions"
                    disabled={isCreating}
                  />
                </label>
                <label className="disease-create-grid__full">
                  Prevention
                  <textarea
                    rows={5}
                    value={form.prevention}
                    onChange={(event) => updateField('prevention', event.target.value)}
                    placeholder="Describe prevention guidance"
                    disabled={isCreating}
                  />
                </label>
              </div>
              <div className="disease-create-actions">
                <Link className="secondary-btn" to="/database">
                  Cancel
                </Link>
                <button type="submit" className="primary-btn" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create disease'}
                </button>
              </div>
              {status ? <p className="disease-create-status">{status}</p> : null}
            </form>
          )}
        </section>
      </main>
      {isDetailWarningOpen ? (
        <div className="disease-delete-modal-backdrop" role="presentation">
          <section
            className="disease-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disease-create-warning-title"
          >
            <div className="disease-delete-modal__head">
              <p className="eyebrow">Missing details</p>
              <button
                type="button"
                aria-label="Close missing details warning"
                onClick={() => setIsDetailWarningOpen(false)}
              >
                x
              </button>
            </div>
            <h3 id="disease-create-warning-title">Add more disease details</h3>
            <p>
              A disease entry should include at least one detail besides the name, such as pathogen, symptoms,
              condition, or prevention.
            </p>
            <div className="disease-delete-modal__actions">
              <button type="button" onClick={() => setIsDetailWarningOpen(false)}>
                Back to form
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default DiseaseCreatePage
