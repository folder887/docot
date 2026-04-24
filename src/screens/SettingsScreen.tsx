import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store'
import { t } from '../i18n'
import { ScreenHeader } from '../components/ScreenHeader'

export function SettingsScreen() {
  const { state, setLang, updateMe, resetAll, logout } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState(state.me.name)
  const [handle, setHandle] = useState(state.me.handle)
  const [bio, setBio] = useState(state.me.bio)
  const [saved, setSaved] = useState(false)

  return (
    <div className="flex flex-col bg-white">
      <ScreenHeader title={t('settings.title', state.lang)} />
      <div className="flex flex-col gap-6 p-4">
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]">
            {t('settings.profile', state.lang)}
          </h2>
          <label className="text-xs font-bold">{t('settings.name', state.lang)}</label>
          <input className="bw-input" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="text-xs font-bold">{t('settings.handle', state.lang)}</label>
          <input className="bw-input" value={handle} onChange={(e) => setHandle(e.target.value)} />
          <label className="text-xs font-bold">{t('settings.bio', state.lang)}</label>
          <textarea className="bw-input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          <button
            className="bw-btn-primary"
            onClick={() => {
              updateMe({
                name: name.trim() || 'You',
                handle: handle.startsWith('@') ? handle : `@${handle.replace('@', '') || 'you'}`,
                bio,
              })
              setSaved(true)
              window.setTimeout(() => setSaved(false), 1200)
            }}
          >
            {saved ? '✓' : t('settings.save', state.lang)}
          </button>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]">
            {t('settings.language', state.lang)}
          </h2>
          <div className="flex gap-2">
            {(['en', 'ru'] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`flex-1 rounded-full border-2 border-black px-4 py-2 font-bold ${
                  state.lang === code ? 'bg-black text-white' : 'bg-white text-black'
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <button
            className="bw-btn-ghost"
            onClick={() => {
              if (window.confirm(`${t('settings.reset', state.lang)}?`)) {
                resetAll()
              }
            }}
          >
            {t('settings.reset', state.lang)}
          </button>
          <button
            className="bw-btn-ghost"
            onClick={() => {
              logout()
              navigate('/welcome', { replace: true })
            }}
          >
            {t('settings.logout', state.lang)}
          </button>
        </section>
      </div>
    </div>
  )
}
