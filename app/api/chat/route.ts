import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { prepareApiMessages, calculateSalaryWithTime, timeToHour } from "@/lib/utils";

// ── 給与計算ヘルパー ───────────────────────────────────────────────

function calcSalary(
  startTime: string | undefined,
  endTime: string | undefined,
  hours: number | undefined,
  hourlyRate: number,
  breakMinutes: number = 0
): { salary: number; hours: number; startTime?: string; endTime?: string } {
  const breakHours = breakMinutes / 60;
  if (startTime && endTime) {
    const s = timeToHour(startTime);
    const e = timeToHour(endTime);
    const h = e <= s ? e + 24 - s : e - s;
    const effectiveHours = Math.max(0, h - breakHours);
    let salary = calculateSalaryWithTime(s, e, hourlyRate);
    salary = Math.max(0, Math.round(salary - breakHours * hourlyRate));
    return { salary, hours: Math.round(effectiveHours * 100) / 100, startTime, endTime };
  }
  const h = Math.max(0, (hours ?? 0) - breakHours);
  return { salary: Math.round(h * hourlyRate), hours: Math.round(h * 100) / 100 };
}

function parseBreak(text: string): number | null {
  const hm = text.match(/休憩\s*(\d+)\s*時間\s*(\d+)\s*分/);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);
  const h = text.match(/休憩\s*(\d+(?:\.\d+)?)\s*時間/);
  if (h) return Math.round(parseFloat(h[1]) * 60);
  const m = text.match(/休憩\s*(\d+)\s*分/);
  if (m) return parseInt(m[1]);
  return null;
}

function parseTransport(text: string): number | null {
  const m = text.match(/交通費\s*(\d+)\s*円/);
  if (m) return parseInt(m[1]);
  return null;
}

// ── ルールベースパーサー（APIキーなしモード） ──────────────────────

function getDateString(base: string, offsetDays: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPastWeekday(today: string, targetDay: number): string {
  const d = new Date(today + "T00:00:00");
  const diff = (d.getDay() - targetDay + 7) % 7 || 7;
  d.setDate(d.getDate() - diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(text: string, today: string): string | null {
  if (/今日|本日|きょう/.test(text)) return today;
  if (/昨日|きのう/.test(text)) return getDateString(today, -1);
  if (/一昨日|おととい/.test(text)) return getDateString(today, -2);
  const weekdays: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };
  for (const [name, idx] of Object.entries(weekdays)) {
    if (new RegExp(name + "曜").test(text)) return getPastWeekday(today, idx);
  }
  const iso = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const jp = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (jp) {
    const year = new Date(today + "T00:00:00").getFullYear();
    return `${year}-${jp[1].padStart(2, "0")}-${jp[2].padStart(2, "0")}`;
  }
  return null;
}

function parseTimeRange(text: string): { startTime: string; endTime: string } | null {
  // "9:00〜19:00", "9時〜19時", "9時から19時まで", "9-19時"
  const m = text.match(/(\d{1,2})[:時](\d{0,2})\s*[〜~～\-〜から]\s*(\d{1,2})[:時](\d{0,2})/);
  if (m) {
    const sh = m[1].padStart(2, "0");
    const sm = (m[2] || "00").padStart(2, "0");
    const eh = m[3].padStart(2, "0");
    const em = (m[4] || "00").padStart(2, "0");
    return { startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` };
  }
  return null;
}

function parseHours(text: string): number | null {
  // "7時間30分" / "7.5時間" / "7時間" など明示的な時間表現を優先
  const hm = text.match(/(\d+(?:\.\d+)?)\s*時間\s*(\d+)\s*分/);
  if (hm) return parseFloat(hm[1]) + parseInt(hm[2]) / 60;
  const h = text.match(/(\d+(?:\.\d+)?)\s*(時間|h|hour)/i);
  if (h) return parseFloat(h[1]);
  const m = text.match(/^(\d+)\s*分$/);
  if (m) return parseInt(m[1]) / 60;

  // 「〜は N」「〜でN」「〜でN時間」などの末尾数字パターン
  // 例: "3月31日は7.5", "一昨日は8", "月曜日でした6.5"
  const suffix = text.match(/[はでにでした。]*\s*(\d+(?:\.\d+)?)\s*$/);
  if (suffix) {
    const v = parseFloat(suffix[1]);
    if (v > 0 && v <= 24) return v;
  }

  // 入力が数字だけ
  const numOnly = text.trim().match(/^(\d+(?:\.\d+)?)$/);
  if (numOnly) {
    const v = parseFloat(numOnly[1]);
    if (v > 0 && v <= 24) return v;
  }
  return null;
}

type ParseResult =
  | { type: "record"; date: string; hours: number; startTime?: string; endTime?: string; breakMinutes?: number; transport?: number }
  | { type: "delete"; date: string }
  | { type: "date_query"; date: string }
  | { type: "query" }
  | { type: "unknown" };

function parseIntent(text: string, today: string): ParseResult {
  const isDelete = /削除|消[しす]|取[り消]|なかったことに/.test(text);
  const date = parseDate(text, today) ?? today;
  if (isDelete && parseDate(text, today)) return { type: "delete", date };

  const timeRange = parseTimeRange(text);
  const breakMinutes = parseBreak(text) ?? undefined;
  const transport = parseTransport(text) ?? undefined;

  if (timeRange) {
    const s = timeToHour(timeRange.startTime);
    const e = timeToHour(timeRange.endTime);
    const rawHours = e <= s ? e + 24 - s : e - s;
    const effectiveHours = Math.round((rawHours - (breakMinutes ?? 0) / 60) * 100) / 100;
    return { type: "record", date, hours: Math.max(0, effectiveHours), ...timeRange, breakMinutes, transport };
  }

  const hours = parseHours(text);
  const isRecord =
    /働[いく]|勤務|出勤|仕事|シフト|バイト|勤[めた]/.test(text) ||
    hours !== null;
  if (isRecord && hours !== null) return { type: "record", date, hours, breakMinutes, transport };

  // 特定日の給与照会（例: 今日の給与は？ 昨日いくら？）
  const isDateQuery = /給与|給料|いくら|稼[いぎ]/.test(text) && parseDate(text, today) !== null;
  if (isDateQuery) return { type: "date_query", date };

  const isQuery = /給与|給料|いくら|合計|今月|今年|今日|昨日|稼[いぎ]|計算/.test(text);
  if (isQuery) return { type: "query" };

  return { type: "unknown" };
}

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function ruleBasedReply(
  text: string,
  today: string,
  hourlyRate: number,
  attendanceSummary: string
): { reply: string; action?: ParseResult } {
  if (/^(こんにちは|おはよう|こんばんは|よろしく|はじめまして|hello|hi)/.test(text)) {
    return { reply: "こんにちは！😊\n「9:00〜19:00 働きました」のように時刻を入力すると、残業・深夜割増を自動計算して記録します！" };
  }

  const intent = parseIntent(text, today);

  if (intent.type === "record") {
    const { salary, hours, startTime, endTime } = calcSalary(
      intent.startTime, intent.endTime, intent.hours, hourlyRate, intent.breakMinutes ?? 0
    );
    const timeStr = formatHours(hours);
    const timeRangeStr = startTime && endTime ? ` (${startTime}〜${endTime})` : "";
    const breakStr = intent.breakMinutes ? ` 休憩${intent.breakMinutes}分` : "";
    const transportStr = intent.transport ? `\n🚃 交通費: ¥${intent.transport.toLocaleString("ja-JP")}` : "";
    const totalStr = intent.transport ? ` （合計 ¥${(salary + intent.transport).toLocaleString("ja-JP")}）` : "";
    return {
      reply: `✅ ${formatDateJP(intent.date)}${timeRangeStr}${breakStr}の勤務を記録しました！\n**${timeStr}** → **¥${salary.toLocaleString("ja-JP")}**（割増込み）${transportStr}${totalStr}`,
      action: intent,
    };
  }

  if (intent.type === "delete") {
    return {
      reply: `🗑️ ${formatDateJP(intent.date)}の記録を削除しました。`,
      action: intent,
    };
  }

  if (intent.type === "date_query") {
    // attendanceSummaryから該当日を探す（"YYYY-MM-DD: XX時間 ¥XX,XXX" 形式を想定）
    const lines = attendanceSummary.split("\n").filter((l) => l.includes(intent.date));
    if (lines.length > 0) {
      return { reply: `${formatDateJP(intent.date)}の給与:\n${lines[0]}` };
    }
    return { reply: `${formatDateJP(intent.date)}の記録はまだありません。` };
  }

  if (intent.type === "query") {
    return {
      reply: `現在の勤怠データ:\n${attendanceSummary || "まだ記録がありません"}\n\n時給: ¥${hourlyRate.toLocaleString("ja-JP")}/時間`,
    };
  }

  return {
    reply: "勤務時間を教えてください😊\n例: 「9:00〜19:00 働きました」「今日8時間でした」",
  };
}

// ── Claude APIモード ──────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "record_attendance",
    description:
      "勤務時間を記録します。ユーザーが働いた時間を伝えた場合に使用してください。時刻（開始・終了）があれば優先して使い、給与を割増込みで計算します。",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "勤務日 (YYYY-MM-DD形式)",
        },
        startTime: {
          type: "string",
          description: "開始時刻 HH:MM形式 例: 09:00（わかる場合）",
        },
        endTime: {
          type: "string",
          description: "終了時刻 HH:MM形式 例: 19:00（わかる場合）",
        },
        hours: {
          type: "number",
          description: "勤務時間数（startTime/endTimeがない場合のみ使用）",
        },
        breakMinutes: {
          type: "number",
          description: "休憩時間（分）。例: 1時間休憩なら60",
        },
        transport: {
          type: "number",
          description: "交通費（円）。例: 交通費500円なら500",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "delete_attendance",
    description: "特定の日の勤怠記録を削除します。",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "削除する日付 (YYYY-MM-DD形式)" },
      },
      required: ["date"],
    },
  },
];

function buildSystemPrompt(hourlyRate: number, today: string, attendanceSummary: string): string {
  const date = new Date(today + "T00:00:00");
  const days = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
  const dayOfWeek = days[date.getDay()];

  return `あなたは親切な給与計算アシスタントです。

**今日の日付**: ${today} (${dayOfWeek})
**時給**: ${hourlyRate.toLocaleString("ja-JP")}円/時間
**割増ルール**: 残業(18時以降) 1.25倍 / 深夜(22時〜5時) 1.25倍

## 勤怠記録のルール
- ユーザーが勤務時刻（例: 9:00〜19:00）を伝えたら、startTime/endTime を使って record_attendance を呼び出す
- 勤務時間数だけ伝えた場合（例: 8時間）は hours のみ使用
- 「今日」→ ${today}、「昨日」→ 前日、曜日 → 最近の該当曜日 に変換
- 割増計算は給与計算サーバー側で自動実施なので、ツールに時刻を渡すだけでOK

## 休憩・交通費のルール
- 「9:00〜19:00、休憩1時間」→ breakMinutes: 60 を record_attendance に含める
- 「交通費500円」→ transport: 500 を record_attendance に含める
- 休憩は給与から基本時給分を差し引いて計算される

## 給与照会のルール
- 「今日の給与は？」「昨日いくら？」→ 勤怠データから該当日を検索して答える
- 「今月の合計は？」「今年いくら稼いだ？」→ 勤怠データから集計して答える
- データがない日は「記録がありません」と伝える

## 応答のルール
- 常に日本語でフレンドリーに応答
- 記録後は「○月○日 9:00〜19:00 → ¥XX,XXX（割増込み）を記録しました！」と伝える

## 現在の勤怠データ
${attendanceSummary || "まだ記録はありません"}`;
}

// ── Route Handler ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages, hourlyRate, today, attendanceSummary } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // ── APIキーなし → ルールベースモード ──
        if (!process.env.ANTHROPIC_API_KEY) {
          const userText = messages[messages.length - 1]?.content ?? "";
          const { reply, action } = ruleBasedReply(userText, today, hourlyRate, attendanceSummary);

          if (action?.type === "record") {
            const { salary, hours, startTime, endTime } = calcSalary(
              action.startTime, action.endTime, action.hours, hourlyRate, action.breakMinutes ?? 0
            );
            send({ type: "attendance", record: { date: action.date, hours, salary, startTime, endTime, breakMinutes: action.breakMinutes, transport: action.transport } });
          } else if (action?.type === "delete") {
            send({ type: "delete_attendance", date: action.date });
          }

          send({ type: "text", content: reply });
          send({ type: "done" });
          controller.close();
          return;
        }

        // ── APIキーあり → Claude モード ──
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const apiMessages = prepareApiMessages(messages);
        const systemPrompt = buildSystemPrompt(hourlyRate, today, attendanceSummary);
        let conversationMessages: Anthropic.MessageParam[] = [...apiMessages];
        let iterations = 0;

        while (iterations < 5) {
          iterations++;
          const response = await client.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 1024,
            system: systemPrompt,
            tools,
            messages: conversationMessages,
          });

          if (response.stop_reason === "tool_use") {
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
              if (block.type === "tool_use") {
                if (block.name === "record_attendance") {
                  const input = block.input as {
                    date: string;
                    startTime?: string;
                    endTime?: string;
                    hours?: number;
                    breakMinutes?: number;
                    transport?: number;
                  };
                  const { salary, hours, startTime, endTime } = calcSalary(
                    input.startTime, input.endTime, input.hours, hourlyRate, input.breakMinutes ?? 0
                  );
                  send({ type: "attendance", record: { date: input.date, hours, salary, startTime, endTime, breakMinutes: input.breakMinutes, transport: input.transport } });
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: `記録完了: ${input.date} ${hours}時間 ¥${salary.toLocaleString("ja-JP")}（割増込み）`,
                  });
                } else if (block.name === "delete_attendance") {
                  const input = block.input as { date: string };
                  send({ type: "delete_attendance", date: input.date });
                  toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `削除完了: ${input.date}` });
                }
              }
            }
            conversationMessages = [
              ...conversationMessages,
              { role: "assistant" as const, content: response.content },
              { role: "user" as const, content: toolResults },
            ];
          } else {
            let text = "";
            for (const block of response.content) {
              if (block.type === "text") text += block.text;
            }
            send({ type: "text", content: text });
            break;
          }
        }

        send({ type: "done" });
        controller.close();
      } catch (error) {
        console.error("Chat API error:", error);
        send({ type: "error", message: "エラーが発生しました。もう一度お試しください。" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
