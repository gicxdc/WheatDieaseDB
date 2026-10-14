import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import './style/App.css'
import AuthPage from './components/AuthPage'
import ChangelogPage from './components/ChangelogPage'
import DatabasePage from './components/DatabasePage'
import DiscussionDetailPage from './components/DiscussionDetailPage'
import DiscussionPage from './components/DiscussionPage'
import DiseaseCreatePage from './components/DiseaseCreatePage'
import DiseaseDetailPage from './components/DiseaseDetailPage'
import ForgotPasswordPage from './components/ForgotPasswordPage'
import GalleryPage from './components/GalleryPage'
import ImagePage from './components/ImagePage'
import LandingPage from './components/LandingPage'
import Navbar from './components/Navbar'
import PredictPage from './components/PredictPage'
import ProfilePage from './components/ProfilePage'
import UnlabeledGalleryPage from './components/UnlabeledGalleryPage'
import UsersListPage from './components/UsersListPage'

const authNavItems = [
  { label: 'Trang chủ', href: '/', type: 'route' },
  { label: 'Bệnh cây lúa', href: '/database', type: 'route' },
  { label: 'Diễn đàn', href: '/discussion', type: 'route' },
  { label: 'Nhật ký thay đổi', href: '/changelog', type: 'route' },
]

const baseHomeNavItems = [
  { label: 'Trang chủ', href: '/', type: 'route' },
  { label: 'Bệnh cây lúa', href: '/database', type: 'route' },
  { label: 'Diễn đàn', href: '/discussion', type: 'route' },
  { label: 'Nhật ký thay đổi', href: '/changelog', type: 'route' },
]

function getMainNavItems(currentUser) {
  const canViewUsers =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'adim' ||
    currentUser?.role === 'expert'
  const items = [...baseHomeNavItems]

  if (canViewUsers) {
    items.push({ label: 'Người dùng', href: '/users', type: 'route' })
  }

  items.push({ label: 'Hình ảnh', href: '/image', type: 'route' })
  items.push({ label: 'Dự đoán bệnh', href: '/predict', type: 'route' })

  return items
}

function HomeLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
     
     
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <LandingPage />
    </div>
  )
}

function AuthLayout({ currentUser, onLoginSuccess, initialMode, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={authNavItems}
        ctaHref={currentUser ? '/profile' : '/'}
        ctaLabel={currentUser ? currentUser.username : 'Về trang chủ'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <AuthPage initialMode={initialMode} onLoginSuccess={onLoginSuccess} />
    </div>
  )
}

function ForgotPasswordLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={authNavItems}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Về đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <ForgotPasswordPage />
    </div>
  )
}

function ProfileLayout({ currentUser, onLogout, onProfileUpdate }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <ProfilePage currentUser={currentUser} onProfileUpdate={onProfileUpdate} />
    </div>
  )
}

function DatabaseLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <DatabasePage currentUser={currentUser} />
    </div>
  )
}

function DiseaseDetailLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <DiseaseDetailPage currentUser={currentUser} />
    </div>
  )
}

function DiseaseCreateLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <DiseaseCreatePage currentUser={currentUser} />
    </div>
  )
}

function GalleryLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <GalleryPage currentUser={currentUser} />
    </div>
  )
}

function ImageLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <ImagePage currentUser={currentUser} />
    </div>
  )
}

function UnlabeledGalleryLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <UnlabeledGalleryPage currentUser={currentUser} />
    </div>
  )
}

function HealthyGalleryLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <UnlabeledGalleryPage currentUser={currentUser} mode="healthy" />
    </div>
  )
}

function DiscussionLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <DiscussionPage currentUser={currentUser} />
    </div>
  )
}

function DiscussionDetailLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <DiscussionDetailPage currentUser={currentUser} />
    </div>
  )
}

function UsersListLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <UsersListPage currentUser={currentUser} />
    </div>
  )
}

function ChangelogLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <ChangelogPage currentUser={currentUser} />
    </div>
  )
}

function PredictLayout({ currentUser, onLogout }) {
  return (
    <div className="landing-page">
      <Navbar
        items={getMainNavItems(currentUser)}
        ctaHref={currentUser ? '/profile' : '/login'}
        ctaLabel={currentUser ? currentUser.username : 'Đăng nhập'}
        ctaType="route"
        showLogout={Boolean(currentUser)}
        onLogout={onLogout}
      />
      <PredictPage />
    </div>
  )
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)

  function handleProfileUpdate(updatedUser) {
    setCurrentUser((current) => {
      if (!current) {
        return updatedUser
      }

      return {
        ...current,
        ...updatedUser,
      }
    })
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout/', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    } finally {
      setCurrentUser(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      try {
        const response = await fetch('/api/auth/me/', {
          credentials: 'include',
        })

        console.log('Profile API /api/auth/me/ response status:', response.status)

        if (!response.ok) {
          if (isMounted) {
            setCurrentUser(null)
          }
          return
        }

        const data = await response.json()
        console.log('Profile API /api/auth/me/ payload:', data)
        if (isMounted) {
          setCurrentUser(data)
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null)
        }
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<HomeLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route
        path="/login"
        element={
          <AuthLayout
            currentUser={currentUser}
            initialMode="login"
            onLoginSuccess={setCurrentUser}
            onLogout={handleLogout}
          />
        }
      />
      <Route
        path="/register"
        element={
          <AuthLayout
            currentUser={currentUser}
            initialMode="register"
            onLoginSuccess={setCurrentUser}
            onLogout={handleLogout}
          />
        }
      />
      <Route
        path="/forgot-password"
        element={<ForgotPasswordLayout currentUser={currentUser} onLogout={handleLogout} />}
      />
      <Route path="/profile" element={<ProfileLayout currentUser={currentUser} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />} />
      <Route path="/users" element={<UsersListLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/image" element={<ImageLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/predict" element={<PredictLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/image/unlabeled-gallery" element={<UnlabeledGalleryLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/image/healthy-gallery" element={<HealthyGalleryLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/changelog" element={<ChangelogLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/discussion" element={<DiscussionLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/discussion/:threadId" element={<DiscussionDetailLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/database" element={<DatabaseLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/database/new" element={<DiseaseCreateLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/database/:diseaseId" element={<DiseaseDetailLayout currentUser={currentUser} onLogout={handleLogout} />} />
      <Route path="/database/:diseaseId/gallery" element={<GalleryLayout currentUser={currentUser} onLogout={handleLogout} />} />
    </Routes>
  )
}

export default App
