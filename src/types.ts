/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EventType = 'exam' | 'lesson' | 'holiday';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO string
  time: string; // HH:mm
  type: EventType;
  description?: string;
  confirmed?: boolean;
}

export interface WeeklySchedule {
  day: number; // 0-6 (0 is Sunday, following JS Date.getDay())
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  subject: string;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  theme: 'dark'; // Only dark mode as requested
}

export interface OCRResult {
  rawText: string;
  suggestedEvents: Partial<CalendarEvent>[];
}
