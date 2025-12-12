import { format } from 'date-fns'
import './Header.css'

interface HeaderProps {
  currentTime: Date
  onLogout: () => void
}

const Header = ({ currentTime, onLogout }: HeaderProps) => {
  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="header-logo">
          <span className="logo-text">K</span>
        </div>
        <div className="header-title">
          <h1>Knose Scientific Dashboard</h1>
          <span className="header-subtitle">Laboratory Instrumentation System</span>
        </div>
      </div>

      <div className="header-center">
        <div className="system-status">
          <span className="status-indicator active"></span>
          <span className="status-text">System Operational</span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-time">
          <span className="time-label">UTC</span>
          <span className="time-value">{format(currentTime, 'HH:mm:ss')}</span>
        </div>
        <div className="header-date">
          <span className="date-value">{format(currentTime, 'yyyy-MM-dd')}</span>
        </div>
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  )
}

export default Header

