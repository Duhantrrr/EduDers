/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, cloneElement, isValidElement, ReactNode, ReactElement } from 'react';
import { CalendarEvent, WeeklySchedule, AppSettings } from './types';
import { Bell, Calendar, Scan, Settings, BookOpen, Sparkles, LogOut, LogIn, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CalendarGrid from './components/CalendarGrid';
import AIAssistant from './components/AIAssistant';
import OCRUploader from './components/OCRUploader';
import ScheduleEditor from './components/ScheduleEditor';
import EventList from './components/EventList';
import SettingsPanel from './components/SettingsPanel';
import TodayLessons from './components/TodayLessons';
import CountdownCards from './components/CountdownCards';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TURKISH_HOLIDAYS } from './constants';
import { format, addDays, isSameDay, parseISO, isPast } from 'date-fns';
import { tr } from 'date-fns/locale';
import { auth, db, signIn, signInRedirect, checkRedirectResult, signOut, collection, query, where, onSnapshot, setDoc, doc, deleteDoc, serverTimestamp, EVENTS_COLLECTION, SCHEDULE_COLLECTION, writeBatch } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'ocr' | 'schedule' | 'settings' | 'ai'>('calendar');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [schedule, setSchedule] = useState<WeeklySchedule[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    notificationsEnabled: false,
    notificationHour: 19, // Default to 7 PM
    theme: 'dark'
  });

  const handleLogin = async (useRedirect = false) => {
    try {
      setLoginError(null);
      if (useRedirect) {
        signInRedirect();
      } else {
        await signIn();
      }
    } catch (error: any) {
      console.error('Login Interaction Error:', error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError('Tarayıcınız pencereyi engelledi. Pop-up engelleyiciyi kapatın veya "Yeni Sekmede Aç" butonunu kullanın.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('Giriş ekranı kapatıldı.');
      } else {
        setLoginError('Google ile giriş yapılırken bir sorun oluştu. Lütfen "Redirect" yöntemini deneyin.');
      }
    }
  };

  // Auth State
  useEffect(() => {
    // Check for redirect result on mount
    checkRedirectResult().catch(err => {
      console.error('Redirect Result Error:', err);
      // Only set error if it's not a common expected error
      if (err.code !== 'auth/popup-closed-by-user') {
        setLoginError('Yönlendirme sonrası giriş yapılırken bir hata oluştu.');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) {
      setEvents([]);
      setSchedule([]);
      return;
    }

    const eventsQuery = query(collection(db, EVENTS_COLLECTION), where('userId', '==', user.uid));
    const scheduleQuery = query(collection(db, SCHEDULE_COLLECTION), where('userId', '==', user.uid));

    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as CalendarEvent);
      setEvents(data);
      setDbError(null);
    }, (error) => {
      console.error('Firestore Events Error:', error);
      if (error.code === 'not-found') {
        setDbError('Veritabanı henüz oluşturuluyor olabilir. Lütfen sayfayı yenileyin veya az sonra tekrar deneyin.');
      } else {
        setDbError('Veritabanı bağlantısında bir sorun oluştu.');
      }
    });

    const unsubSchedule = onSnapshot(scheduleQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as WeeklySchedule);
      setSchedule(data);
    }, (error) => {
      console.error('Firestore Schedule Error:', error);
    });

    return () => {
      unsubEvents();
      unsubSchedule();
    };
  }, [user]);

  // Global callback for OCR (keeping it for compatibility, but it should use Firebase)
  useEffect(() => {
    (window as any).addLessonsToSchedule = (lessons: WeeklySchedule[]) => {
      if (!user) return;
      lessons.forEach(lesson => {
        const id = Math.random().toString(36).substr(2, 9);
        setDoc(doc(db, SCHEDULE_COLLECTION, id), {
          ...lesson,
          id,
          userId: user.uid,
          updatedAt: serverTimestamp()
        });
      });
      setActiveTab('schedule');
    };
    return () => { (window as any).addLessonsToSchedule = undefined; };
  }, [user]);

  // Load settings from LocalStorage (settings remain local for now)
  useEffect(() => {
    const savedSettings = localStorage.getItem('asistan_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setSettings(prev => ({ ...prev, notificationsEnabled: true }));
          }
        });
      }
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('asistan_settings', JSON.stringify(settings));
  }, [settings]);

  // Notification Logic
  const checkNotifications = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!settings.notificationsEnabled || Notification.permission !== 'granted') return;

    const now = new Date();
    const currentHour = now.getHours();

    // Only process if current hour is greater than or equal to configured notification hour
    if (currentHour < settings.notificationHour) return;

    const tomorrow = addDays(now, 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    const todayStr = format(now, 'yyyy-MM-dd');

    const allNotifiableEvents = [...events, ...TURKISH_HOLIDAYS as CalendarEvent[]];

    allNotifiableEvents.forEach(event => {
      const eventDate = parseISO(event.date);
      if (isSameDay(eventDate, tomorrow) && (event.confirmed || event.type === 'holiday')) {
        // notificationKey includes todayStr so we only notify once per day relative to tomorrow's event
        const notificationKey = `notif_${event.id}_for_${tomorrowStr}_sent_on_${todayStr}`;
        
        if (!localStorage.getItem(notificationKey)) {
          new Notification(event.type === 'holiday' ? 'Tatil Hatırlatıcısı' : 'Sınav Hatırlatıcısı', {
            body: `Yarın ${event.title} ${event.type === 'holiday' ? 'sebebiyle resmi tatil!' : 'sınavınız var! Unutmayın.'}`,
            icon: '/icon-512.png',
            badge: '/icon-512.png'
          });
          localStorage.setItem(notificationKey, 'sent');
        }
      }
    });
  }, [events, settings.notificationsEnabled, settings.notificationHour]);

  useEffect(() => {
    const interval = setInterval(checkNotifications, 1000 * 60 * 15); // Check every 15 minutes
    checkNotifications();
    return () => clearInterval(interval);
  }, [checkNotifications]);

  const addEvents = async (newEvents: CalendarEvent[]) => {
    if (!user) return;
    for (const event of newEvents) {
      await setDoc(doc(db, EVENTS_COLLECTION, event.id), {
        ...event,
        userId: user.uid,
        updatedAt: serverTimestamp()
      });
    }
  };

  const removeEvent = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, EVENTS_COLLECTION, id));
  };

  const handleUpdateSchedule = async (newSchedule: WeeklySchedule[]) => {
    if (!user) return;
    // For simplicity, we just add missing ones or update. 
    // In a real app we might diff or clear and re-add.
    for (const item of newSchedule) {
      const id = item.id || Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, SCHEDULE_COLLECTION, id), {
        ...item,
        id,
        userId: user.uid,
        updatedAt: serverTimestamp()
      });
    }
  };

  const deleteScheduleItem = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, SCHEDULE_COLLECTION, id));
  };

  const clearAllSchedule = async () => {
    if (!user || schedule.length === 0) return;
    
    const batch = writeBatch(db);
    
    try {
      schedule.forEach((item) => {
        if (item.id) {
          const docRef = doc(db, SCHEDULE_COLLECTION, item.id);
          batch.delete(docRef);
        }
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Clear schedule error:", error);
      setDbError("Ders programı temizlenirken bir hata oluştu.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-emerald-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
          <Calendar className="w-10 h-10 text-white" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Öğrenci Asistanı</h1>
          <p className="text-neutral-400 max-w-xs mx-auto">
            Ders programınız ve sınavlarınız her an yanınızda. Giriş yaparak verilerinizi bulutla senkronize edin.
          </p>
        </div>
        <div className="space-y-4 w-full max-w-xs mx-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleLogin(false)}
            className="w-full bg-white text-neutral-950 font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all hover:bg-neutral-100 shadow-xl"
          >
            <LogIn className="w-5 h-5" />
            Google ile Giriş Yap
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleLogin(true)}
            className="w-full bg-neutral-900 text-neutral-400 font-medium py-3 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all hover:text-neutral-200 hover:bg-neutral-800 border border-neutral-800/50"
          >
            Yönlendirme ile Giriş (Alternatif)
          </motion.button>

          {loginError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl space-y-2"
            >
              <p className="text-red-500 text-xs font-semibold">
                {loginError}
              </p>
              <p className="text-[10px] text-red-400/80 leading-relaxed">
                Chrome/Safari kullanıyorsanız pop-up pencereler engellenmiş olabilir. 
                Lütfen uygulamayı aşağıdaki butondan <b>yeni sekmede</b> açın.
              </p>
            </motion.div>
          )}

          <div className="pt-4">
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-emerald-500 font-medium hover:text-emerald-400 transition-colors py-2 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
            >
              Uygulamayı Yeni Sekmede Aç
            </a>
          </div>

          <p className="text-[10px] text-neutral-600 mt-6">
            Giriş yaptıktan sonra ders programınız otomatik olarak cihazlarınız arasında senkronize edilir.
          </p>
        </div>
      </div>
    );
  }

  // Header
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-neutral-800">
      <AnimatePresence>
        {dbError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 z-[100] bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium"
          >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1">{dbError}</p>
            <button onClick={() => setDbError(null)} className="p-1 hover:bg-black/10 rounded-lg">Kapat</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Öğrenci Asistanı</h1>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={signOut}
              className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-900 rounded-full transition-all"
              title="Çıkış Yap"
            >
              <LogOut className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-full transition-colors ${activeTab === 'settings' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:bg-neutral-900'}`}
            >
              <Settings className="w-6 h-6" />
            </motion.button>
          </div>
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
                onScheduleExtracted={handleUpdateSchedule}
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
                onScheduleExtracted={handleUpdateSchedule}
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
              <ScheduleEditor 
                schedule={schedule} 
                setSchedule={handleUpdateSchedule} 
                onDelete={deleteScheduleItem}
                onClearAll={clearAllSchedule}
              />
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
