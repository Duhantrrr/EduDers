/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Plus, Trash2, Clock, BookOpen } from 'lucide-react';
import { WeeklySchedule } from '../types';

interface Props {
  schedule: WeeklySchedule[];
  setSchedule: (schedule: WeeklySchedule[]) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
}

const DAYS = [
  'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'
];

export default function ScheduleEditor({ schedule, setSchedule, onDelete, onClearAll }: Props) {
  const [newEntry, setNewEntry] = useState<Partial<WeeklySchedule>>({
    day: 0,
    startTime: '09:00',
    endTime: '10:00',
    subject: ''
  });

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const addEntry = () => {
    if (!newEntry.subject) return;
    setSchedule([{ ...newEntry as WeeklySchedule }]);
    setNewEntry({ ...newEntry, subject: '' });
  };

  const handleClearAll = async () => {
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000); // Reset after 3 seconds
      return;
    }
    if (onClearAll) {
      await onClearAll();
      setIsConfirmingClear(false);
    }
  };

  const removeEntry = (lesson: WeeklySchedule, index: number) => {
    if (onDelete && lesson.id) {
      onDelete(lesson.id);
    } else {
      // For items without IDs or when onDelete is not provided
      setSchedule(schedule.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Plus className="w-5 h-5 text-emerald-500" /> Yeni Ders Ekle
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-neutral-500 ml-1">Ders Adı</label>
            <input 
              type="text"
              placeholder="Matematik, Fizik..."
              value={newEntry.subject}
              onChange={e => setNewEntry({...newEntry, subject: e.target.value})}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-neutral-500 ml-1">Gün</label>
              <select 
                value={newEntry.day}
                onChange={e => setNewEntry({...newEntry, day: parseInt(e.target.value)})}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {DAYS.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-neutral-500 ml-1">Başlangıç</label>
              <input 
                type="time"
                value={newEntry.startTime}
                onChange={e => setNewEntry({...newEntry, startTime: e.target.value})}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-neutral-500 ml-1">Bitiş</label>
              <input 
                type="time"
                value={newEntry.endTime}
                onChange={e => setNewEntry({...newEntry, endTime: e.target.value})}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <button 
            onClick={addEntry}
            className="w-full bg-neutral-800 hover:bg-neutral-700 py-3 rounded-xl font-semibold transition-all border border-neutral-700 mt-2"
          >
            Ders Programına Ekle
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-lg">Haftalık Ders Programı</h3>
          {schedule.length > 0 && onClearAll && (
            <button 
              onClick={handleClearAll}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                isConfirmingClear 
                ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20' 
                : 'text-red-500 border-red-500/20 hover:bg-red-500/10'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" /> 
              {isConfirmingClear ? 'Emin misiniz?' : 'Tümünü Sil'}
            </button>
          )}
        </div>
        {DAYS.map((day, dayIdx) => {
          const dayLessons = schedule.filter(s => s.day === dayIdx).sort((a, b) => a.startTime.localeCompare(b.startTime));
          if (dayLessons.length === 0) return null;
          
          return (
            <div key={dayIdx} className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">{day}</h4>
              <div className="space-y-1">
                {dayLessons.map((lesson, idx) => (
                  <div key={idx} className="group bg-neutral-900 border border-neutral-800 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{lesson.subject}</p>
                        <p className="text-xs text-neutral-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {lesson.startTime} - {lesson.endTime}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeEntry(lesson, schedule.indexOf(lesson))}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
