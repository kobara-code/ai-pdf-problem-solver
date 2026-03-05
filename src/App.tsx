import { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  BookMarked, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  Bookmark, 
  BookmarkCheck,
  Loader2,
  History,
  Upload,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { Problem, ProblemSet } from "./types";
import { parseProblemsFromPDF } from "./services/geminiService";
import Markdown from "react-markdown";

export default function App() {
  const [sets, setSets] = useState<ProblemSet[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [view, setView] = useState<"home" | "solving" | "bookmarks">("home");
  const [showExplanation, setShowExplanation] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSets();
  }, []);

  const fetchSets = async () => {
    const res = await fetch("/api/sets");
    const data = await res.json();
    setSets(data);
  };

  const fetchProblems = async (setId: string) => {
    const res = await fetch(`/api/sets/${setId}/problems`);
    const data = await res.json();
    setProblems(data);
    setCurrentSetId(setId);
    setCurrentIndex(0);
    setShowExplanation(false);
    setView("solving");
  };

  const fetchBookmarks = async () => {
    const res = await fetch("/api/bookmarks");
    const data = await res.json();
    setProblems(data);
    setCurrentSetId(null);
    setCurrentIndex(0);
    setShowExplanation(false);
    setView("bookmarks");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await parseProblemsFromPDF(base64, file.type);
        
        const setId = crypto.randomUUID();
        await fetch("/api/sets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: setId,
            title: result.title || file.name.replace(".pdf", ""),
            problems: result.problems
          })
        });

        await fetchSets();
        await fetchProblems(setId);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("문제를 파싱하는 데 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleBookmark = async (problemId: string, currentStatus: boolean) => {
    await fetch(`/api/problems/${problemId}/bookmark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_bookmarked: !currentStatus })
    });
    
    setProblems(prev => prev.map(p => 
      p.id === problemId ? { ...p, is_bookmarked: !currentStatus } : p
    ));
  };

  const handleAnswer = (answer: string) => {
    const problem = problems[currentIndex];
    setUserAnswers(prev => ({ ...prev, [problem.id]: answer }));
    setShowExplanation(true);
  };

  const deleteSet = async (e: React.MouseEvent, setId: string) => {
    e.stopPropagation();
    if (!confirm("정말로 이 문제집을 삭제하시겠습니까?")) return;
    
    await fetch(`/api/sets/${setId}`, { method: "DELETE" });
    await fetchSets();
    if (currentSetId === setId) {
      setView("home");
      setCurrentSetId(null);
    }
  };

  const currentProblem = problems[currentIndex];
  const isCorrect = currentProblem && userAnswers[currentProblem.id] === currentProblem.answer;

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-[#212529] font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-[#E9ECEF] flex flex-col">
        <div className="p-6 border-b border-[#E9ECEF]">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-blue-600" />
            AI 문제집
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              새 문제집 업로드
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="application/pdf" 
              className="hidden" 
            />
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => { setView("home"); setCurrentSetId(null); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                view === "home" ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-gray-50 text-gray-600"
              )}
            >
              <History className="w-5 h-5" />
              홈 / 최근 학습
            </button>
            <button 
              onClick={fetchBookmarks}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                view === "bookmarks" ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-gray-50 text-gray-600"
              )}
            >
              <Bookmark className="w-5 h-5" />
              북마크된 문제
            </button>
          </nav>

          <div className="pt-4 border-t border-[#E9ECEF]">
            <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">내 문제집</p>
            <div className="space-y-1">
              {sets.map(set => (
                <button 
                  key={set.id}
                  onClick={() => fetchProblems(set.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group",
                    currentSetId === set.id ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-gray-50 text-gray-600"
                  )}
                >
                  <FileText className="w-5 h-5 opacity-70" />
                  <span className="truncate flex-1">{set.title}</span>
                  <button 
                    onClick={(e) => deleteSet(e, set.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-[#E9ECEF] flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            {view !== "home" && (
              <button 
                onClick={() => setView("home")}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <h2 className="text-lg font-semibold">
              {view === "home" && "대시보드"}
              {view === "solving" && (sets.find(s => s.id === currentSetId)?.title || "문제 풀이")}
              {view === "bookmarks" && "북마크된 문제"}
            </h2>
          </div>
          
          {view !== "home" && problems.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-500">
                {currentIndex + 1} / {problems.length}
              </span>
              <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300" 
                  style={{ width: `${((currentIndex + 1) / problems.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {view === "home" ? (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-10 text-white shadow-xl">
                  <h3 className="text-3xl font-bold mb-4">공부를 시작해볼까요?</h3>
                  <p className="text-blue-100 text-lg mb-8 max-w-md">
                    PDF 문제집을 업로드하면 AI가 자동으로 문제를 추출하여 인터랙티브한 퀴즈로 만들어줍니다.
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white text-blue-700 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    PDF 업로드하기
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-[#E9ECEF] shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-lg">최근 문제집</h4>
                      <button onClick={() => setView("home")} className="text-blue-600 text-sm font-semibold">전체보기</button>
                    </div>
                    <div className="space-y-3">
                      {sets.slice(0, 3).map(set => (
                        <div 
                          key={set.id}
                          onClick={() => fetchProblems(set.id)}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <span className="font-medium">{set.title}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      ))}
                      {sets.length === 0 && (
                        <p className="text-center py-8 text-gray-400 italic">아직 업로드된 문제집이 없습니다.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-[#E9ECEF] shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-lg">북마크 통계</h4>
                      <Bookmark className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="text-5xl font-black text-blue-600 mb-2">
                        {problems.filter(p => p.is_bookmarked).length}
                      </div>
                      <p className="text-gray-500 font-medium">저장된 문제</p>
                      <button 
                        onClick={fetchBookmarks}
                        className="mt-6 text-blue-600 font-bold hover:underline"
                      >
                        지금 복습하기 →
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : problems.length > 0 ? (
              <motion.div 
                key="solving"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-3xl mx-auto"
              >
                <div className="bg-white rounded-3xl border border-[#E9ECEF] shadow-lg overflow-hidden">
                  <div className="p-8 border-b border-[#E9ECEF] flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider">
                          Question {currentIndex + 1}
                        </span>
                      </div>
                      <div className="text-xl font-medium leading-relaxed prose prose-slate max-w-none">
                        <Markdown>{currentProblem.question}</Markdown>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleBookmark(currentProblem.id, !!currentProblem.is_bookmarked)}
                      className={cn(
                        "p-3 rounded-2xl transition-all",
                        currentProblem.is_bookmarked ? "bg-yellow-50 text-yellow-500" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      )}
                    >
                      {currentProblem.is_bookmarked ? <BookmarkCheck className="w-6 h-6 fill-current" /> : <Bookmark className="w-6 h-6" />}
                    </button>
                  </div>

                  <div className="p-8 space-y-4">
                    {currentProblem.options && currentProblem.options.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {currentProblem.options.map((option, idx) => {
                          const isSelected = userAnswers[currentProblem.id] === option;
                          const isCorrectOption = option === currentProblem.answer;
                          const showResult = showExplanation;

                          return (
                            <button
                              key={idx}
                              disabled={showExplanation}
                              onClick={() => handleAnswer(option)}
                              className={cn(
                                "flex items-center justify-between p-5 rounded-2xl border-2 transition-all text-left group",
                                !showResult && isSelected && "border-blue-600 bg-blue-50",
                                !showResult && !isSelected && "border-[#E9ECEF] hover:border-gray-300 hover:bg-gray-50",
                                showResult && isCorrectOption && "border-green-500 bg-green-50 text-green-700",
                                showResult && isSelected && !isCorrectOption && "border-red-500 bg-red-50 text-red-700",
                                showResult && !isSelected && !isCorrectOption && "border-[#E9ECEF] opacity-50"
                              )}
                            >
                              <span className="font-medium">{option}</span>
                              {showResult && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                              {showResult && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-red-500" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <textarea 
                          disabled={showExplanation}
                          placeholder="정답을 입력하세요..."
                          className="w-full p-5 rounded-2xl border-2 border-[#E9ECEF] focus:border-blue-600 focus:ring-0 transition-all min-h-[120px] resize-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAnswer(e.currentTarget.value);
                            }
                          }}
                        />
                        <button 
                          disabled={showExplanation}
                          onClick={() => {
                            const input = document.querySelector('textarea') as HTMLTextAreaElement;
                            handleAnswer(input.value);
                          }}
                          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          정답 제출하기
                        </button>
                      </div>
                    )}

                    <AnimatePresence>
                      {showExplanation && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-8 p-6 bg-gray-50 rounded-2xl border border-[#E9ECEF]"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            {isCorrect ? (
                              <div className="flex items-center gap-2 text-green-600 font-bold">
                                <CheckCircle2 className="w-5 h-5" />
                                정답입니다!
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-red-600 font-bold">
                                <XCircle className="w-5 h-5" />
                                틀렸습니다. 정답은: {currentProblem.answer}
                              </div>
                            )}
                          </div>
                          <div className="prose prose-slate prose-sm max-w-none text-gray-600">
                            <Markdown>{currentProblem.explanation}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="p-6 bg-gray-50 border-t border-[#E9ECEF] flex justify-between items-center">
                    <button 
                      onClick={() => {
                        setCurrentIndex(prev => Math.max(0, prev - 1));
                        setShowExplanation(!!userAnswers[problems[currentIndex - 1]?.id]);
                      }}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-2 px-6 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-30"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      이전
                    </button>
                    <button 
                      onClick={() => {
                        if (currentIndex < problems.length - 1) {
                          setCurrentIndex(prev => prev + 1);
                          setShowExplanation(!!userAnswers[problems[currentIndex + 1]?.id]);
                        } else {
                          setView("home");
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-2 bg-white border border-[#E9ECEF] rounded-xl font-bold text-gray-800 hover:bg-gray-100 transition-colors shadow-sm"
                    >
                      {currentIndex === problems.length - 1 ? "학습 완료" : "다음 문제"}
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-xl font-medium">문제가 없습니다.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

