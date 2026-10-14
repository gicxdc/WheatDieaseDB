import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const defaultForm = {
  email: '',
  otp: '',
  newPassword: '',
}

function getErrorMessage(data, fallbackMessage) {
  if (!data || typeof data !== 'object') {
    return fallbackMessage
  }

  if (typeof data.detail === 'string') {
    return data.detail
  }

  for (const value of Object.values(data)) {
    if (typeof value === 'string') {
      return value
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0]
    }
  }

  return fallbackMessage
}

function EyeIcon({ isVisible }) {
  return (
    <i
      className={isVisible ? 'fas fa-eye' : 'fas fa-eye-slash'}
      aria-hidden="true"
    />
  )
}

function ForgotPasswordPage() {
  const [form, setForm] = useState(defaultForm)
  const [step, setStep] = useState(1)
  const [statusMessage, setStatusMessage] = useState(
    'Nhập email tài khoản và chúng tôi sẽ gửi mật khẩu dùng một lần.'
  )
  const [statusType, setStatusType] = useState('info')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const navigate = useNavigate()

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleRequestOtp(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('Đang gửi mã đặt lại...')
    setStatusType('info')

    try {
      const response = await fetch('/api/auth/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusMessage(
          getErrorMessage(data, 'Hiện chưa thể gửi mã đặt lại.')
        )
        setStatusType('error')
        return
      }

      setStep(2)
      setStatusMessage(data.detail || 'Đã gửi mã đặt lại. Vui lòng kiểm tra email để lấy OTP.')
      setStatusType('success')
    } catch {
      setStatusMessage('Hiện chưa thể kết nối dịch vụ đặt lại mật khẩu.')
      setStatusType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('Đang xác minh mã...')
    setStatusType('info')

    try {
      const response = await fetch('/api/auth/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          otp: form.otp,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusMessage(
          getErrorMessage(data, 'Không thể xác minh mã đặt lại này.')
        )
        setStatusType('error')
        return
      }

      setStep(3)
      setStatusMessage(data.detail || 'Đã xác minh OTP. Bạn có thể đặt mật khẩu mới.')
      setStatusType('success')
    } catch {
      setStatusMessage('Hiện chưa thể xác minh OTP của bạn.')
      setStatusType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setStatusMessage('Đang cập nhật mật khẩu...')
    setStatusType('info')

    try {
      const response = await fetch('/api/auth/reset-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          new_password: form.newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusMessage(
          getErrorMessage(data, 'Hiện chưa thể đặt lại mật khẩu.')
        )
        setStatusType('error')
        return
      }

      setForm(defaultForm)
      setStep(1)
      setStatusMessage(data.detail || 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.')
      setStatusType('success')
      navigate('/login')
    } catch {
      setStatusMessage('Hiện chưa thể hoàn tất đặt lại mật khẩu.')
      setStatusType('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <article className="auth-card">
          <p className="eyebrow">Đặt lại mật khẩu</p>
          <h2 className="auth-card__title">Đặt lại mật khẩu của bạn</h2>
          <p className="forgot-password-intro">
            Làm theo các bước dưới đây để xác minh email và tạo mật khẩu mới.
          </p>

          <div className="forgot-password-steps" aria-label="Tiến trình đặt lại mật khẩu">
            <span className={step >= 1 ? 'forgot-password-step forgot-password-step--active' : 'forgot-password-step'}>
              1. Email
            </span>
            <span className={step >= 2 ? 'forgot-password-step forgot-password-step--active' : 'forgot-password-step'}>
              2. Xác minh OTP
            </span>
            <span className={step >= 3 ? 'forgot-password-step forgot-password-step--active' : 'forgot-password-step'}>
              3. Mật khẩu mới
            </span>
          </div>

          <form className="auth-form" onSubmit={handleRequestOtp}>
            <label>
              Email tài khoản
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="Nhập email tài khoản"
                disabled={isSubmitting || step > 1}
              />
            </label>

            <button className="auth-submit" type="submit" disabled={isSubmitting || !form.email}>
              {isSubmitting && step === 1 ? 'Đang gửi...' : 'Gửi mã đặt lại'}
            </button>
          </form>

          <form className="auth-form forgot-password-form" onSubmit={handleVerifyOtp}>
            <label>
              Mật khẩu dùng một lần
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={form.otp}
                onChange={(event) => updateField('otp', event.target.value)}
                placeholder="Nhập mã 6 chữ số"
                disabled={isSubmitting || step < 2}
              />
            </label>

            <button className="auth-submit" type="submit" disabled={isSubmitting || step < 2 || form.otp.length !== 6}>
              {isSubmitting && step === 2 ? 'Đang xác minh...' : 'Xác minh mã'}
            </button>
          </form>

          <form className="auth-form forgot-password-form" onSubmit={handleResetPassword}>
            <label>
              Mật khẩu mới
              <div className="auth-password-field">
                <input
                  className="auth-password-input"
                  type={showNewPassword ? 'text' : 'password'}
                  value={form.newPassword}
                  onChange={(event) => updateField('newPassword', event.target.value)}
                  placeholder="Tạo mật khẩu mới"
                  disabled={isSubmitting || step < 3}
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  onClick={() => setShowNewPassword((current) => !current)}
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  disabled={isSubmitting || step < 3}
                >
                  <EyeIcon isVisible={showNewPassword} />
                </button>
              </div>
            </label>

            <button
              className="auth-submit"
              type="submit"
              disabled={isSubmitting || step < 3 || form.newPassword.length < 8}
            >
              {isSubmitting && step === 3 ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
            </button>
          </form>

          <p className={`auth-status auth-status--${statusType}`}>{statusMessage}</p>

          <button className="auth-text-link" type="button" onClick={() => navigate('/login')}>
            Quay lại đăng nhập
          </button>
        </article>
      </section>
    </main>
  )
}

export default ForgotPasswordPage
