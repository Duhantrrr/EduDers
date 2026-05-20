/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, cloneElement, isValidElement, ReactNode, ReactElement } from 'react';
import { CalendarEvent, WeeklySchedule, AppSettings } from './types';
import { Bell, Calendar, Scan, Settings, BookOpen, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CalendarGrid from './components/CalendarGrid';
import AIAssistant from './components/AIAssistant';
import OCRUploader from './components/OCRUploader';
import ScheduleEditor from './components/ScheduleEditor';
import EventList from './components/EventList';
import SettingsPanel from './components/SettingsPanel';
import TodayLessons from './components/TodayLessons';
import CountdownCards from './components/CountdownCards';
import { TURKISH_HOLIDAYS } from './constants';
import { format, addDays, isSameDay, parseISO, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'ocr' | 'schedule' | 'settings' | 'ai'>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [schedule, setSchedule] = useState<WeeklySchedule[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    notificationsEnabled: false,
    theme: 'dark'
  });

  // Global callback for OCR
  useEffect(() => {
    (window as any).addLessonsToSchedule = (lessons: WeeklySchedule[]) => {
      setSchedule(prev => [...prev, ...lessons]);
      setActiveTab('schedule');
    };
    return () => { (window as any).addLessonsToSchedule = undefined; };
  }, []);

  // Load from LocalStorage
  useEffect(() => {
    const savedEvents = localStorage.getItem('asistan_events');
    const savedSchedule = localStorage.getItem('asistan_schedule');
    const savedSettings = localStorage.getItem('asistan_settings');

    if (savedEvents) setEvents(JSON.parse(savedEvents));
    if (savedSchedule) setSchedule(JSON.parse(savedSchedule));
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    // Request Notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setSettings(prev => ({ ...prev, notificationsEnabled: true }));
        }
      });
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('asistan_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('asistan_schedule', JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem('asistan_settings', JSON.stringify(settings));
  }, [settings]);

  // Notification Logic
  const checkNotifications = useCallback(() => {
    if (!settings.notificationsEnabled || Notification.permission !== 'granted') return;

    const tomorrow = addDays(new Date(), 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

    // Check confirmed exam events and holidays for tomorrow
    const allNotifiableEvents = [...events, ...TURKISH_HOLIDAYS as CalendarEvent[]];

    allNotifiableEvents.forEach(event => {
      const eventDate = parseISO(event.date);
      if (isSameDay(eventDate, tomorrow) && (event.confirmed || event.type === 'holiday')) {
        const notificationKey = `notif_${event.id}_${tomorrowStr}`;
        if (!localStorage.getItem(notificationKey)) {
          new Notification(event.type === 'holiday' ? 'Tatil Hatırlatıcısı' : 'Sınav Hatırlatıcısı', {
            body: `Yarın ${event.title} ${event.type === 'holiday' ? 'sebebiyle resmi tatil!' : 'sınavınız var! Unutmayın.'}`,
          });
          localStorage.setItem(notificationKey, 'sent');
        }
      }
    });
  }, [events, settings.notificationsEnabled]);

  useEffect(() => {
    const interval = setInterval(checkNotifications, 1000 * 60 * 60); // Check every hour
    checkNotifications(); // Initial check
    return () => clearInterval(interval);
  }, [checkNotifications]);

  const addEvents = (newEvents: CalendarEvent[]) => {
    setEvents(prev => [...prev, ...newEvents]);
  };

  const removeEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-neutral-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Öğrenci Asistanı</h1>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-full transition-colors ${activeTab === 'settings' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:bg-neutral-900'}`}
          >
            <Settings className="w-6 h-6" />
          </motion.button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pb-24 pt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pb-10"
            >
              <CountdownCards />
              
              <TodayLessons schedule={schedule} />
              
              <div className="space-y-4">
                <h3 className="font-bold text-lg px-1">Önemli Tarihler & Tatiller</h3>
                <div className="grid grid-cols-1 gap-3">
                  {TURKISH_HOLIDAYS.map((holiday) => (
                    <div key={holiday.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{holiday.title}</p>
                          <p className="text-xs text-neutral-500">{format(parseISO(holiday.date!), 'd MMMM EEEE', { locale: tr })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-neutral-800/50">
                <CalendarGrid events={events} />
                <div className="mt-4">
                  <EventList events={events} onRemove={removeEvent} />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ocr' && (
            <motion.div
              key="ocr"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <OCRUploader 
                onEventsExtracted={addEvents} 
                onScheduleExtracted={(newLessons) => setSchedule(prev => [...prev, ...newLessons])}
                onComplete={() => setActiveTab('schedule')}
              />
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AIAssistant 
                onEventsExtracted={addEvents} 
                onScheduleExtracted={(newLessons) => setSchedule(prev => [...prev, ...newLessons])}
              />
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ScheduleEditor schedule={schedule} setSchedule={setSchedule} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SettingsPanel settings={settings} setSettings={setSettings} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 p-4 z-50">
        <div className="max-w-md mx-auto bg-neutral-900/90 backdrop-blur-lg border border-neutral-800 rounded-2xl shadow-2xl flex items-center justify-around p-2">
          <NavButton 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
            icon={<Calendar />} 
            label="Takvim" 
          />
          <NavButton 
            active={activeTab === 'ocr'} 
            onClick={() => setActiveTab('ocr')} 
            icon={<Scan />} 
            label="Tarama" 
          />
          <NavButton 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')} 
            icon={<Sparkles />} 
            label="Asistan" 
          />
          <NavButton 
            active={activeTab === 'schedule'} 
            onClick={() => setActiveTab('schedule')} 
            icon={<BookOpen />} 
            label="Dersler" 
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${active ? 'text-emerald-400 bg-emerald-400/10' : 'text-neutral-500 hover:text-neutral-300'}`}
    >
      {isValidElement(icon) ? cloneElement(icon as ReactElement<any>, { className: 'w-6 h-6' }) : icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
