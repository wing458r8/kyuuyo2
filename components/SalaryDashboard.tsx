"use client";

import { useState } from "react";
import { AttendanceRecord, ShiftRecord } from "@/lib/types";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import {
  formatCurrency,
  formatHours,
  formatDate,
  getMonthLabel,
  groupByMonth,
  getTodaySalary,
  getTodayString,
  getThisMonthSalary,
  getThisYearSalary,
  getThisWeekRecords,
} from "@/lib/utils";

interface Props {
  attendance: AttendanceRecord[];
  hourlyRate: number;
  onHourlyRateChange: (rate: number) => void;
  onDeleteRecord: (date: string) => void;
  monthlyGoal: number;
  onMonthlyGoalChange: (goal: number) => void;
  shifts: ShiftRecord[];
  onAddShift: (shift: ShiftRecord) => void;
  onDeleteShift: (date: string) => void;
}

function exportCSV(records: AttendanceRecord[], month: string) {
  const header = "日付,開始,終了,休憩(分),勤務時間,交通費,給与,合計\n";
  const rows = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) =>
      [
        r.date,
        r.startTime ?? "",
        r.endTime ?? "",
        r.breakMinutes ?? 0,
        formatHours(r.hours),
        r.transport ?? 0,
        r.salary,
        r.salary + (r.transport ?? 0),
      ].join(",")
    )
    .join("\n");
  const totalSalary = records.reduce((s, r) => s + r.salary, 0);
  const totalTransport = records.reduce((s, r) => s + (r.transport ?? 0), 0);
  const footer = `\n合計,,,,,,${totalSalary},${totalSalary + totalTransport}`;
  const csv = "\uFEFF" + header + rows + footer;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `給与_${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SalaryDashboard({
  attendance,
  hourlyRate,
  onHourlyRateChange,
  onDeleteRecord,
  monthlyGoal,
  onMonthlyGoalChange,
  shifts,
  onAddShift,
  onDeleteShift,
}: Props) {
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(hourlyRate));
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(monthlyGoal));
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({ date: "", startTime: "", endTime: "", note: "" });

  const today = getTodayString();
  const todaySalary = getTodaySalary(attendance);
  const monthSalary = getThisMonthSalary(attendance);
  const yearSalary = getThisYearSalary(attendance);
  const weekRecords = getThisWeekRecords(attendance);
  const weekSalary = weekRecords.reduce((s, r) => s + r.salary, 0);
  const weekHours = weekRecords.reduce((s, r) => s + r.hours, 0);
  const grouped = groupByMonth(attendance);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const goalProgress = monthlyGoal > 0 ? Math.min(100, Math.round((monthSalary / monthlyGoal) * 100)) : 0;
  const upcomingShifts = [...(shifts ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  const handleRateSave = () => {
    const val = parseInt(rateInput, 10);
    if (!isNaN(val) && val > 0) onHourlyRateChange(val);
    setEditingRate(false);
  };

  const handleGoalSave = () => {
    const val = parseInt(goalInput, 10);
    if (!isNaN(val) && val >= 0) onMonthlyGoalChange(val);
    setEditingGoal(false);
  };

  const handleAddShift = () => {
    if (!shiftForm.date || !shiftForm.startTime || !shiftForm.endTime) return;
    onAddShift({
      date: shiftForm.date,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      note: shiftForm.note || undefined,
    });
    setShiftForm({ date: "", startTime: "", endTime: "", note: "" });
    setShowShiftForm(false);
  };

  return (
    <div className="space-y-4">
      {/* 時給設定 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">時給設定</p>
        {editingRate ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-600">¥</span>
            <input
              type="number"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRateSave()}
              className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <button onClick={handleRateSave} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">保存</button>
            <button onClick={() => { setRateInput(String(hourlyRate)); setEditingRate(false); }} className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1.5">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-gray-800">
              {formatCurrency(hourlyRate)}
              <span className="text-sm font-normal text-gray-500 ml-1">/時間</span>
            </span>
            <button onClick={() => { setRateInput(String(hourlyRate)); setEditingRate(true); }} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">変更</button>
          </div>
        )}
      </div>

      {/* 今月の目標給与 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">今月の目標給与</p>
          {!editingGoal && (
            <button
              onClick={() => { setGoalInput(String(monthlyGoal || "")); setEditingGoal(true); }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg transition-colors"
            >
              {monthlyGoal > 0 ? "変更" : "設定"}
            </button>
          )}
        </div>
        {editingGoal ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-600">¥</span>
            <input
              type="number"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGoalSave()}
              className="flex-1 border border-blue-400 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="目標金額を入力"
              autoFocus
            />
            <button onClick={handleGoalSave} className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">保存</button>
            <button onClick={() => setEditingGoal(false)} className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1.5">✕</button>
          </div>
        ) : monthlyGoal > 0 ? (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-bold text-gray-800">
                {formatCurrency(monthSalary)}
                <span className="text-xs text-gray-400 font-normal"> / {formatCurrency(monthlyGoal)}</span>
              </span>
              <span className={`text-sm font-bold ${goalProgress >= 80 ? "text-green-600" : goalProgress >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                {goalProgress}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${goalProgress >= 80 ? "bg-green-500" : goalProgress >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            {monthlyGoal > monthSalary && (
              <p className="text-xs text-gray-400 mt-1">あと {formatCurrency(monthlyGoal - monthSalary)} で目標達成</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">目標を設定すると進捗が表示されます</p>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="今日" amount={todaySalary} color="from-emerald-400 to-teal-500" icon="☀️" />
        <SummaryCard label="今月" amount={monthSalary} color="from-blue-400 to-indigo-500" icon="📅" />
        <SummaryCard label="今年" amount={yearSalary} color="from-violet-400 to-purple-600" icon="📊" />
      </div>

      {/* 今週のサマリー */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">今週のサマリー</p>
        {weekRecords.length === 0 ? (
          <p className="text-sm text-gray-400">今週の勤務記録はありません</p>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-gray-400">勤務日数</p>
                <p className="text-lg font-bold text-gray-800">{weekRecords.length}日</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">勤務時間</p>
                <p className="text-lg font-bold text-gray-800">{formatHours(weekHours)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">今週の給与</p>
              <p className="text-xl font-bold text-indigo-600">{formatCurrency(weekSalary)}</p>
            </div>
          </div>
        )}
      </div>

      {/* カレンダー */}
      <AttendanceCalendar
        attendance={attendance}
        shifts={shifts ?? []}
        onDeleteRecord={onDeleteRecord}
      />

      {/* 勤怠履歴 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">勤怠履歴</p>
        {sortedMonths.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm">まだ記録がありません</p>
            <p className="text-xs mt-1">チャットで勤務時間を教えてください</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMonths.map((month) => {
              const records = grouped[month].sort((a, b) => b.date.localeCompare(a.date));
              const monthTotal = records.reduce((s, r) => s + r.salary, 0);
              const monthTransport = records.reduce((s, r) => s + (r.transport ?? 0), 0);
              const monthHours = records.reduce((s, r) => s + r.hours, 0);
              const isExpanded = expandedMonth === month;
              return (
                <div key={month} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedMonth(isExpanded ? null : month)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">{getMonthLabel(month)}</span>
                      <span className="text-xs text-gray-400">{records.length}日 / {formatHours(monthHours)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold text-indigo-600">{formatCurrency(monthTotal)}</p>
                        {monthTransport > 0 && <p className="text-xs text-gray-400">+交通費{formatCurrency(monthTransport)}</p>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); exportCSV(records, month); }}
                        className="text-xs bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 px-2 py-1 rounded-lg transition-colors"
                        title="CSVエクスポート"
                      >
                        CSV
                      </button>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-gray-50">
                      {records.map((record) => {
                        const isToday = record.date === today;
                        return (
                          <div key={record.date} className={`flex items-center justify-between px-4 py-2.5 ${isToday ? "bg-blue-50" : "bg-white"}`}>
                            <div className="flex items-center gap-2">
                              {isToday && <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">今日</span>}
                              <span className="text-sm text-gray-700">{formatDate(record.date)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-800">
                                  {formatCurrency(record.salary)}
                                  {record.transport ? <span className="text-xs text-gray-400 ml-1">+{formatCurrency(record.transport)}</span> : null}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {record.startTime && record.endTime
                                    ? `${record.startTime}〜${record.endTime}${record.breakMinutes ? ` 休${record.breakMinutes}分` : ""}`
                                    : formatHours(record.hours)}
                                </p>
                              </div>
                              <button
                                onClick={() => onDeleteRecord(record.date)}
                                className="text-gray-300 hover:text-red-400 transition-colors p-1 rounded"
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* シフト予定 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">シフト予定</p>
          <button
            onClick={() => setShowShiftForm(!showShiftForm)}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-3 py-1 rounded-lg transition-colors"
          >
            {showShiftForm ? "閉じる" : "+ 追加"}
          </button>
        </div>

        {showShiftForm && (
          <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">日付</label>
                <input
                  type="date"
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">メモ</label>
                <input
                  type="text"
                  value={shiftForm.note}
                  onChange={(e) => setShiftForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="任意"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">開始時刻</label>
                <input
                  type="time"
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">終了時刻</label>
                <input
                  type="time"
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <button
              onClick={handleAddShift}
              disabled={!shiftForm.date || !shiftForm.startTime || !shiftForm.endTime}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
            >
              追加
            </button>
          </div>
        )}

        {upcomingShifts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">シフト予定がありません</p>
        ) : (
          <div className="space-y-1.5">
            {upcomingShifts.map((shift) => {
              const isPast = shift.date < today;
              const isWorked = attendance.some((r) => r.date === shift.date);
              return (
                <div
                  key={shift.date}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${isPast ? "opacity-60 bg-gray-50" : "bg-blue-50"}`}
                >
                  <div className="flex items-center gap-2">
                    {isWorked ? (
                      <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">✓ 記録済</span>
                    ) : isPast ? (
                      <span className="text-xs bg-gray-400 text-white px-1.5 py-0.5 rounded-full">未記録</span>
                    ) : (
                      <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">予定</span>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-800">{formatDate(shift.date)}</p>
                      <p className="text-xs text-gray-500">
                        {shift.startTime}〜{shift.endTime}
                        {shift.note ? ` / ${shift.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteShift(shift.date)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  amount,
  color,
  icon,
}: {
  label: string;
  amount: number;
  color: string;
  icon: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-3 text-white shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold opacity-90">{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <p className="text-lg font-bold leading-tight">
        {amount > 0 ? formatCurrency(amount) : "¥0"}
      </p>
    </div>
  );
}
