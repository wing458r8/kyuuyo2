import { AttendanceRecord } from "./types";

export function formatCurrency(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}月${date.getDate()}日(${days[date.getDay()]})`;
}

export function formatYearMonth(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

// ローカル日付を返す（UTCではなく端末のタイムゾーン基準）
export function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 時刻（10進数）と時給から割増込みの給与を計算する
 * - 5:00〜18:00  通常 (1.0倍)
 * - 18:00〜22:00 残業 (1.25倍)
 * - 22:00〜翌5:00 深夜 (1.25倍)
 * ※ 深夜 × 残業が重なる場合も同率 1.25倍（ユーザー指定仕様）
 */
export function calculateSalaryWithTime(
  startHour: number,
  endHour: number,
  hourlyRate: number
): number {
  if (endHour <= startHour) endHour += 24; // 日をまたぐ場合

  const segments = [
    { from: 0, to: 5, rate: 1.25 },   // 深夜 (0〜5時)
    { from: 5, to: 18, rate: 1.0 },   // 通常
    { from: 18, to: 22, rate: 1.25 }, // 残業
    { from: 22, to: 29, rate: 1.25 }, // 深夜 (22〜翌5時、29=翌5時)
  ];

  let total = 0;
  for (const seg of segments) {
    const overlap = Math.max(0, Math.min(endHour, seg.to) - Math.max(startHour, seg.from));
    total += overlap * hourlyRate * seg.rate;
  }
  return Math.round(total);
}

export function timeToHour(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + (m || 0) / 60;
}

export function getTodaySalary(attendance: AttendanceRecord[]): number {
  const today = getTodayString();
  return attendance.find((r) => r.date === today)?.salary ?? 0;
}

export function getThisMonthSalary(attendance: AttendanceRecord[]): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return attendance
    .filter((r) => {
      const d = new Date(r.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((sum, r) => sum + r.salary, 0);
}

export function getThisYearSalary(attendance: AttendanceRecord[]): number {
  const year = new Date().getFullYear();
  return attendance
    .filter((r) => new Date(r.date + "T00:00:00").getFullYear() === year)
    .reduce((sum, r) => sum + r.salary, 0);
}

export function groupByMonth(
  attendance: AttendanceRecord[]
): Record<string, AttendanceRecord[]> {
  const groups: Record<string, AttendanceRecord[]> = {};
  for (const record of attendance) {
    const key = record.date.substring(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }
  return groups;
}

export function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}年${parseInt(month)}月`;
}

export function upsertAttendance(
  prev: AttendanceRecord[],
  record: AttendanceRecord
): AttendanceRecord[] {
  const filtered = prev.filter((r) => r.date !== record.date);
  return [...filtered, record].sort((a, b) => b.date.localeCompare(a.date));
}

export function projectAnnualIncome(attendance: AttendanceRecord[]): { monthly: number; annual: number; daysPerMonth: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // 今月の記録
  const thisMonth = attendance.filter((r) => {
    const d = new Date(r.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  if (thisMonth.length === 0) {
    // 全記録から月平均を計算
    const grouped: Record<string, number> = {};
    for (const r of attendance) {
      const key = r.date.substring(0, 7);
      grouped[key] = (grouped[key] ?? 0) + r.salary;
    }
    const months = Object.values(grouped);
    if (months.length === 0) return { monthly: 0, annual: 0, daysPerMonth: 0 };
    const monthly = Math.round(months.reduce((s, v) => s + v, 0) / months.length);
    const daysPerMonth = Math.round(attendance.length / months.length);
    return { monthly, annual: monthly * 12, daysPerMonth };
  }
  const monthly = thisMonth.reduce((s, r) => s + r.salary, 0);
  return { monthly, annual: monthly * 12, daysPerMonth: thisMonth.length };
}

export function getThisWeekRecords(attendance: AttendanceRecord[]): AttendanceRecord[] {
  const today = new Date();
  const dow = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return attendance.filter((r) => {
    const d = new Date(r.date + "T00:00:00");
    return d >= startOfWeek && d <= endOfWeek;
  });
}

export function prepareApiMessages(
  messages: { role: string; content: string }[]
): { role: "user" | "assistant"; content: string }[] {
  const valid = messages.filter((m) => m.content.trim());
  const merged: { role: "user" | "assistant"; content: string }[] = [];
  for (const msg of valid) {
    const role = msg.role as "user" | "assistant";
    if (merged.length > 0 && merged[merged.length - 1].role === role) {
      merged[merged.length - 1].content += "\n" + msg.content;
    } else {
      merged.push({ role, content: msg.content });
    }
  }
  while (merged.length > 0 && merged[0].role === "assistant") {
    merged.shift();
  }
  return merged.slice(-20);
}
