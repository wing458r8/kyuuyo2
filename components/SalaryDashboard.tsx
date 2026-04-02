"use client";

import { useState } from "react";
import { AttendanceRecord } from "@/lib/types";
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
} from "@/lib/utils";

interface Props {
  attendance: AttendanceRecord[];
  hourlyRate: number;
  onHourlyRateChange: (rate: number) => void;
  onDeleteRecord: (date: string) => void;
}

export default function SalaryDashboard({
  attendance,
  hourlyRate,
  onHourlyRateChange,
  onDeleteRecord,
}: Props) {
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(hourlyRate));
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const todaySalary = getTodaySalary(attendance);
  const monthSalary = getThisMonthSalary(attendance);
  const yearSalary = getThisYearSalary(attendance);
  const grouped = groupByMonth(attendance);
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleRateSave = () => {
    const val = parseInt(rateInput, 10);
    if (!isNaN(val) && val > 0) {
      onHourlyRateChange(val);
    }
    setEditingRate(false);
  };

  return (
    <div className="space-y-4">
      {/* 時給設定 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          時給設定
        </p>
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
            <button
              onClick={handleRateSave}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => {
                setRateInput(String(hourlyRate));
                setEditingRate(false);
              }}
              className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1.5"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-gray-800">
              {formatCurrency(hourlyRate)}
              <span className="text-sm font-normal text-gray-500 ml-1">/時間</span>
            </span>
            <button
              onClick={() => {
                setRateInput(String(hourlyRate));
                setEditingRate(true);
              }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              変更
            </button>
          </div>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="今日"
          amount={todaySalary}
          color="from-emerald-400 to-teal-500"
          icon="☀️"
        />
        <SummaryCard
          label="今月"
          amount={monthSalary}
          color="from-blue-400 to-indigo-500"
          icon="📅"
        />
        <SummaryCard
          label="今年"
          amount={yearSalary}
          color="from-violet-400 to-purple-600"
          icon="📊"
        />
      </div>

      {/* 勤怠履歴 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          勤怠履歴
        </p>

        {sortedMonths.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm">まだ記録がありません</p>
            <p className="text-xs mt-1">チャットで勤務時間を教えてください</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMonths.map((month) => {
              const records = grouped[month].sort((a, b) =>
                b.date.localeCompare(a.date)
              );
              const monthTotal = records.reduce((s, r) => s + r.salary, 0);
              const monthHours = records.reduce((s, r) => s + r.hours, 0);
              const isExpanded = expandedMonth === month;

              return (
                <div key={month} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedMonth(isExpanded ? null : month)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-700">
                        {getMonthLabel(month)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {records.length}日 / {formatHours(monthHours)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-indigo-600">
                        {formatCurrency(monthTotal)}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-gray-50">
                      {records.map((record) => {
                        const isToday = record.date === getTodayString();
                        return (
                          <div
                            key={record.date}
                            className={`flex items-center justify-between px-4 py-2.5 ${
                              isToday ? "bg-blue-50" : "bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isToday && (
                                <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">
                                  今日
                                </span>
                              )}
                              <span className="text-sm text-gray-700">
                                {formatDate(record.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-gray-800">
                                  {formatCurrency(record.salary)}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {record.startTime && record.endTime
                                    ? `${record.startTime}〜${record.endTime}`
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
