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

  // Check for HTTPS
  const isSecure = window.location.protocol === 'https:'

  // Caps Lock detection
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

  // Rate limiting countdown
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

  // Inline validation
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
    // In a real app, this would route to password reset or contact IT
    alert('Please contact your system administrator or IT support for password reset.')
  }

  const performAuthentication = async () => {
    setError(null)

    // Inline validation
    if (!validateField('username', username)) {
      usernameInputRef.current?.focus()
      return
    }
    if (!validateField('password', password)) {
      passwordInputRef.current?.focus()
      return
    }

    // Rate limiting check
    if (isRateLimited) {
      setError({
        type: 'rateLimit',
        message: `Too many attempts. Try again in ${rateLimitTime} seconds.`
      })
      return
    }

    setIsLoading(true)

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800))

      // Simulate different error scenarios for demo
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

      // Simulate network error (10% chance)
      if (Math.random() < 0.1 && attemptCount > 0) {
        throw new Error('NETWORK_ERROR')
      }

      // Simulate server error (5% chance)
      if (Math.random() < 0.05 && attemptCount > 1) {
        throw new Error('SERVER_ERROR')
      }

      // Authentication check
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
      const error = err as Error
      if (error.message === 'NETWORK_ERROR') {
        setError({
          type: 'network',
          message: 'Network error. Please check your connection and try again.'
        })
      } else if (error.message === 'SERVER_ERROR') {
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

  // Load remembered username
  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername')
    if (remembered) {
      setUsername(remembered)
      setRememberMe(true)
    }
  }, [])

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-brand">
          <div className="brand-logo">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="6" fill="url(#gradient)"/>
              <text x="32" y="44" fontSize="36" fontWeight="700" fill="var(--bg-primary)" textAnchor="middle">K</text>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="64" y2="64">
                  <stop offset="0%" stopColor="#00ff88" />
                  <stop offset="100%" stopColor="#00d4ff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="brand-title">Knose Scientific Dashboard</h1>
          <p className="brand-subtitle">Secure access to device telemetry, experiments, and analysis</p>
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
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                    <path d="M2 2l16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3C5 3 1.73 7.11 1 10c.73 2.89 4 7 9 7s8.27-4.11 9-7c-.73-2.89-4-7-9-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                  </svg>
                )}
              </button>
            </div>
            {capsLockOn && (
              <div className="caps-lock-warning" role="alert" aria-live="polite">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
              <span>Remember me</span>
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
                <span className="spinner"></span>
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          {isSecure && (
            <div className="security-indicator">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L2 4v3c0 3.31 2.69 6 6 6s6-2.69 6-6V4L8 1z" fill="currentColor"/>
              </svg>
              <span>Secure sign-in</span>
            </div>
          )}
        </form>

        <div className="login-footer">
          <div className="footer-info">
            <span>v1.0.0</span>
            <span className="footer-separator">•</span>
            <span>Build a1b2c3d</span>
            {(import.meta.env?.MODE && import.meta.env.MODE !== 'production') && (
              <>
                <span className="footer-separator">•</span>
                <span className="footer-env">{import.meta.env.MODE}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

