import { useState, FormEvent, useEffect, useRef, KeyboardEvent } from 'react'
import './Login.css'

interface LoginProps {
  onLogin: () => void
}

type ErrorType = 'empty' | 'invalid' | 'network' | 'server' | 'rateLimit' | 'locked' | null

const Login = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [error, setError] = useState<{ type: ErrorType; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitTime, setRateLimitTime] = useState(0)

  const passwordInputRef = useRef<HTMLInputElement>(null)
  const usernameInputRef = useRef<HTMLInputElement>(null)
  const errorRegionRef = useRef<HTMLDivElement>(null)

  const isSecure = window.location.protocol === 'https:'

  useEffect(() => {
    const handleNativeKeyPress = (e: globalThis.KeyboardEvent) => {
      if (e.getModifierState && e.getModifierState('CapsLock')) {
        setCapsLockOn(true)
      } else {
        setCapsLockOn(false)
      }
    }

    const passwordInput = passwordInputRef.current
    if (passwordInput) {
      passwordInput.addEventListener('keydown', handleNativeKeyPress)
      passwordInput.addEventListener('keyup', handleNativeKeyPress)
      return () => {
        passwordInput.removeEventListener('keydown', handleNativeKeyPress)
        passwordInput.removeEventListener('keyup', handleNativeKeyPress)
      }
    }
  }, [])

  useEffect(() => {
    if (rateLimitTime > 0) {
      const timer = setInterval(() => {
        setRateLimitTime(prev => {
          if (prev <= 1) {
            setIsRateLimited(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [rateLimitTime])

  const validateField = (field: 'username' | 'password', value: string) => {
    if (!value.trim()) {
      setError({ type: 'empty', message: `${field === 'username' ? 'Username' : 'Password'} is required` })
      return false
    }
    return true
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUsername(value)
    if (error && error.type === 'empty' && value.trim()) {
      setError(null)
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    if (error && error.type === 'empty' && value.trim()) {
      setError(null)
    }
  }

  const handleForgotPassword = () => {
    alert('Please contact your system administrator or IT support for password reset.')
  }

  const performAuthentication = async () => {
    setError(null)

    if (!validateField('username', username)) {
      usernameInputRef.current?.focus()
      return
    }
    if (!validateField('password', password)) {
      passwordInputRef.current?.focus()
      return
    }

    if (isRateLimited) {
      setError({
        type: 'rateLimit',
        message: `Too many attempts. Try again in ${rateLimitTime} seconds.`
      })
      return
    }

    setIsLoading(true)

    try {
      await new Promise(resolve => setTimeout(resolve, 800))

      if (attemptCount >= 3) {
        setIsRateLimited(true)
        setRateLimitTime(30)
        setAttemptCount(0)
        setError({
          type: 'rateLimit',
          message: 'Too many failed attempts. Please try again in 30 seconds.'
        })
        setIsLoading(false)
        return
      }

      if (Math.random() < 0.1 && attemptCount > 0) {
        throw new Error('NETWORK_ERROR')
      }

      if (Math.random() < 0.05 && attemptCount > 1) {
        throw new Error('SERVER_ERROR')
      }

      if (username === 'admin' && password === 'admin') {
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username)
        }
        onLogin()
      } else {
        setAttemptCount(prev => prev + 1)
        setError({
          type: 'invalid',
          message: 'Invalid username or password. Please try again.'
        })
        setIsLoading(false)
        passwordInputRef.current?.focus()
      }
    } catch (err) {
      setIsLoading(false)
      const caught = err as Error
      if (caught.message === 'NETWORK_ERROR') {
        setError({
          type: 'network',
          message: 'Network error. Please check your connection and try again.'
        })
      } else if (caught.message === 'SERVER_ERROR') {
        setError({
          type: 'server',
          message: 'Server error. Please try again later or contact support.'
        })
      } else {
        setError({
          type: 'network',
          message: 'An unexpected error occurred. Please try again.'
        })
      }
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await performAuthentication()
  }

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault()
    performAuthentication()
  }

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername')
    if (remembered) {
      setUsername(remembered)
      setRememberMe(true)
    }
  }, [])

  return (
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-info-panel" aria-label="System information">
          <div className="login-info-header">
            <div className="login-logo" aria-hidden="true">
              <span className="login-logo-letter">K</span>
            </div>
            <div>
              <span className="login-info-eyebrow">Knose Scientific Instrumentation Network</span>
              <h1 className="login-info-title">Laboratory Data Portal</h1>
            </div>
          </div>

          <p className="login-info-description">
            Authorized access to real-time sensor telemetry, experiment records, and analytical tools
            for registered BME690 instrument arrays.
          </p>

          <dl className="login-info-meta">
            <div className="login-meta-row">
              <dt>System ID</dt>
              <dd>KNOSE-LIS-001</dd>
            </div>
            <div className="login-meta-row">
              <dt>Classification</dt>
              <dd>Internal Use Only</dd>
            </div>
            <div className="login-meta-row">
              <dt>Data Source</dt>
              <dd>Firebase Realtime Database</dd>
            </div>
          </dl>

          <ul className="login-info-features">
            <li>
              <span className="feature-icon" aria-hidden="true">01</span>
              Multi-device sensor monitoring
            </li>
            <li>
              <span className="feature-icon" aria-hidden="true">02</span>
              Time-series analytics &amp; export
            </li>
            <li>
              <span className="feature-icon" aria-hidden="true">03</span>
              Live instrument status tracking
            </li>
          </ul>

          <div className="login-info-footer">
            <span>v1.0.0</span>
            <span className="login-info-sep" aria-hidden="true">|</span>
            <span>Build a1b2c3d</span>
            {import.meta.env?.MODE && import.meta.env.MODE !== 'production' && (
              <>
                <span className="login-info-sep" aria-hidden="true">|</span>
                <span className="login-info-env">{import.meta.env.MODE}</span>
              </>
            )}
          </div>
        </aside>

        <main className="login-form-panel">
          <div className="login-form-header">
            <h2 className="login-form-title">Sign In</h2>
            <p className="login-form-subtitle">
              Enter your credentials to access the instrumentation dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-field">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                ref={usernameInputRef}
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                onBlur={() => username && validateField('username', username)}
                autoComplete="username"
                placeholder="Enter username"
                disabled={isLoading || isRateLimited}
                aria-required="true"
                aria-invalid={error?.type === 'empty' && !username}
                aria-describedby={error ? 'error-message' : undefined}
                className={error?.type === 'empty' && !username ? 'error' : ''}
              />
            </div>

            <div className="form-field">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="password-wrapper">
                <input
                  ref={passwordInputRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => password && validateField('password', password)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.getModifierState && e.getModifierState('CapsLock')) {
                      setCapsLockOn(true)
                    }
                  }}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  disabled={isLoading || isRateLimited}
                  aria-required="true"
                  aria-invalid={error?.type === 'empty' && !password}
                  aria-describedby={error ? 'error-message' : undefined}
                  className={error?.type === 'empty' && !password ? 'error' : ''}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                      <path d="M2 2l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                    </svg>
                  )}
                </button>
              </div>
              {capsLockOn && (
                <div className="caps-lock-warning" role="alert" aria-live="polite">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 1L1 4v3c0 3.87 3.13 7 7 7s7-3.13 7-7V4L8 1z" fill="currentColor"/>
                  </svg>
                  Caps Lock is on
                </div>
              )}
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading || isRateLimited}
                />
                <span>Remember username</span>
              </label>
              <button
                type="button"
                className="forgot-password-link"
                onClick={handleForgotPassword}
                disabled={isLoading || isRateLimited}
              >
                Forgot password?
              </button>
            </div>

            <div className="error-region" ref={errorRegionRef} role="alert" aria-live="assertive">
              {error && (
                <div className={`form-error error-${error.type}`} id="error-message">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 4v4M8 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>{error.message}</span>
                  {error.type === 'network' && (
                    <button
                      type="button"
                      className="retry-button"
                      onClick={handleRetry}
                      disabled={isLoading}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={isLoading || isRateLimited || !username || !password}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Authenticating…
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>

            {isSecure && (
              <div className="security-indicator">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 1L2 4v3c0 3.31 2.69 6 6 6s6-2.69 6-6V4L8 1z" fill="currentColor"/>
                </svg>
                <span>Connection secured via HTTPS</span>
              </div>
            )}
          </form>

          <p className="login-form-notice">
            Unauthorized access is prohibited. All sessions are monitored for compliance with laboratory data policies.
          </p>
        </main>
      </div>
    </div>
  )
}

export default Login
