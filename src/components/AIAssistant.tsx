/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sparkles, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarEvent, WeeklySchedule } from '../types';

interface AIAssistantProps {
  onEventsExtracted: (events: CalendarEvent[]) => void;
  onScheduleExtracted: (schedule: WeeklySchedule[]) => void;
}

export default function AIAssistant({ onEventsExtracted, onScheduleExtracted }: AIAssistantProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Bir hata oluştu');
      }

      const result = await response.json();
      
      if (result.type === 'schedule_list' && Array.isArray(result.data)) {
        onScheduleExtracted(result.data);
        setSuccess(true);
        setInput('');
      } else if (result.type === 'exam_list' && Array.isArray(result.data)) {
        const events: CalendarEvent[] = result.data.map((item: any) => ({
          id: Math.random().toString(36).substr(2, 9),
          title: item.title,
          date: item.date,
          time: item.time,
          type: 'exam',
          confirmed: true
        }));
        onEventsExtracted(events);
        setSuccess(true);
        setInput('');
      } else {
        throw new Error('Yapay zeka anlaşılır bir veri oluşturamadı.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl mb-2">
          <Sparkles className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Yapay Zeka Asistanı</h2>
        <p className="text-sm text-neutral-400 max-w-[280px] mx-auto">
          Derslerinizi veya sınavlarınızı doğal dille yazın, asistan otomatik eklesin.
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Örn: Pazartesi 09:00'da Matematik var, 20 Mayıs'ta Türkçe sınavı var..."
              className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
              disabled={loading}
            />
            <div className="absolute bottom-3 right-3 text-[10px] text-neutral-500">
              Yapay Zeka destekli
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analiz Ediliyor...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                <span>Bilgileri Ekle</span>
              </>
            )}
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-500 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 text-emerald-500 text-sm"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p>Bilgiler başarıyla takviminize ve ders programınıza eklendi!</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">İpucu Örnekleri</p>
          <div className="space-y-2">
            {[
              "Cuma günü 14:00'te Beden Eğitimi var.",
              "25 Mayıs saat 11:00 Matematik Sınavı",
              "Hafta içi her gün 08:30'da İngilizce dersim var."
            ].map((tip, i) => (
              <div 
                key={i}
                onClick={() => !loading && setInput(tip)}
                className="text-xs bg-neutral-950/50 border border-neutral-800/50 p-2.5 rounded-xl text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 cursor-pointer transition-all"
              >
                "{tip}"
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
