import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './store'
import { SplashScreen } from './screens/SplashScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { SignupScreen } from './screens/SignupScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ChatsLayout } from './screens/ChatsLayout'
import { ChatDetailScreen } from './screens/ChatDetailScreen'
import { InviteScreen } from './screens/InviteScreen'
import { UserHandleRedirect } from './screens/UserHandleRedirect'
import { CalendarScreen } from './screens/CalendarScreen'
import { NotesScreen } from './screens/NotesScreen'
import { NoteDetailScreen } from './screens/NoteDetailScreen'
import { NewsScreen } from './screens/NewsScreen'
import { MenuScreen } from './screens/MenuScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SettingsSubScreen } from './screens/SettingsSubScreens'
import { ProfileScreen } from './screens/ProfileScreen'
import { GroupInfoScreen } from './screens/GroupInfoScreen'
import { TabBar, DesktopSidebar } from './components/TabBar'
import { TopBar } from './components/TopBar'
import { ToastHost } from './components/Toast'
import { PasscodeLockGate } from './components/PasscodeLockGate'
import { ReleaseBanner } from './components/ReleaseBanner'

const TOP_TAB_ROUTES = ['/chats', '/calendar', '/notes', '/news', '/menu']

function ThemeSync() {
  const { state } = useApp()
  useEffect(() => {
    const root = document.documentElement
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    const effectiveTheme = state.prefs.autoNight
      ? prefersDark
        ? 'dark'
        : 'light'
      : state.prefs.theme
    root.setAttribute('data-theme', effectiveTheme)
    root.setAttribute('data-wallpaper', state.prefs.wallpaper)
    root.setAttribute('data-font', state.prefs.fontSize)
    const motionOff = !state.prefs.animations || state.prefs.reduceMotion
    root.setAttribute('data-motion', motionOff ? 'off' : 'on')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const color =
        effectiveTheme === 'dark'
          ? '#0b0b0b'
          : effectiveTheme === 'paper'
            ? '#f5f1e8'
            : effectiveTheme === 'inverse'
              ? '#000000'
              : '#ffffff'
      meta.setAttribute('content', color)
    }
  }, [
    state.prefs.theme,
    state.prefs.wallpaper,
    state.prefs.animations,
    state.prefs.reduceMotion,
    state.prefs.fontSize,
    state.prefs.autoNight,
  ])

  // Listen for OS theme changes when autoNight is on so the UI flips
  // immediately without waiting for the next prefs change.
  useEffect(() => {
    if (!state.prefs.autoNight) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      document.documentElement.setAttribute(
        'data-theme',
        mql.matches ? 'dark' : 'light',
      )
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [state.prefs.autoNight])
  return null
}

function Shell() {
  const { pathname, key } = useLocation()
  const isTopTab = TOP_TAB_ROUTES.includes(pathname)
  const hideChrome =
    pathname === '/' ||
    pathname === '/welcome' ||
    pathname === '/signup' ||
    pathname === '/login'

  return (
    <div className="app-shell flex flex-col">
      {!hideChrome && <DesktopSidebar />}
      {!hideChrome && isTopTab && <TopBar />}
      <main className="flex flex-1 flex-col min-h-0">
        <div key={key} className="page-enter flex flex-1 flex-col min-h-0">
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/menu" element={<MenuScreen />} />
            <Route path="/chats" element={<ChatsLayout />}>
              <Route path=":id" element={<ChatDetailScreen />} />
            </Route>
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/notes" element={<NotesScreen />} />
            <Route path="/notes/:id" element={<NoteDetailScreen />} />
            <Route path="/news" element={<NewsScreen />} />
            <Route path="/profile/:id" element={<ProfileScreen />} />
            <Route path="/u/:handle" element={<UserHandleRedirect />} />
            <Route path="/group/:id" element={<GroupInfoScreen />} />
            <Route path="/invite/:token" element={<InviteScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/settings/:section" element={<SettingsSubScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      {!hideChrome && <TabBar />}
      {!hideChrome && <ReleaseBanner />}
    </div>
  )
}

function Guarded() {
  const { state } = useApp()
  const { pathname } = useLocation()
  const publicRoutes = ['/', '/welcome', '/signup', '/login']
  const isInvitePath = pathname.startsWith('/invite/')

  if (state.status === 'loading') {
    return <Shell />
  }
  if (state.status !== 'authed' && !publicRoutes.includes(pathname) && !isInvitePath) {
    return <Navigate to={`/welcome?next=${encodeURIComponent(pathname)}`} replace />
  }
  if (state.status === 'authed' && publicRoutes.includes(pathname) && pathname !== '/') {
    return <Navigate to="/chats" replace />
  }
  return <Shell />
}

export default function App() {
  return (
    <AppProvider>
      <ThemeSync />
      <PasscodeLockGate>
        <Guarded />
      </PasscodeLockGate>
      <ToastHost />
    </AppProvider>
  )
}
