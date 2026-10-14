import { Link } from 'react-router-dom'

function NavItem({ href, children, className, type = 'anchor' }) {
  if (type === 'route') {
    return (
      <Link className={className} to={href}>
        {children}
      </Link>
    )
  }

  return (
    <a className={className} href={href}>
      {children}
    </a>
  )
}

function Navbar({
  items,
  ctaHref,
  ctaLabel,
  ctaType = 'anchor',
  showLogout = false,
  onLogout,
}) {
  return (
    <header className="site-header">
      

      <nav className="site-nav" aria-label="Điều hướng chính">
        {items.map((item) => (
          <NavItem
            key={typeof item === 'string' ? item : item.label}
            href={typeof item === 'string' ? `#${item.toLowerCase()}` : item.href}
            type={typeof item === 'string' ? 'anchor' : item.type || 'anchor'}
          >
            {typeof item === 'string' ? item : item.label}
          </NavItem>
        ))}
      </nav>

      <div className="site-header__actions">
        <NavItem className="nav-cta" href={ctaHref} type={ctaType}>
          {ctaLabel}
        </NavItem>
        {showLogout ? (
          <button type="button" className="secondary-btn nav-logout-btn" onClick={onLogout}>
            Đăng xuất
          </button>
        ) : null}
      </div>
    </header>
  )
}

export default Navbar
