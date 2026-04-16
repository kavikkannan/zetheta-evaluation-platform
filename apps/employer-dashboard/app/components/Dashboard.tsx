"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter, 
  Activity,
  User,
  Mail,
  Trophy,
  ArrowRight
} from "lucide-react";
import { useWebSocket } from "../../lib/useWebSocket";

interface Candidate {
  id: string;
  name: string;
  email: string;
  status: "applied" | "attempted" | "evaluated";
  score: number | null;
  evaluatedAt: string | null;
}

interface DashboardProps {
  initialCandidates: Candidate[];
}

export function Dashboard({ initialCandidates }: DashboardProps) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Real-time update listener
  useWebSocket((msg) => {
    if (msg.type === "SCORE_READY") {
      const payload = msg.payload;
      setCandidates((prev) => 
        prev.map((c) => 
          // Match by submissionId is tricky as candidates list returns candidateId.
          // In a real app we'd map submissionId to candidateId. 
          // For now, let's assume candidates in the list might update.
          // Ideally the WS event should contain candidateId.
          // Let's check our local candidates and find the one that matches email/id if possible.
          c.id === payload.candidateId || c.email === payload.email
            ? { ...c, status: "evaluated", score: payload.score, evaluatedAt: payload.evaluatedAt }
            : c
        )
      );
    }
  });

  const stats = useMemo(() => {
    const applied = candidates.length;
    const attempted = candidates.filter(c => c.status === "attempted" || c.status === "evaluated").length;
    const evaluated = candidates.filter(c => c.status === "evaluated").length;
    return { applied, attempted, evaluated };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const matchesFilter = filter === "all" || c.status === filter;
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                           c.email.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [candidates, filter, search]);

  return (
    <div className="dashboard-container p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Talent Pipeline</h1>
          <p className="text-gray-400 mt-1">Real-time candidate evaluation overview</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
          <Activity size={16} className="text-indigo-400 animate-pulse" />
          <span className="text-sm font-medium text-indigo-200">Live Updates Active</span>
        </div>
      </div>

      {/* Funnel Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Users size={24} className="text-blue-400" />} 
          label="Total Applied" 
          value={stats.applied} 
          color="blue"
        />
        <StatCard 
          icon={<Clock size={24} className="text-amber-400" />} 
          label="Test Attempted" 
          value={stats.attempted} 
          color="amber"
        />
        <StatCard 
          icon={<CheckCircle size={24} className="text-green-400" />} 
          label="Evaluated" 
          value={stats.evaluated} 
          color="green"
        />
      </div>

      {/* Main Content Card */}
      <div className="bg-[#161b27] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02]">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 mr-2" />
            {(["all", "applied", "attempted", "evaluated"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  filter === s 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Candidate</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Evaluation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredCandidates.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/10">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors uppercase">{c.name}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {c.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    {c.status === "evaluated" ? (
                      <div className="inline-flex flex-col items-end">
                        <div className="flex items-center gap-2 text-indigo-300 font-bold">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          <span className="text-xl">{(c.score || 0)}</span>
                          <span className="text-xs text-gray-500 font-normal">pts</span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-medium">
                          Evaluated {new Date(c.evaluatedAt!).toLocaleDateString()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-600 italic text-sm">Pending evaluation</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCandidates.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="text-lg font-medium">No candidates found</p>
                    <p className="text-sm">Try adjusting your filters or search term</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/20 bg-blue-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    green: "border-green-500/20 bg-green-500/5",
  };

  return (
    <div className={`p-6 border rounded-2xl shadow-sm ${colorMap[color]} group hover:border-white/20 transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-xl bg-white/5">{icon}</div>
        <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-white/40 transition-colors" />
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm font-medium text-gray-400">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Candidate["status"] }) {
  const styles = {
    applied: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    attempted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    evaluated: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
}
