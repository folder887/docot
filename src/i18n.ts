import type { Lang } from './types'

type Dict = Record<string, { en: string; ru: string }>

const DICT: Dict = {
  'welcome.title': { en: 'WaSSup bro', ru: 'Привет, бро' },
  'welcome.createAcc': { en: 'Create acc', ru: 'Создать акк' },
  'welcome.haveAcc': { en: 'I have acc', ru: 'У меня есть акк' },
  'onboarding.language': { en: 'Choose your language', ru: 'в этой зоне сделай выбор языка' },
  'onboarding.continue': { en: 'Continue', ru: 'Продолжить' },
  'onboarding.name': { en: 'Your name', ru: 'Ваше имя' },
  'onboarding.handle': { en: 'Handle (e.g. @you)', ru: 'Ник (например @you)' },
  'onboarding.start': { en: 'Start using docot', ru: 'Начать пользоваться docot' },
  'tabs.menu': { en: 'Menu', ru: 'Меню' },
  'tabs.chats': { en: 'Chats', ru: 'Чаты' },
  'tabs.calendar': { en: 'Calendar', ru: 'Календарь' },
  'tabs.notes': { en: 'Notes', ru: 'Заметки' },
  'tabs.news': { en: 'News', ru: 'Новости' },
  'top.search': { en: 'Search', ru: 'Поиск' },
  'chats.all': { en: 'All', ru: 'Все' },
  'chats.groups': { en: 'Groups', ru: 'Группы' },
  'chats.work': { en: 'Work', ru: 'Работа' },
  'chats.bots': { en: 'Bots', ru: 'Боты' },
  'chats.new': { en: 'New chat', ru: 'Новый чат' },
  'chats.empty': { en: 'No chats yet. Start one.', ru: 'Пока нет чатов. Начните первый.' },
  'chat.placeholder': { en: 'Message', ru: 'Сообщение' },
  'chat.send': { en: 'Send', ru: 'Отправить' },
  'calendar.today': { en: 'Today', ru: 'Сегодня' },
  'calendar.addEvent': { en: 'Add event', ru: 'Добавить событие' },
  'calendar.empty': { en: 'No events for this day.', ru: 'На этот день нет событий.' },
  'calendar.title': { en: 'Title', ru: 'Заголовок' },
  'calendar.date': { en: 'Date', ru: 'Дата' },
  'calendar.start': { en: 'Start', ru: 'Начало' },
  'calendar.end': { en: 'End', ru: 'Конец' },
  'calendar.save': { en: 'Save', ru: 'Сохранить' },
  'calendar.delete': { en: 'Delete', ru: 'Удалить' },
  'notes.new': { en: 'New note', ru: 'Новая заметка' },
  'notes.graph': { en: 'Graph', ru: 'Граф' },
  'notes.list': { en: 'List', ru: 'Список' },
  'notes.empty': { en: 'No notes yet.', ru: 'Пока нет заметок.' },
  'notes.title': { en: 'Title', ru: 'Заголовок' },
  'notes.body': { en: 'Write in markdown. Use [[Wiki links]] to connect notes.', ru: 'Пишите в markdown. Используйте [[вики-ссылки]] для связей.' },
  'notes.backlinks': { en: 'Backlinks', ru: 'Обратные ссылки' },
  'notes.links': { en: 'Links', ru: 'Ссылки' },
  'notes.save': { en: 'Save', ru: 'Сохранить' },
  'notes.delete': { en: 'Delete', ru: 'Удалить' },
  'news.composer': { en: "What's happening?", ru: 'Что нового?' },
  'news.post': { en: 'Post', ru: 'Опубликовать' },
  'news.like': { en: 'Like', ru: 'Нравится' },
  'news.repost': { en: 'Repost', ru: 'Репост' },
  'news.reply': { en: 'Reply', ru: 'Ответ' },
  'settings.title': { en: 'Settings', ru: 'Настройки' },
  'settings.profile': { en: 'Profile', ru: 'Профиль' },
  'settings.language': { en: 'Language', ru: 'Язык' },
  'settings.reset': { en: 'Reset demo data', ru: 'Сбросить демо-данные' },
  'settings.logout': { en: 'Log out', ru: 'Выйти' },
  'settings.name': { en: 'Name', ru: 'Имя' },
  'settings.handle': { en: 'Handle', ru: 'Ник' },
  'settings.bio': { en: 'Bio', ru: 'О себе' },
  'settings.save': { en: 'Save', ru: 'Сохранить' },
  'menu.title': { en: 'Menu', ru: 'Меню' },
  'menu.contacts': { en: 'Contacts', ru: 'Контакты' },
  'menu.saved': { en: 'Saved', ru: 'Сохранённое' },
  'menu.archive': { en: 'Archive', ru: 'Архив' },
  'menu.settings': { en: 'Settings', ru: 'Настройки' },
  'menu.about': { en: 'About docot', ru: 'О docot' },
  'common.cancel': { en: 'Cancel', ru: 'Отмена' },
  'common.back': { en: 'Back', ru: 'Назад' },
  'time.now': { en: 'now', ru: 'сейчас' },
  'time.minAgo': { en: 'm', ru: 'м' },
  'time.hourAgo': { en: 'h', ru: 'ч' },
  'time.dayAgo': { en: 'd', ru: 'д' },
  'months.1': { en: 'January', ru: 'Январь' },
  'months.2': { en: 'February', ru: 'Февраль' },
  'months.3': { en: 'March', ru: 'Март' },
  'months.4': { en: 'April', ru: 'Апрель' },
  'months.5': { en: 'May', ru: 'Май' },
  'months.6': { en: 'June', ru: 'Июнь' },
  'months.7': { en: 'July', ru: 'Июль' },
  'months.8': { en: 'August', ru: 'Август' },
  'months.9': { en: 'September', ru: 'Сентябрь' },
  'months.10': { en: 'October', ru: 'Октябрь' },
  'months.11': { en: 'November', ru: 'Ноябрь' },
  'months.12': { en: 'December', ru: 'Декабрь' },
  'dow.0': { en: 'Sun', ru: 'Вс' },
  'dow.1': { en: 'Mon', ru: 'Пн' },
  'dow.2': { en: 'Tue', ru: 'Вт' },
  'dow.3': { en: 'Wed', ru: 'Ср' },
  'dow.4': { en: 'Thu', ru: 'Чт' },
  'dow.5': { en: 'Fri', ru: 'Пт' },
  'dow.6': { en: 'Sat', ru: 'Сб' },
}

export function t(key: string, lang: Lang): string {
  const entry = DICT[key]
  if (!entry) return key
  return entry[lang] ?? entry.en
}

export function relTime(ts: number, lang: Lang): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return t('time.now', lang)
  if (m < 60) return `${m}${t('time.minAgo', lang)}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${t('time.hourAgo', lang)}`
  const d = Math.floor(h / 24)
  return `${d}${t('time.dayAgo', lang)}`
}
