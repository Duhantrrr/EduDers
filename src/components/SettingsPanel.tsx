/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppSettings } from '../types';
import { Bell, ShieldCheck, Moon, Github, Coffee, Smartphone, ExternalLink, Play, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

export default function SettingsPanel({ settings, setSettings }: Props) {
  const toggleNotifications = async () => {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettings({ ...settings, notificationsEnabled: true });
      } else {
        alert('Lütfen ayarlardan bildirim izni verin.');
      }
    } else {
      setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled });
    }
  };

  const [showToast, setShowToast] = useState(false);

  const testNotification = async () => {
    if (!('Notification' in window)) {
      alert('Bu tarayıcı bildirimleri desteklemiyor.');
      return;
    }

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettings({ ...settings, notificationsEnabled: true });
        sendRealNotification('Bildirimler onaylandı! Test başarılı.');
      }
    } else if (Notification.permission === 'granted') {
      sendRealNotification('Bildirim sistemi aktif! Sınavlarınıza hazırız.');
    } else {
      alert('Bildirim izni reddedilmiş. Lütfen adres çubuğundaki kilit simgesinden izin verin.');
    }
  };

  const sendRealNotification = async (message: string) => {
    const title = 'Öğrenci Asistanı';
    const options = {
      body: message,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      vibrate: [100, 50, 100]
    };

    // Try service worker first (more reliable on mobile)
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && 'showNotification' in registration) {
        registration.showNotification(title, options);
        return;
      }
    }

    // Fallback to standard Notification constructor
    try {
      new Notification(title, options);
    } catch (e) {
      console.error('Notification constructor failed:', e);
      // Final fallback if both failed (common in some mobile browsers)
      alert('Bildirim gönderilemedi. Lütfen uygulamayı "Yeni Sekmede Aç" butonu ile açıp deneyin veya tarayıcı ayarlarınızı kontrol edin.');
    }
  };

  return (
    <>
      <div className="space-y-6 pb-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-neutral-800">
            <h3 className="font-semibold">Sistem Ayarları</h3>
          </div>
          
          <div className="divide-y divide-neutral-800">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Akıllı Bildirimler</p>
                    <p className="text-[10px] text-neutral-500">Sınavdan 1 gün önce hatırlatır.</p>
                  </div>
                </div>
                <button 
                  onClick={toggleNotifications}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.notificationsEnabled ? 'bg-emerald-500' : 'bg-neutral-700'}`}
                >
                  <motion.div 
                    animate={{ x: settings.notificationsEnabled ? 26 : 2 }}
                    className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              {settings.notificationsEnabled && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pt-2 pl-13 space-y-2"
                >
                  <label className="text-xs text-neutral-400 block">Günlük Hatırlatma Saati</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="23" 
                      value={settings.notificationHour}
                      onChange={(e) => setSettings({ ...settings, notificationHour: parseInt(e.target.value) })}
                      className="flex-1 accent-emerald-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm font-mono bg-neutral-800 px-3 py-1 rounded-lg border border-neutral-700">
                      {settings.notificationHour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="p-4 flex items-center justify-between transition-colors hover:bg-neutral-800/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Test Bildirimi</p>
                  <p className="text-[10px] text-neutral-500">Sistemi kontrol edin.</p>
                </div>
              </div>
              <button 
                onClick={testNotification}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg transition-all"
              >
                Gönder
              </button>
            </div>

            <div className="p-4 flex items-center justify-between opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Koyu Tema</p>
                  <p className="text-[10px] text-neutral-500">Her zaman aktif.</p>
                </div>
              </div>
              <div className="w-12 h-6 rounded-full bg-emerald-500/20 relative cursor-not-allowed">
                <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs">Verileriniz Firebase bulut depolama ile güvende.</span>
          </div>
          
          <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/50 border border-neutral-800/50">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                <span className="text-sm">APK / Web2App Durumu</span>
              </div>
              <span className="text-[10px] px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase">Hazır</span>
            </div>
            <button className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800 transition-colors">
              <div className="flex items-center gap-3">
                <ExternalLink className="w-4 h-4 text-neutral-500" />
                <span className="text-sm">Gizlilik Politikası</span>
              </div>
              <span className="text-xs text-neutral-500 underline">Görüntüle</span>
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/20 to-neutral-900 border border-emerald-500/20 rounded-2xl p-6 text-center">
          <Coffee className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <h4 className="font-bold text-neutral-100">Yapımcı</h4>
          <p className="text-xs text-neutral-400 mt-1 mb-4">Bu uygulama öğrenci hayatını kolaylaştırmak için geliştirilmiştir.</p>
          <div className="flex justify-center gap-3">
            <button className="p-2 bg-neutral-950 rounded-lg hover:bg-neutral-800 transition-colors border border-neutral-800">
              <Github className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold text-sm">Test Bildirimi Gönderildi!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
