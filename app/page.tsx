"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import SalaryDashboard from "@/components/SalaryDashboard";
import JobManager from "@/components/JobManager";
import { AttendanceRecord, ChatMessage, Job, ShiftRecord, SSEEvent } from "@/lib/types";
import {
  getTodayString,
  groupByMonth,
  getMonthLabel,
  formatCurrency,
  formatHours,
  upsertAttendance,
} from "@/lib/utils";

const DEFAULT_HOURLY_RATE = 1000;
const STORAGE_KEY_ATTENDANCE = "kyuyo_attendance";
const STORAGE_KEY_RATE = "kyuyo_hourly_rate";
const STORAGE_KEY_MESSAGES = "kyuyo_messages";
const STORAGE_KEY_SHIFTS = "kyuyo_shifts";
const STORAGE_KEY_GOAL = "kyuyo_monthly_goal";
const STORAGE_KEY_JOBS = "kyuyo_jobs";
const STORAGE_KEY_ACTIVE_JOB = "kyuyo_active_job";

const DEFAULT_JOB: Job = {
  id: "default",
  name: "メインバイト",
  hourlyRate: DEFAULT_HOURLY_RATE,
  color: "from-blue-400 to-indigo-500",
};

function buildAttendanceSummary(
  attendance: AttendanceRecord[],
  hourlyRate: number
): string {
  if (attendance.length === 0) return "記録なし";
  const grouped = groupByMonth(attendance);
  const lines: string[] = [];
  for (const [month, records] of Object.entries(grouped)) {
    const total = records.reduce((s, r) => s + r.salary, 0);
    const hours = records.reduce((s, r) => s + r.hours, 0);
    lines.push(
      `${getMonthLabel(month)}: ${records.length}日勤務, 合計${formatHours(hours)}, ${formatCurrency(total)}`
    );
    for (const r of records.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)) {
      lines.push(`  - ${r.date}: ${formatHours(r.hours)} (${formatCurrency(r.salary)})`);
    }
  }
  lines.push(`\n時給: ${formatCurrency(hourlyRate)}/時間`);
  return lines.join("\n");
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "こんにちは！給与計算アシスタントです😊\n\n「今日8時間働きました」のように話しかけると、勤怠を自動で記録します。\n\n時給は左側のパネルで設定できます。何でも気軽に聞いてください！",
  timestamp: new Date().toISOString(),
};

export default function Home() {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [hourlyRate, setHourlyRate] = useState(DEFAULT_HOURLY_RATE);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "dashboard">("chat");
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([DEFAULT_JOB]);
  const [activeJobId, setActiveJobId] = useState<string>("default");
  const abortRef = useRef<AbortController | null>(null);

  const activeJob = jobs.find((j) => j.id === activeJobId) ?? jobs[0];

  // Load from localStorage
  useEffect(() => {
    try {
      const savedAttendance = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
      if (savedAttendance) setAttendance(JSON.parse(savedAttendance));
      const savedRate = localStorage.getItem(STORAGE_KEY_RATE);
      if (savedRate) setHourlyRate(Number(savedRate));
      const savedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (parsed.length > 0) setMessages(parsed);
      }
      const savedShifts = localStorage.getItem(STORAGE_KEY_SHIFTS);
      if (savedShifts) setShifts(JSON.parse(savedShifts));
      const savedGoal = localStorage.getItem(STORAGE_KEY_GOAL);
      if (savedGoal) setMonthlyGoal(Number(savedGoal));
      const savedJobs = localStorage.getItem(STORAGE_KEY_JOBS);
      if (savedJobs) setJobs(JSON.parse(savedJobs));
      const savedActiveJob = localStorage.getItem(STORAGE_KEY_ACTIVE_JOB);
      if (savedActiveJob) setActiveJobId(savedActiveJob);
    } catch {
      // ignore parse errors
    }
  }, []);

  // Save attendance
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

  // Save rate
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RATE, String(hourlyRate));
  }, [hourlyRate]);

  // Save messages (keep last 50)
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY_MESSAGES,
      JSON.stringify(messages.slice(-50))
    );
  }, [messages]);

  // Save shifts
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
  }, [shifts]);

  // Save monthly goal
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GOAL, String(monthlyGoal));
  }, [monthlyGoal]);

  // Save jobs
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(jobs));
  }, [jobs]);

  // Save active job
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_JOB, activeJobId);
  }, [activeJobId]);

  const addAssistantPlaceholder = () => {
    const id = `msg_${Date.now()}`;
    const placeholder: ChatMessage = {
      id,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholder]);
    return id;
  };

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const placeholderId = addAssistantPlaceholder();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const allMessages = [...messages, userMsg];
        const apiMessages = allMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const currentAttendance: AttendanceRecord[] = await new Promise((res) =>
          setAttendance((prev) => {
            res(prev);
            return prev;
          })
        );

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            hourlyRate: activeJob.hourlyRate,
            today: getTodayString(),
            attendanceSummary: buildAttendanceSummary(
              currentAttendance,
              activeJob.hourlyRate
            ),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) throw new Error("API error");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: SSEEvent;
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            if (event.type === "text" && event.content) {
              assistantText = event.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId ? { ...m, content: assistantText } : m
                )
              );
            } else if (event.type === "attendance" && event.record) {
              setAttendance((prev) => upsertAttendance(prev, { ...event.record!, jobId: activeJobId }));
            } else if (event.type === "delete_attendance" && event.date) {
              setAttendance((prev) =>
                prev.filter((r) => r.date !== event.date)
              );
            } else if (event.type === "error" && event.message) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? { ...m, content: event.message! }
                    : m
                )
              );
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? {
                    ...m,
                    content: "エラーが発生しました。もう一度お試しください。",
                  }
                : m
            )
          );
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, messages, hourlyRate]
  );

  const handleDeleteRecord = useCallback((date: string) => {
    setAttendance((prev) => prev.filter((r) => r.date !== date));
  }, []);

  const handleAddShift = useCallback((shift: ShiftRecord) => {
    setShifts((prev) => {
      const filtered = prev.filter((s) => s.date !== shift.date);
      return [...filtered, shift].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const handleDeleteShift = useCallback((date: string) => {
    setShifts((prev) => prev.filter((s) => s.date !== date));
  }, []);

  const handleAddJob = useCallback((job: Job) => {
    setJobs((prev) => [...prev, job]);
    setActiveJobId(job.id);
  }, []);

  const handleDeleteJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setActiveJobId((prev) => (prev === id ? jobs[0]?.id ?? "default" : prev));
  }, [jobs]);

  const handleUpdateJob = useCallback((job: Job) => {
    setJobs((prev) => prev.map((j) => j.id === job.id ? job : j));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <div>
              <h1 className="text-base font-bold text-gray-800 leading-none">
                給与計算アシスタント
              </h1>
              <p className="text-xs text-gray-400">AI勤怠管理</p>
            </div>
          </div>
          {/* Mobile tab switcher */}
          <div className="flex md:hidden gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMobileTab("chat")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mobileTab === "chat"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              チャット
            </button>
            <button
              onClick={() => setMobileTab("dashboard")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mobileTab === "dashboard"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              集計
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4">
        {/* Desktop: side by side */}
        <div className="hidden md:grid md:grid-cols-5 gap-4 h-[calc(100vh-80px)]">
          <div className="md:col-span-3 flex flex-col">
            <ChatInterface
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
            />
          </div>
          <div className="md:col-span-2 overflow-y-auto pb-4 space-y-4">
            <JobManager
              jobs={jobs}
              activeJobId={activeJobId}
              onAddJob={handleAddJob}
              onDeleteJob={handleDeleteJob}
              onSetActive={setActiveJobId}
              onUpdateJob={handleUpdateJob}
            />
            <SalaryDashboard
              attendance={attendance}
              hourlyRate={activeJob.hourlyRate}
              onHourlyRateChange={(rate) => handleUpdateJob({ ...activeJob, hourlyRate: rate })}
              onDeleteRecord={handleDeleteRecord}
              monthlyGoal={monthlyGoal}
              onMonthlyGoalChange={setMonthlyGoal}
              shifts={shifts}
              onAddShift={handleAddShift}
              onDeleteShift={handleDeleteShift}
            />
          </div>
        </div>

        {/* Mobile: tabs */}
        <div className="md:hidden">
          {mobileTab === "chat" ? (
            <div style={{ height: "calc(100vh - 120px)" }}>
              <ChatInterface
                messages={messages}
                isLoading={isLoading}
                onSendMessage={handleSendMessage}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <JobManager
                jobs={jobs}
                activeJobId={activeJobId}
                onAddJob={handleAddJob}
                onDeleteJob={handleDeleteJob}
                onSetActive={setActiveJobId}
                onUpdateJob={handleUpdateJob}
              />
              <SalaryDashboard
                attendance={attendance}
                hourlyRate={activeJob.hourlyRate}
                onHourlyRateChange={(rate) => handleUpdateJob({ ...activeJob, hourlyRate: rate })}
                onDeleteRecord={handleDeleteRecord}
                monthlyGoal={monthlyGoal}
                onMonthlyGoalChange={setMonthlyGoal}
                shifts={shifts}
                onAddShift={handleAddShift}
                onDeleteShift={handleDeleteShift}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
