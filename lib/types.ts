export interface Job {
  id: string;
  name: string;
  hourlyRate: number;
  color: string; // tailwind gradient class e.g. "from-blue-400 to-indigo-500"
}

export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  hours: number;
  salary: number;
  startTime?: string; // "09:00"
  endTime?: string;   // "19:00"
  breakMinutes?: number; // 60
  transport?: number;    // 500
  jobId?: string;
}

export interface ShiftRecord {
  date: string; // YYYY-MM-DD
  startTime: string; // "09:00"
  endTime: string;   // "19:00"
  note?: string;
  jobId?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface SSEEvent {
  type: "text" | "attendance" | "delete_attendance" | "done" | "error";
  content?: string;
  record?: AttendanceRecord;
  date?: string;
  message?: string;
}
