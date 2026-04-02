"use client";

import { useState } from "react";
import { Job } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const JOB_COLORS = [
  { label: "青", value: "from-blue-400 to-indigo-500" },
  { label: "緑", value: "from-emerald-400 to-teal-500" },
  { label: "紫", value: "from-violet-400 to-purple-600" },
  { label: "赤", value: "from-rose-400 to-pink-500" },
  { label: "橙", value: "from-orange-400 to-amber-500" },
];

interface Props {
  jobs: Job[];
  activeJobId: string;
  onAddJob: (job: Job) => void;
  onDeleteJob: (id: string) => void;
  onSetActive: (id: string) => void;
  onUpdateJob: (job: Job) => void;
}

export default function JobManager({ jobs, activeJobId, onAddJob, onDeleteJob, onSetActive, onUpdateJob }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", hourlyRate: "", color: JOB_COLORS[0].value });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", hourlyRate: "", color: "" });

  const handleAdd = () => {
    const rate = parseInt(form.hourlyRate, 10);
    if (!form.name.trim() || isNaN(rate) || rate <= 0) return;
    onAddJob({
      id: `job_${Date.now()}`,
      name: form.name.trim(),
      hourlyRate: rate,
      color: form.color,
    });
    setForm({ name: "", hourlyRate: "", color: JOB_COLORS[0].value });
    setShowForm(false);
  };

  const handleEditSave = (id: string) => {
    const rate = parseInt(editForm.hourlyRate, 10);
    if (!editForm.name.trim() || isNaN(rate) || rate <= 0) return;
    const job = jobs.find((j) => j.id === id);
    if (!job) return;
    onUpdateJob({ ...job, name: editForm.name.trim(), hourlyRate: rate, color: editForm.color });
    setEditingId(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">バイト管理</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-3 py-1 rounded-lg transition-colors"
        >
          {showForm ? "閉じる" : "+ 追加"}
        </button>
      </div>

      {showForm && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="バイト名（例: コンビニ）"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={form.hourlyRate}
                onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                placeholder="時給（円）"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <select
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {JOB_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={!form.name.trim() || !form.hourlyRate}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
          >
            追加
          </button>
        </div>
      )}

      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.id}>
            {editingId === job.id ? (
              <div className="p-3 bg-gray-50 rounded-xl space-y-2 border border-blue-200">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={editForm.hourlyRate}
                    onChange={(e) => setEditForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <select
                    value={editForm.color}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  >
                    {JOB_COLORS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditSave(job.id)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 rounded-lg transition-colors">保存</button>
                  <button onClick={() => setEditingId(null)} className="px-3 text-gray-400 hover:text-gray-600 text-sm border border-gray-200 rounded-lg py-1.5">✕</button>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  activeJobId === job.id ? "border-blue-300 bg-blue-50" : "border-gray-100 hover:bg-gray-50"
                }`}
                onClick={() => onSetActive(job.id)}
              >
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${job.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{job.name}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(job.hourlyRate)}/時間</p>
                </div>
                {activeJobId === job.id && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">使用中</span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(job.id); setEditForm({ name: job.name, hourlyRate: String(job.hourlyRate), color: job.color }); }}
                    className="text-gray-300 hover:text-blue-400 transition-colors p-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {jobs.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteJob(job.id); }}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">タップして使用するバイトを切り替え</p>
    </div>
  );
}
