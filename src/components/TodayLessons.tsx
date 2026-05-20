/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeeklySchedule } from '../types';
import { BookOpen, Clock } from 'lucide-react';

interface Props {
  schedule: WeeklySchedule[];
}

const DAYS = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
];

export default function TodayLessons({ schedule }: Props) {
  const todayIdx = new Date().getDay();
  // We mapped 0-6 as Pazartesi-Pazar in ScheduleEditor? 
  // Standard JS: 0=Sunday, 1=Monday...
  
  // Let's adjust to match ScheduleEditor logic (0 = Pazartesi if we used DAYS index)
  // Actually, ScheduleEditor uses index of DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
  // So Monday is 0.
  
  const jsDay = new Date().getDay(); // 1 = Monday
  const todayScheduleIdx = jsDay === 0 ? 6 : jsDay - 1; // Adjust to 0=Mon, 6=Sun
  
  const todayLessons = schedule
    .filter(s => s.day === todayScheduleIdx)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayLessons.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg tracking-tight">Bugünkü Dersler</h3>
          <span className="text-[10px] font-bold text-neutral-500 uppercase">{DAYS[jsDay]}</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 border-dashed p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
          <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-600">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-neutral-500">Bugün için kayıtlı dersiniz bulunmuyor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-bold text-lg tracking-tight">Bugünkü Dersler</h3>
        <span className="text-[10px] font-bold text-neutral-500 uppercase">{DAYS[jsDay]}</span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
        {todayLessons.map((lesson, idx) => (
          <div 
            key={idx} 
            className="flex-shrink-0 w-40 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2"
          >
            <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="font-semibold text-sm truncate">{lesson.subject}</p>
            <div className="flex items-center gap-1 text-[10px] text-neutral-400">
              <Clock className="w-3 h-3" />
              <span>{lesson.startTime}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
