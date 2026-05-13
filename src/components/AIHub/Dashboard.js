"use client";

import { useState } from "react";
import ProjectForm from "./ProjectForm";

export default function AIHubDashboard() {
  const [step, setStep] = useState("ingestion"); // ingestion, analysis, selection, production
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [renderedImages, setRenderedImages] = useState([]);
  const [isRendering, setIsRendering] = useState(false);

  // Real function to call AI analysis API
  const handleStartAnalysis = async (data) => {
    setStep("analysis");
    
    try {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("title", data.title);
      formData.append("author", data.author);
      formData.append("targetAudience", data.targetAudience);
      formData.append("slideCount", data.slideCount);
      formData.append("snsPlatform", data.snsPlatform);
      if (data.cover) formData.append("cover", data.cover);
      if (data.concepts) formData.append("concepts", JSON.stringify(data.concepts));

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setPlans(result.plans);
        setAnalysisData(result.analysis);
        setStep("selection");
      } else {
        alert("분석 중 오류가 발생했습니다: " + result.error);
        setStep("ingestion");
      }
    } catch (error) {
      console.error("Analysis Error:", error);
      alert("서버와의 통신 중 오류가 발생했습니다.");
      setStep("ingestion");
    }
  };

  // Function to call Rendering API (Supports Full or Partial)
  const handleRender = async (planOverride = null, slideIndex = undefined) => {
    if (slideIndex === undefined) setStep("production");
    setIsRendering(true);
    
    try {
      const response = await fetch("/api/ai/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planOverride || selectedPlan,
          analysis: analysisData,
          slideIndex: slideIndex // Pass only if partial render
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        if (slideIndex !== undefined) {
          // PARTIAL: Replace only the specific slide image
          const newImages = [...renderedImages];
          newImages[slideIndex] = result.images[0];
          setRenderedImages(newImages);
        } else {
          // FULL: Replace all images
          setRenderedImages(result.images);
        }
      } else {
        alert("렌더링 중 오류가 발생했습니다: " + result.error);
        if (slideIndex === undefined) setStep("selection");
      }
    } catch (error) {
      console.error("Render Error:", error);
      alert("서버와의 통신 중 오류가 발생했습니다.");
    } finally {
      setIsRendering(false);
    }
  };

  // NEW: Handle per-slide background replacement
  const handleBackgroundChange = async (slideIdx, file) => {
    const formData = new FormData();
    formData.append("file", file);
    
    setIsRendering(true);
    try {
      // 1. Upload new background via Dedicated API
      const uploadRes = await fetch("/api/ai/upload", { 
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      
      if (uploadData.success && uploadData.url) {
        // 2. Update the plan with new background URL
        const updatedPlan = { ...selectedPlan };
        updatedPlan.slides[slideIdx].customBgUrl = uploadData.url;
        setSelectedPlan(updatedPlan);
        
        // 3. Re-render ONLY this slide
        await handleRender(updatedPlan, slideIdx);
      } else {
        alert("배경 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("Background Change Error:", error);
      alert("배경 교체 중 오류가 발생했습니다.");
    } finally {
      setIsRendering(false);
    }
  };

  // NEW: Handle per-slide text editing
  const handleTextChange = async (slideIdx, newText) => {
    if (!selectedPlan) return;
    
    // 1. Update the local plan state
    const updatedPlan = { ...selectedPlan };
    updatedPlan.slides[slideIdx].text = newText;
    setSelectedPlan(updatedPlan);
    
    // 2. Re-render ONLY this slide
    await handleRender(updatedPlan, slideIdx);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 py-6 px-10 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#CF5C3F] rounded-xl flex items-center justify-center text-white font-black text-xl">B</div>
          <h1 className="text-xl font-bold text-gray-800">BOOKFLOW <span className="text-gray-400 font-medium ml-2">Pro v3.1</span></h1>
        </div>
        <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Editing Mode</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10">
        {/* Progress Bar */}
        <div className="flex justify-between items-center mb-12 max-w-3xl mx-auto">
            {['ingestion', 'selection', 'production'].map((s, i) => (
                <div key={s} className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                        step === s || (step === 'analysis' && s === 'ingestion') 
                        ? 'bg-[#CF5C3F] text-white shadow-lg shadow-orange-200' 
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                        {i + 1}
                    </div>
                    <span className={`text-xs font-bold ${step === s ? 'text-[#CF5C3F]' : 'text-gray-400'}`}>
                        {s === 'ingestion' ? '원고 업로드' : s === 'selection' ? '기획안 선택' : '최종 제작'}
                    </span>
                </div>
            ))}
        </div>

        {step === "ingestion" && (
          <ProjectForm onStart={handleStartAnalysis} />
        )}

        {step === "analysis" && (
          <div className="flex flex-col items-center justify-center py-40 animate-pulse">
            <div className="w-20 h-20 border-4 border-[#CF5C3F] border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">원고 심층 분석 중...</h2>
            <p className="text-gray-500">Kimi 2.6이 최적의 폰트와 레이아웃을 설계하고 있습니다.</p>
          </div>
        )}

        {step === "selection" && (
          <div className="space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-black text-gray-900 mb-2">분석 완료! 마케팅 컨셉을 선택하세요</h2>
              <p className="text-gray-500">Kimi 2.6이 설계한 픽셀 단위의 정밀 디자인이 포함되어 있습니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div 
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`group cursor-pointer rounded-3xl p-8 border-2 transition-all hover:-translate-y-2 ${
                    selectedPlan?.id === plan.id 
                    ? 'border-[#CF5C3F] bg-white shadow-2xl shadow-orange-100' 
                    : 'border-gray-100 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="h-48 bg-gray-900 rounded-2xl mb-6 flex items-center justify-center overflow-hidden relative">
                    <span className="text-white text-lg font-bold z-10 px-4 text-center">{plan.previewText}</span>
                    <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-orange-500 to-purple-600"></div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{plan.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">{plan.strategy}</p>
                  
                  <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Slide Detail</p>
                    {plan.slides?.map((slide, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <span className="text-[10px] font-bold text-[#CF5C3F] bg-orange-50 px-1.5 py-0.5 rounded min-w-[20px] text-center">{idx + 1}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-700 leading-tight">{slide.text}</p>
                          <p className="text-[9px] text-gray-400 font-medium mt-0.5 italic">{slide.fontSizePx}px / Weight {slide.fontWeight}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {plan.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-1 rounded-md">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center pt-10">
              <button 
                disabled={!selectedPlan}
                onClick={() => handleRender()}
                className={`px-16 py-6 rounded-2xl font-black text-2xl transition-all ${
                  selectedPlan 
                  ? 'bg-[#CF5C3F] text-white shadow-xl hover:shadow-2xl active:scale-95' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                선택한 기획안으로 제작하기
              </button>
            </div>
          </div>
        )}

        {step === "production" && (
            <div className="max-w-4xl mx-auto space-y-10">
                 <div className="text-center">
                    <h2 className="text-3xl font-black text-gray-900 mb-2">
                      {isRendering ? '카드뉴스 생성 중...' : '카드뉴스 제작 완료'}
                    </h2>
                    <p className="text-gray-500">
                      {isRendering ? 'AI가 픽셀 단위로 정밀하게 렌더링하고 있습니다.' : '배경이 마음에 안 드시면 각 슬라이드에서 직접 교체할 수 있습니다.'}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {isRendering ? (
                    [1,2,3,4].map(i => (
                      <div key={i} className="aspect-[4/5] bg-gray-100 rounded-3xl animate-pulse flex items-center justify-center">
                        <span className="text-gray-300 font-bold">Rendering...</span>
                      </div>
                    ))
                  ) : (
                    renderedImages.map((img, idx) => (
                      <div key={idx} className="group relative aspect-[4/5] bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                        <img src={img} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                        
                        {/* Edit Overlay (Visible on Hover) */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 z-20 backdrop-blur-sm">
                            <button
                              onClick={() => {
                                const newText = prompt("슬라이드 문구를 수정하세요:", selectedPlan.slides[idx].text);
                                if (newText) handleTextChange(idx, newText);
                              }}
                              className="w-full max-w-[180px] bg-white text-gray-900 py-3 rounded-2xl text-sm font-bold hover:bg-gray-100 transition-all shadow-xl flex items-center justify-center gap-2"
                            >
                              <span>✍️</span> 문구 수정
                            </button>

                            <button
                              onClick={() => {
                                const currentPrompt = selectedPlan.slides[idx].imagePrompt || "";
                                const newPrompt = prompt("이미지 검색 키워드를 수정하세요 (영문 권장):", currentPrompt);
                                if (newPrompt) {
                                  const updatedPlan = { ...selectedPlan };
                                  updatedPlan.slides[idx].imagePrompt = newPrompt;
                                  updatedPlan.slides[idx].bgType = "image"; // Force image mode
                                  setSelectedPlan(updatedPlan);
                                  handleRender(updatedPlan, idx);
                                }
                              }}
                              className="w-full max-w-[180px] bg-white/20 text-white py-3 rounded-2xl text-sm font-bold hover:bg-white/30 transition-all shadow-xl flex items-center justify-center gap-2 border border-white/30 backdrop-blur-md"
                            >
                              <span>🔍</span> 키워드 수정
                            </button>

                            <label className="w-full max-w-[180px] bg-[#CF5C3F] text-white py-3 rounded-2xl text-sm font-bold cursor-pointer hover:bg-orange-600 transition-all shadow-xl flex items-center justify-center gap-2">
                                <span>🖼️</span> 직접 업로드
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={(e) => e.target.files[0] && handleBackgroundChange(idx, e.target.files[0])}
                                />
                            </label>
                        </div>
                        
                        {/* Slide Number Tag */}
                        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full z-10 border border-white/10">
                          SLIDE 0{idx + 1}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {!isRendering && (
                  <div className="flex justify-center gap-4">
                      <button onClick={() => setStep("selection")} className="px-10 py-5 bg-white border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all">
                          기획안 다시 선택
                      </button>
                      <button className="px-16 py-5 bg-[#131316] text-white rounded-2xl font-black text-xl shadow-xl hover:bg-black transition-all flex items-center gap-3">
                          <span className="text-2xl">📥</span>
                          전체 슬라이드 다운로드
                      </button>
                  </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
