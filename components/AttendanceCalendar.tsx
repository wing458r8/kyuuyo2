"use client";

import { useState } from "react";
import { AttendanceRecord, ShiftRecord } from "@/lib/types";
import { formatCurrency, formatHours, getTodayString } from "@/lib/utils";

interface Props {
  attendance: AttendanceRecord[];
  shifts: ShiftRecord[];
  onDeleteRecord: (date: string) => void;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function AttendanceCalendar({ attendance, shifts, onDeleteRecord }: Props) {
  const today = getTodayString();
  const todayDate = new Date(today + "T00:00:00");
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = getCalendarDays(year, month);
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const recordMap = new Map(attendance.map((r) => [r.date, r]));
  const shiftMap = new Map(shifts.map((s) => [s.date, s]));

  const monthRecords = attendance.filter((r) => r.date.startsWith(monthStr));
  const monthTotal = monthRecords.reduce((s, r) => s + r.salary, 0);
  const monthHours = monthRecords.reduce((s, r) => s + r.hours, 0);
  const monthTransport = monthRecords.reduce((s, r) => s + (r.transport ?? 0), 0);

  const selectedRecord = selectedDate ? recordMap.get(selectedDate) : undefined;
  const selectedShift = selectedDate ? shiftMap.get(selectedDate) : undefined;

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-gray-800">{year}年{month + 1}月</p>
          <p className="text-xs text-gray-400">
            {monthRecords.length}日勤務 / {formatHours(monthHours)} / {formatCurrency(monthTotal)}
            {monthTransport > 0 && <span> +交通費{formatCurrency(monthTransport)}</span>}
          </p>
        </div>
        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>
            {d}
          </div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="bg-white h-14" />;
          const dateStr = toDateStr(year, month, day);
          const record = recordMap.get(dateStr);
          const shift = shiftMap.get(dateStr);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const dow = idx % 7;
          const isSun = dow === 0;
          const isSat = dow === 6;

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`relative bg-white h-14 flex flex-col items-center justify-start pt-1 transition-colors hover:bg-blue-50
                ${isSelected ? "ring-2 ring-inset ring-blue-500 bg-blue-50" : ""}
              `}
            >
              {/* 日付 */}
              <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                ${isToday ? "bg-blue-500 text-white" : isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-700"}
              `}>
                {day}
              </span>

              {/* 勤務記録 */}
              {record && (
                <span className="mt-0.5 text-xs font-bold text-emerald-600 leading-none">
                  ¥{Math.round(record.salary / 1000)}k
                </span>
              )}

              {/* シフト予定（記録なし） */}
              {!record && shift && (
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />勤務記録</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-300 inline-block" />シフト予定</span>
      </div>

      {/* 選択日の詳細 */}
      {selectedDate && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            {new Date(selectedDate + "T00:00:00").getMonth() + 1}月
            {new Date(selectedDate + "T00:00:00").getDate()}日
            ({WEEKDAYS[new Date(selectedDate + "T00:00:00").getDay()]})
          </p>

          {record ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">勤務時間</span>
                <span className="text-sm font-bold text-gray-800">
                  {record.startTime && record.endTime
                    ? `${record.startTime}〜${record.endTime}`
                    : formatHours(record.hours)}
                  {record.breakMinutes ? ` (休憩${record.breakMinutes}分)` : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">実働</span>
                <span className="text-sm font-medium text-gray-700">{formatHours(record.hours)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">給与</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(record.salary)}</span>
              </div>
              {record.transport && record.transport > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">交通費</span>
                  <span className="text-sm font-medium text-blue-600">{formatCurrency(record.transport)}</span>
                </div>
              )}
              <button
                onClick={() => { onDeleteRecord(selectedDate); setSelectedDate(null); }}
                className="w-full mt-2 text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-lg py-1.5 transition-colors"
              >
                この日の記録を削除
              </button>
            </div>
          ) : selectedShift ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">シフト予定</span>
                <span className="text-sm font-bold text-blue-600">{selectedShift.startTime}〜{selectedShift.endTime}</span>
              </div>
              {selectedShift.note && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">メモ</span>
                  <span className="text-sm text-gray-700">{selectedShift.note}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">チャットで勤務時間を入力すると記録されます</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">この日の記録はありません。チャットで勤務時間を入力してください。</p>
          )}
        </div>
      )}
    </div>
  );
}
