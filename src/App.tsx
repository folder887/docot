import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './store'
import { SplashScreen } from './screens/SplashScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { SignupScreen } from './screens/SignupScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ChatsScreen } from './screens/ChatsScreen'
import { ChatDetailScreen } from './screens/ChatDetailScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { NotesScreen } from './screens/NotesScreen'
import { NoteDetailScreen } from './screens/NoteDetailScreen'
import { NewsScreen } from './screens/NewsScreen'
import { MenuScreen } from './screens/MenuScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { SettingsSubScreen } from './screens/SettingsSubScreens'
import { ProfileScreen } from './screens/ProfileScreen'
import { GroupInfoScreen } from './screens/GroupInfoScreen'
import { TabBar } from './components/TabBar'
import { TopBar } from './components/TopBar'

const TOP_TAB_ROUTES = ['/chats', '/calendar', '/notes', '/news', '/menu']

function ThemeSync() {
  const { state } = useApp()
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', state.prefs.theme)
    root.setAttribute('data-wallpaper', state.prefs.wallpaper)
    const motionOff = !state.prefs.animations || state.prefs.reduceMotion
    root.setAttribute('data-motion', motionOff ? 'off' : 'on')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      const color =
        state.prefs.theme === 'dark' ? '#0b0b0b' : state.prefs.theme === 'paper' ? '#f5f1e8' : state.prefs.theme === 'inverse' ? '#000000' : '#ffffff'
      meta.setAttribute('content', color)
    }
  }, [state.prefs.theme, state.prefs.wallpaper, state.prefs.animations, state.prefs.reduceMotion])
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
      {!hideChrome && isTopTab && <TopBar />}
      <main className="flex flex-1 flex-col min-h-0">
        <div key={key} className="page-enter flex flex-1 flex-col min-h-0">
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/signup" element={<SignupScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/menu" element={<MenuScreen />} />
            <Route path="/chats" element={<ChatsScreen />} />
            <Route path="/chats/:id" element={<ChatDetailScreen />} />
            <Route path="/calendar" element={<CalendarScreen />} />
            <Route path="/notes" element={<NotesScreen />} />
            <Route path="/notes/:id" element={<NoteDetailScreen />} />
            <Route path="/news" element={<NewsScreen />} />
            <Route path="/profile/:id" element={<ProfileScreen />} />
            <Route path="/group/:id" element={<GroupInfoScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/settings/:section" element={<SettingsSubScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
      {!hideChrome && <TabBar />}
    </div>
  )
}

function Guarded() {
  const { state } = useApp()
  const { pathname } = useLocation()
  const publicRoutes = ['/', '/welcome', '/signup', '/login']

  if (state.status === 'loading') {
    return <Shell />
  }
  if (state.status !== 'authed' && !publicRoutes.includes(pathname)) {
    return <Navigate to="/welcome" replace />
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
      <Guarded />
    </AppProvider>
  )
}
