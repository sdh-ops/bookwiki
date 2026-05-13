"use client";

import { useState } from "react";

export default function AIHubProjectForm({ onStart }) {
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    genre: "thriller",
    slideCount: "4",
    tone: "emotional",
    snsPlatform: "instagram",
    targetAudience: "",
  });
  const [file, setFile] = useState(null);
  const [cover, setCover] = useState(null);
  const [references, setReferences] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleCoverChange = (e) => {
    setCover(e.target.files[0]);
  };

  const handleReferencesChange = (e) => {
    setReferences(Array.from(e.target.files));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onStart) {
      onStart({
        ...formData,
        file,
        cover,
        references
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden max-w-5xl mx-auto my-10 font-pretendard">
      <div className="bg-[#131316] p-10 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-4xl font-black mb-3 tracking-tight">BOOKFLOW <span className="text-[#CF5C3F]">v3.0</span></h2>
          <p className="text-gray-400 text-lg">원고 분석부터 3종 기획안 제안, 무결점 제작까지 한 번에.</p>
        </div>
        {/* Accent DNA Decor */}
        <div className="absolute top-0 right-0 w-32 h-full flex">
          <div className="w-1/3 bg-[#00A89E] opacity-20"></div>
          <div className="w-1/3 bg-[#FFD700] opacity-20"></div>
          <div className="w-1/3 bg-[#800080] opacity-20"></div>
        </div>
      </div>

      <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Side: Planning Config */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 bg-[#CF5C3F] text-white rounded-full flex items-center justify-center text-sm">1</span>
              기본 정보 및 타겟 설정
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">도서 제목</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="제목 입력"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#CF5C3F] outline-none transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">저자</label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleChange}
                  placeholder="저자명 입력"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#CF5C3F] outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">타겟 독자 (Trend Analysis)</label>
              <input
                type="text"
                name="targetAudience"
                value={formData.targetAudience}
                onChange={handleChange}
                placeholder="예: 20대 여성, 스릴러 매니아, 직장인 등"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#CF5C3F] outline-none transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">SNS 플랫폼</label>
                <select
                  name="snsPlatform"
                  value={formData.snsPlatform}
                  onChange={handleChange}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#CF5C3F] outline-none transition-all font-bold text-gray-700"
                >
                  <option value="instagram">인스타그램 (4:5)</option>
                  <option value="threads">스레드 (Text-Heavy)</option>
                  <option value="youtube">유튜브 커뮤니티 (1:1)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2 ml-1">제작 장수</label>
                <select
                  name="slideCount"
                  value={formData.slideCount}
                  onChange={handleChange}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#CF5C3F] outline-none transition-all font-bold text-gray-700"
                >
                  <option value="4">4장 (심플형)</option>
                  <option value="6">6장 (표준형)</option>
                  <option value="9">9장 (심층형/풀스토리)</option>
                </select>
              </div>
            </div>

            <div className="pt-4">
              <label className="block text-sm font-bold text-gray-500 mb-4 ml-1 flex justify-between items-center">
                <span>기획 컨셉 선택 (3가지 선택)</span>
                <span className="text-[10px] text-[#CF5C3F] bg-orange-50 px-2 py-1 rounded-full uppercase">Diversity Config</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'hook', label: '질문/후킹', icon: '❓' },
                  { id: 'info', label: '정보/요약', icon: '💡' },
                  { id: 'mbti', label: 'MBTI/타겟', icon: '👤' },
                  { id: 'minimal', label: '미니멀/인용', icon: '✨' },
                  { id: 'story', label: '스토리텔링', icon: '📖' },
                  { id: 'checklist', label: '체크리스트', icon: '✅' }
                ].map((concept) => (
                  <button
                    key={concept.id}
                    type="button"
                    onClick={() => {
                      const current = formData.concepts || ['hook', 'info', 'mbti'];
                      let next;
                      if (current.includes(concept.id)) {
                        next = current.filter(c => c !== concept.id);
                      } else if (current.length < 3) {
                        next = [...current, concept.id];
                      } else {
                        next = [...current.slice(1), concept.id];
                      }
                      setFormData(prev => ({ ...prev, concepts: next }));
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                      (formData.concepts || ['hook', 'info', 'mbti']).includes(concept.id)
                      ? 'border-[#CF5C3F] bg-orange-50 text-[#CF5C3F]'
                      : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xl mb-1">{concept.icon}</span>
                    <span className="text-[10px] font-black">{concept.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Asset Upload */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="w-8 h-8 bg-[#CF5C3F] text-white rounded-full flex items-center justify-center text-sm">2</span>
              원고 및 이미지 에셋
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-500 ml-1">도서 표지</label>
                <div className="relative h-40 group cursor-pointer">
                  <input type="file" onChange={handleCoverChange} accept="image/*" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                  <div className="h-full border-2 border-dashed border-gray-200 group-hover:border-[#CF5C3F] rounded-2xl flex flex-col items-center justify-center bg-gray-50 transition-all">
                    <span className="text-3xl mb-1">🖼️</span>
                    <span className="text-xs text-gray-400 font-bold">{cover ? cover.name : "표지 업로드"}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-500 ml-1">참고 이미지 (다중)</label>
                <div className="relative h-40 group cursor-pointer">
                  <input type="file" onChange={handleReferencesChange} multiple accept="image/*" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                  <div className="h-full border-2 border-dashed border-gray-200 group-hover:border-[#CF5C3F] rounded-2xl flex flex-col items-center justify-center bg-gray-50 transition-all">
                    <span className="text-3xl mb-1">📸</span>
                    <span className="text-xs text-gray-400 font-bold">
                      {references.length > 0 ? `${references.length}개 선택됨` : "에셋 업로드"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-500 ml-1">원고 파일 (PDF / docx)</label>
              <div className="relative group cursor-pointer">
                <input type="file" onChange={handleFileChange} accept=".pdf,.docx,.txt" className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer" />
                <div className="border-2 border-dashed border-gray-200 group-hover:border-[#CF5C3F] rounded-2xl p-10 text-center bg-gray-50 transition-all">
                  <span className="text-4xl block mb-2">📄</span>
                  <p className="text-sm font-bold text-gray-600">{file ? file.name : "분석할 원고를 드래그하세요"}</p>
                  <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Secure Memory-Only Processing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-10 bg-gray-50 border-t border-gray-100 flex flex-col items-center gap-6">
        <button type="submit" className="w-full max-w-md py-6 bg-[#CF5C3F] text-white rounded-2xl font-black text-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all">
          원고 분석 및 기획안 생성
        </button>
        <div className="flex items-center gap-6 text-xs font-bold text-gray-400">
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span> KIMI 2.6 Deep Analysis</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> CLAUDE 4.7 Strategic Planning</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full"></span> PUPPETEER Pixel Engine</div>
        </div>
      </div>
    </form>
  );
}
