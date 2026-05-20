/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings } from '../types';
import { Bell, ShieldCheck, Moon, Github, Coffee } from 'lucide-react';
import { motion } from 'motion/react';

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

  return (
    <div className="space-y-6 pb-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800">
          <h3 className="font-semibold">Sistem Ayarları</h3>
        </div>
        
        <div className="divide-y divide-neutral-800">
          <div className="p-4 flex items-center justify-between transition-colors hover:bg-neutral-800/20">
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
        <div className="flex items-center gap-2 text-neutral-400">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-xs">Verileriniz yerel depolamada saklanır.</span>
        </div>
        
        <div className="pt-2 border-t border-neutral-800 flex flex-col gap-2">
          <button className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800 transition-colors">
            <span className="text-sm">Gizlilik Politikası</span>
            <span className="text-xs text-neutral-500 underline">Görüntüle</span>
          </button>
          <button className="flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800 transition-colors">
            <span className="text-sm">Versiyon</span>
            <span className="text-xs text-neutral-500">v1.2.0-beta</span>
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
  );
}
