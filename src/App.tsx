import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './store'
import { SplashScreen } from './screens/SplashScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { ChatsScreen } from './screens/ChatsScreen'
import { ChatDetailScreen } from './screens/ChatDetailScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { NotesScreen } from './screens/NotesScreen'
import { NoteDetailScreen } from './screens/NoteDetailScreen'
import { NewsScreen } from './screens/NewsScreen'
import { MenuScreen } from './screens/MenuScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TabBar } from './components/TabBar'
import { TopBar } from './components/TopBar'

const TOP_TAB_ROUTES = ['/chats', '/calendar', '/notes', '/news', '/menu']

function Shell() {
  const { pathname } = useLocation()
  const isTopTab = TOP_TAB_ROUTES.includes(pathname)
  const hideChrome = pathname === '/' || pathname === '/welcome' || pathname === '/onboarding'

  return (
    <div className="app-shell flex flex-col">
      {!hideChrome && isTopTab && <TopBar />}
      <main className="flex flex-1 flex-col min-h-0">
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/welcome" element={<WelcomeScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/menu" element={<MenuScreen />} />
          <Route path="/chats" element={<ChatsScreen />} />
          <Route path="/chats/:id" element={<ChatDetailScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/notes" element={<NotesScreen />} />
          <Route path="/notes/:id" element={<NoteDetailScreen />} />
          <Route path="/news" element={<NewsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideChrome && <TabBar />}
    </div>
  )
}

function Guarded() {
  const { state } = useApp()
  const { pathname } = useLocation()
  const needsOnboarding = !state.onboarded
  const publicRoutes = ['/', '/welcome', '/onboarding']

  if (needsOnboarding && !publicRoutes.includes(pathname)) {
    return <Navigate to="/welcome" replace />
  }
  return <Shell />
}

export default function App() {
  return (
    <AppProvider>
      <Guarded />
    </AppProvider>
  )
}
