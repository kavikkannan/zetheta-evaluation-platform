"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  ArrowRight,
  LogOut,
  BarChart3,
  ExternalLink
} from "lucide-react";
import { useWebSocket, WSMessage } from "../../lib/useWebSocket";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface Candidate {
  id: string;
  name: string;
  email: string;
  status: "applied" | "attempted" | "evaluated";
  score: number | null;
  maxScore?: number | null;
  evaluatedAt: string | null;
}

interface QuestionResult {
  sequence: number;
  questionText: string;
  options: Array<{ label: string; text: string }>;
  candidateAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

interface DetailedResults {
  candidateName: string;
  candidateEmail: string;
  score: number;
  maxScore: number;
  percentage: number;
  evaluatedAt: string;
  questions: QuestionResult[];
}

interface DashboardProps {
  initialCandidates: Candidate[];
}

export function Dashboard({ initialCandidates }: DashboardProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedResults, setSelectedResults] = useState<DetailedResults | null>(null);
  const [loadingResults, setLoadingResults] = useState<string | null>(null);

  // Real-time update listener
  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === "SCORE_READY") {
      const payload = msg.payload;
      setCandidates((prev) => 
        prev.map((c) => 
          c.id === payload.candidateId || c.email === payload.email
            ? { ...c, status: "evaluated", score: payload.score, maxScore: payload.maxScore, evaluatedAt: payload.evaluatedAt }
            : c
        )
      );
    }
  }, []);

  const eToken = Cookies.get("e_session");
  useWebSocket(handleWSMessage, eToken);

  const handleLogout = () => {
    Cookies.remove("e_session");
    router.replace("/login");
  };

  const fetchResults = async (candidateId: string) => {
    setLoadingResults(candidateId);
    try {
      const resp = await fetch(`http://127.0.0.1:3001/v1/dashboard/candidates/${candidateId}/results`, {
        headers: {
          'Authorization': `Bearer ${Cookies.get('e_session')}`
        }
      });
      const json = await resp.json();
      if (json.status === "success") {
        setSelectedResults(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch results", err);
    } finally {
      setLoadingResults(null);
    }
  };

  const stats = useMemo(() => {
    const applied = candidates.length;
    const attempted = candidates.filter(c => c.status === "attempted" || c.status === "evaluated").length;
    const evaluated = candidates.filter(c => c.status === "evaluated").length;
    
    // Calculate Average Percentage
    const evaluatedCandidates = candidates.filter(c => c.status === "evaluated" && c.score !== null && c.maxScore);
    const avgPercentage = evaluatedCandidates.length > 0
      ? Math.round(evaluatedCandidates.reduce((acc, c) => acc + ((c.score! / (c.maxScore || 1)) * 100), 0) / evaluatedCandidates.length)
      : 0;

    return { applied, attempted, evaluated, avgPercentage };
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
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Talent Pipeline</h1>
          <p className="text-gray-400 mt-1">Real-time candidate evaluation overview</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <Activity size={16} className="text-indigo-400 animate-pulse" />
            <span className="text-sm font-medium text-indigo-200">Live Updates Active</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all font-medium text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Funnel Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
        <StatCard 
          icon={<BarChart3 size={24} className="text-purple-400" />} 
          label="Avg. Score %" 
          value={`${stats.avgPercentage}%`} 
          color="purple"
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
                <th className="px-6 py-4 text-right">Actions</th>
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
                          Evaluated {new Date(c.evaluatedAt!).toISOString().split('T')[0]}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-600 italic text-sm">Pending evaluation</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {c.status === "evaluated" && (
                      <button 
                        onClick={() => fetchResults(c.id)}
                        disabled={loadingResults === c.id}
                        className="p-2 border border-white/10 rounded-lg hover:border-indigo-500/50 hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-all"
                      >
                        {loadingResults === c.id ? (
                          <Activity size={18} className="animate-spin" />
                        ) : (
                          <ExternalLink size={18} />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCandidates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-gray-500">
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

      {/* Premium Results Sidebar */}
      {selectedResults && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300">
          {/* Backdrop click-to-close */}
          <div className="absolute inset-0" onClick={() => setSelectedResults(null)} />
          
          <div className="relative w-full max-w-2xl bg-[#161b27] h-full shadow-2xl border-l border-white/10 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-[10px]">Evaluation Report</span>
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">{selectedResults.candidateName}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Mail size={14} />
                  <span>{selectedResults.candidateEmail}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedResults(null)}
                className="group p-3 bg-white/5 hover:bg-red-500/20 rounded-2xl text-gray-400 hover:text-red-400 transition-all border border-white/5 hover:border-red-500/30"
                title="Close Sidebar"
              >
                <LogOut size={20} className="rotate-180" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10 pb-20">
              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-6">
                <MetricBox label="Final Score" value={`${selectedResults.score} / ${selectedResults.maxScore}`} subValue="Points Awarded" color="indigo" />
                <MetricBox label="Percentage" value={`${selectedResults.percentage}%`} subValue="Accuracy Rate" color="purple" />
                <MetricBox label="Correctness" value={selectedResults.questions.filter(q => q.isCorrect).length} subValue="Correct Answers" color="green" />
              </div>

              {/* Detailed Question List */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Question Breakdown</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {selectedResults.questions.map((q) => (
                  <div key={q.sequence} className="relative group">
                    {/* Status vertical line */}
                    <div className={`absolute -left-4 top-0 bottom-0 w-1 rounded-full ${q.isCorrect ? 'bg-green-500/50' : 'bg-red-500/50'}`} />
                    
                    <div className={`p-6 rounded-3xl border transition-all ${q.isCorrect ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                           <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-bold text-gray-400">
                            {q.sequence}
                           </span>
                           <h4 className="font-bold text-gray-100 leading-relaxed text-lg">{q.questionText}</h4>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${q.isCorrect ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                          {q.isCorrect ? 'Correct Answer' : 'Incorrect Choice'}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3 ml-12">
                        {(q.options || []).map((opt) => {
                          const isChosen = q.candidateAnswer === opt.label;
                          const isCorrect = q.correctAnswer === opt.label;
                          
                          let cardStyle = "bg-white/[0.03] border-white/5 text-gray-400";
                          let labelStyle = "bg-white/10 text-gray-400";
                          
                          if (isCorrect) {
                            cardStyle = "bg-green-500/10 border-green-500/30 text-green-300 ring-1 ring-green-500/20";
                            labelStyle = "bg-green-500/30 text-white";
                          } else if (isChosen) {
                            cardStyle = "bg-red-500/10 border-red-500/30 text-red-300 ring-1 ring-red-500/20";
                            labelStyle = "bg-red-500/30 text-white";
                          }

                          return (
                            <div key={opt.label} className={`group/opt flex items-center gap-4 p-4 rounded-2xl border text-sm transition-all duration-300 ${cardStyle}`}>
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border border-white/10 transition-colors ${labelStyle}`}>
                                {opt.label}
                              </span>
                              <span className="flex-1 font-medium">{opt.text}</span>
                              
                              {isCorrect && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-lg border border-green-500/20">
                                  <CheckCircle size={14} className="text-green-400" />
                                  <span className="text-[10px] font-bold uppercase text-green-400">Correct Answer</span>
                                </div>
                              )}
                              {isChosen && !isCorrect && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-lg border border-red-500/20">
                                  <Clock size={14} className="text-red-400" />
                                  <span className="text-[10px] font-bold uppercase text-red-400">Candidate Choice</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer shadow area to ensure content doesn't get clipped by potential mobile UI */}
            <div className="h-4 bg-gradient-to-t from-[#161b27] to-transparent sticky bottom-0 pointer-events-none" />
          </div>
        </div>
      )}
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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string | number, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/20 bg-blue-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    green: "border-green-500/20 bg-green-500/5",
    purple: "border-purple-500/20 bg-purple-500/5",
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

function MetricBox({ label, value, subValue, color }: { label: string, value: string | number, subValue: string, color: string }) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
  };

  return (
    <div className={`p-5 rounded-3xl border ${colorMap[color]} shadow-sm`}>
      <div className="text-sm font-bold opacity-60 uppercase tracking-tighter mb-1">{label}</div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
      <div className="text-xs opacity-50 font-medium mt-1">{subValue}</div>
    </div>
  );
}

