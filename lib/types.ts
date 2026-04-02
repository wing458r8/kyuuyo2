export interface AttendanceRecord {
  date: string; // YYYY-MM-DD
  hours: number;
  salary: number;
  startTime?: string; // "09:00"
  endTime?: string;   // "19:00"
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
