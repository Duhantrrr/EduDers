/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { Upload, Camera, Loader2, CheckCircle2, AlertCircle, Trash2, Calendar as CalendarIcon, Clock, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarEvent, WeeklySchedule } from '../types';

interface Props {
  onEventsExtracted: (events: CalendarEvent[]) => void;
  onScheduleExtracted: (lessons: WeeklySchedule[]) => void;
  onComplete: () => void;
}

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function OCRUploader({ onEventsExtracted, onScheduleExtracted, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [extractedType, setExtractedType] = useState<'exam_list' | 'schedule_list' | null>(null);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setStatus("Görsel okunuyor...");
    setError(null);
    setSuccess(null);
    setExtractedData([]);

    try {
      const worker = await createWorker('tur', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.floor(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

        setStatus("Yapay zeka analiz ediyor (bu işlem 10-20 saniye sürebilir)...");
      
      const response = await fetch('/api/parse-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(120000) // 120 second timeout
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        throw new Error(`Sunucu hatası: Beklenmeyen yanıt formatı. ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || `Analiz hatası (Kod: ${response.status})`);
      }
      
      setExtractedType(result.type);
      setExtractedData(result.data);
      setStatus(null);
    } catch (err: any) {
      console.error(err);
      let msg = "Bir hata oluştu.";
      const errorMsg = err instanceof Error ? err.message : String(err);
      
      if (errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE")) {
        msg = "Yapay zeka şu an çok yoğun, lütfen birazdan tekrar deneyin.";
      } else if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
        msg = "Günlük kullanım sınırına ulaşıldı (API Kotası).";
      } else {
        msg = errorMsg;
      }
      setError(msg);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = (idx: number) => {
    setExtractedData(prev => prev.filter((_, i) => i !== idx));
  };

  const confirmData = () => {
    if (extractedType === 'exam_list') {
      const finalEvents: CalendarEvent[] = extractedData.map(e => ({
        id: Math.random().toString(36).substr(2, 9),
        title: e.title || 'Adsız Sınav',
        date: e.date || new Date().toISOString().split('T')[0],
        time: e.time || '09:00',
        type: 'exam',
        confirmed: true
      }));
      onEventsExtracted(finalEvents);
      setSuccess(`${finalEvents.length} adet sınav takvime eklendi.`);
    } else if (extractedType === 'schedule_list') {
      const lessons: WeeklySchedule[] = extractedData.map(l => ({
        subject: l.subject,
        day: l.day,
        startTime: l.startTime,
        endTime: l.endTime || l.startTime
      }));
      onScheduleExtracted(lessons);
      setSuccess(`${lessons.length} adet ders programına eklendi.`);
    }
    
    // Clear data after a short delay
    setTimeout(() => {
      setExtractedData([]);
      onComplete();
    }, 1500);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-2 border border-emerald-500/10">
          <Upload className="w-10 h-10 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight">Program veya Takvim Tara</h3>
          <p className="text-neutral-500 text-sm mt-1 px-4 leading-relaxed">
            Haftalık ders programı veya sınav takvimi görselini yükleyin, gerisini biz halledelim.
          </p>
        </div>
        
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        
        <div className="flex flex-col gap-3 pt-2">
          <button 
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 px-6 py-4 rounded-2xl font-bold transition-all border border-neutral-700"
          >
            <Upload className="w-5 h-5" /> Dosya Seç
          </button>
          <button 
            disabled={true} // Camera access in iframe is restricted
            className="w-full flex items-center justify-center gap-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 opacity-50 px-6 py-4 rounded-2xl font-bold transition-all cursor-not-allowed"
          >
            <Camera className="w-5 h-5" /> Fotoğraf Çek (Webcam)
          </button>
        </div>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6"
          >
            <div className="flex items-center gap-4">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold">{status}</span>
                  <span className="text-xs font-black text-neutral-500">{progress}%</span>
                </div>
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 flex items-start gap-4"
          >
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-500">Analiz Başarısız</p>
              <p className="text-sm text-red-400/80 leading-relaxed">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 hover:underline"
              >
                Kapat
              </button>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 flex items-start gap-4"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-emerald-500">Tamamlandı!</p>
              <p className="text-sm text-emerald-400/80 leading-relaxed">{success}</p>
            </div>
          </motion.div>
        )}

        {extractedData.length > 0 && !loading && !success && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {extractedType === 'exam_list' ? 'Bulunan Sınavlar' : 'Bulunan Dersler'}
                </h3>
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                  Analiz Sonuçları • {extractedData.length} Kayıt
                </p>
              </div>
            </div>
            
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {extractedData.map((item, idx) => (
                <motion.div 
                  key={idx}
                  layout
                  className="bg-neutral-800/40 p-4 rounded-2xl flex items-center justify-between border border-neutral-800/60 group hover:border-emerald-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center shrink-0 border border-neutral-800">
                      {extractedType === 'exam_list' ? <CalendarIcon className="w-5 h-5 text-indigo-400" /> : <BookOpen className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{item.title || item.subject}</p>
                      <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                        {extractedType === 'exam_list' ? (
                          <>
                            <CalendarIcon className="w-3 h-3" /> <span>{item.date}</span>
                            <Clock className="w-3 h-3 ml-1" /> <span>{item.time}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-neutral-400">{DAYS[item.day]}</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-700" />
                            <Clock className="w-3 h-3" /> <span>{item.startTime} - {item.endTime}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeItem(idx)}
                    className="p-2.5 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-500 rounded-xl transition-all ml-2 border border-red-500/10 group-hover:border-red-500/30"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setExtractedData([])}
                className="flex-1 bg-neutral-800 hover:bg-neutral-700 py-4 rounded-2xl font-bold transition-all border border-neutral-700"
              >
                İptal
              </button>
              <button 
                onClick={confirmData}
                className="flex-[2] bg-emerald-500 hover:bg-emerald-600 py-4 rounded-2xl font-bold text-white transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                Hepsini Kaydet
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
