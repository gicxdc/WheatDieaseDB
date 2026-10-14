import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const defaultLogin = {
  email: '',
  password: '',
}

const defaultRegister = {
  username: '',
  email: '',
  password: '',
}

function EyeIcon({ isVisible }) {
  return (
    <i
      className={isVisible ? 'fas fa-eye' : 'fas fa-eye-slash'}
      aria-hidden="true"
    />
  )
}

function AuthPage({ initialMode = 'login', onLoginSuccess }) {
  //State
  const [mode, setMode] = useState(initialMode)
  const [loginForm, setLoginForm] = useState(defaultLogin)
  const [registerForm, setRegisterForm] = useState(defaultRegister)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Đăng nhập để tiếp tục vào Wheat DB.')
  const [statusType, setStatusType] = useState('info')
  const navigate = useNavigate()

  function switchMode(nextMode) {
    setMode(nextMode)
    setStatusMessage('Đăng nhập để tiếp tục vào Wheat DB.')
    setStatusType('info')
    navigate(nextMode === 'login' ? '/login' : '/register')
  }

  async function handleLogin(event) {
    event.preventDefault()
    setStatusMessage('Đang đăng nhập...')
    setStatusType('info')

    try {
      const response = await fetch('/api/auth/login/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatusMessage(data.detail || 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin đăng nhập.')
        setStatusType('error')
        return
      }

      setLoginForm(defaultLogin)
      setStatusMessage(`Chào mừng trở lại, ${data.user?.username || 'người dùng'}!`)
      setStatusType('success')
      onLoginSuccess?.(data.user || null)
      navigate('/')
    } catch {
      setStatusMessage('Hiện chưa thể kết nối dịch vụ đăng nhập.')
      setStatusType('error')
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    setStatusMessage('Đang tạo tài khoản...')
    setStatusType('info')

    try {
      const response = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registerForm, role: 'user' }),
      })

      const data = await response.json()

      if (!response.ok) {
        const message =
          data?.email?.[0] ||
          data?.username?.[0] ||
          data?.password?.[0] ||
          'Đăng ký thất bại. Vui lòng kiểm tra thông tin.'

        setStatusMessage(message)
        setStatusType('error')
        return
      }

      setRegisterForm(defaultRegister)
      setMode('login')
      navigate('/login')
      setStatusMessage(`Đã tạo tài khoản cho ${data.username}. Bạn có thể đăng nhập ngay.`)
      setStatusType('success')
    } catch {
      setStatusMessage('Hiện chưa thể kết nối dịch vụ đăng ký.')
      setStatusType('error')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <article className="auth-card">
          <p className="eyebrow">Truy cập tài khoản</p>
          <h2 className="auth-card__title">Tham gia Wheat DB</h2>
          <div className="auth-switcher" role="tablist" aria-label="Chế độ xác thực">
            <button
              type="button"
              className={mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'}
              onClick={() => switchMode('login')}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'auth-tab auth-tab--active' : 'auth-tab'}
              onClick={() => switchMode('register')}
            >
              Đăng ký
            </button>
          </div>

          {mode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                    placeholder="Nhập email của bạn"
                />
              </label>

              <label>
                Mật khẩu
                <div className="auth-password-field">
                  <input
                    className="auth-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Nhập mật khẩu của bạn"
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <EyeIcon isVisible={showLoginPassword} />
                  </button>
                </div>
              </label>

              <p className={`auth-status auth-status--${statusType}`}>{statusMessage}</p>

              <button
                className="auth-text-link"
                type="button"
                onClick={() => navigate('/forgot-password')}
              >
                Quên mật khẩu?
              </button>

              <button className="auth-submit" type="submit">
                Đăng nhập
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <label>
                Tên người dùng
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                  placeholder="Chọn tên người dùng"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Nhập email của bạn"
                />
              </label>

              <label>
                Mật khẩu
                <div className="auth-password-field">
                  <input
                    className="auth-password-input"
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Tạo mật khẩu"
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowRegisterPassword((current) => !current)}
                    aria-label={showRegisterPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <EyeIcon isVisible={showRegisterPassword} />
                  </button>
                </div>
              </label>

              <p className={`auth-status auth-status--${statusType}`}>{statusMessage}</p>

              <button className="auth-submit" type="submit">
                Tạo tài khoản
              </button>
            </form>
          )}
        </article>
      </section>
    </main>
  )
}

export default AuthPage
