"use client";

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

/**
 * High-Visibility Adaptive Slide Renderer (v3.9)
 * Optimized Layering, Brightness Boost, and Partial Update Ready.
 */
function SlideRenderer() {
  const searchParams = useSearchParams();
  const [imageError, setImageError] = useState(false);
  
  const text = searchParams.get('text') || "";
  const mainColor = searchParams.get('mainColor') || "#CF5C3F";
  const bgColor = searchParams.get('bgColor') || "#131316";
  const imagePrompt = searchParams.get('imagePrompt') || "abstract";
  const visualTheme = searchParams.get('visualTheme') || "noir";
  const bgType = searchParams.get('bgType') || "image";
  const coverUrl = searchParams.get('coverUrl');
  const layout = searchParams.get('layout') || "center";
  const fontSizePx = searchParams.get('fontSizePx') || "90";
  const fontWeight = searchParams.get('fontWeight') || "900";
  const fontFamily = searchParams.get('fontFamily') || "Pretendard";
  const coverLayout = searchParams.get('coverLayout') || "center";
  const customBgUrl = searchParams.get('customBgUrl');
  const bgStyle = searchParams.get('bgStyle'); 

  // AI-Designed Styles (JSON)
  const parseStyle = (str, fallback = {}) => {
    try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
  };
  const aiTextStyle = parseStyle(searchParams.get('textStyle'));
  const aiCoverStyle = parseStyle(searchParams.get('coverStyle'));

  const query = encodeURIComponent(`${imagePrompt}`.trim());
  const dynamicBgUrl = customBgUrl && customBgUrl !== "undefined" 
    ? customBgUrl 
    : `https://loremflickr.com/1080/1350/${query}/all`;
  
  const fallbackBgUrl = `https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=1080&auto=format&fit=crop`; // High-quality generic library

  return (
    <div 
      id="slide-container"
      style={{
        width: '1080px',
        height: '1350px',
        backgroundColor: bgColor,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: `${fontFamily}, 'Pretendard', sans-serif`,
        color: 'white',
      }}
    >
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Nanum+Myeongjo:wght@400;700;800&family=Song+Myung&family=Gowun+Batang:wght@400;700&display=swap');
        @font-face { font-family: 'Pretendard'; src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css'); }
        * { box-sizing: border-box; }
        header, footer, nav, aside, button, .no-render, [class*="Header"], [class*="Footer"], [id*="issue"], .red-tag { 
          display: none !important; opacity: 0 !important; visibility: hidden !important; 
        }
        body { margin: 0; padding: 0; overflow: hidden; background: #000 !important; }
      `}</style>

      {/* LAYER 1: Background (AI CSS Design or Image) */}
      <div className="absolute inset-0 z-0">
        {bgStyle ? (
          <div style={{ width: '100%', height: '100%', background: bgStyle }}></div>
        ) : bgType === 'image' && !imageError ? (
          <img 
            src={dynamicBgUrl} 
            alt="" 
            className="w-full h-full object-cover"
            style={{ 
              opacity: 1, 
              filter: 'brightness(1.1) contrast(1.1)' 
            }}
            onError={(e) => { 
              if (e.target.src === dynamicBgUrl) e.target.src = fallbackBgUrl;
              else setImageError(true);
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: bgColor }}></div>
        )}
      </div>

      {/* LAYER 2: Premium Grain/Noise Texture */}
      <div 
        className="absolute inset-0 z-[5] pointer-events-none opacity-[0.15] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* LAYER 3: Light Boost Overlay (Refined for visibility) */}
      <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }}>
        <div style={{ 
          width: '100%', height: '100%', 
          background: `
            radial-gradient(circle at 20% 20%, ${mainColor}22 0%, transparent 70%),
            radial-gradient(circle at 80% 80%, ${mainColor}11 0%, transparent 70%),
            linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 100%)
          ` 
        }}></div>
      </div>

      {/* LAYER 3: Book Cover */}
      {coverUrl && (
        <div className="absolute z-20 flex items-center justify-center"
             style={{ 
               width: '520px', 
               height: '760px',
               top: '50%',
               left: '75%',
               transform: 'translate(-50%, -50%)',
               ...aiCoverStyle 
             }}>
          <div className="absolute inset-0 blur-3xl opacity-50 scale-110" 
               style={{ background: `url(${coverUrl}) center/cover no-repeat` }}></div>
          <img src={coverUrl} alt="Cover" className="relative z-10 w-full h-full object-contain shadow-[0_60px_100px_rgba(0,0,0,0.8)] rounded-sm border border-white/5" />
        </div>
      )}

      {/* LAYER 4: Text Content */}
      <div className="absolute z-30" 
           style={{ 
             top: '50%', 
             left: '50%', 
             transform: 'translate(-50%, -50%)',
             width: '900px',
             display: 'flex',
             flexDirection: 'column',
             ...aiTextStyle 
           }}>
        <h1 
          style={{ 
            fontFamily: fontFamily,
            fontSize: `${fontSizePx}px`, 
            fontWeight: fontWeight, 
            color: '#FFFFFF', 
            lineHeight: '1.2',
            whiteSpace: 'pre-wrap',
            wordBreak: 'keep-all',
            textAlign: aiTextStyle.textAlign || (layout.includes('left') ? 'left' : (layout.includes('right') ? 'right' : 'center')),
            letterSpacing: fontFamily === 'Black Han Sans' ? '0' : '-0.05em',
            textShadow: '0 4px 15px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.3)'
          }}
          dangerouslySetInnerHTML={{ 
            __html: text.replace(/\*\*(.*?)\*\*/g, `<span style="color:${mainColor}; text-shadow: 0 0 20px ${mainColor}66;">$1</span>`) 
          }}
        />
      </div>
    </div>
  );
}

export default function RenderSlidePage() {
  return (
    <Suspense fallback={<div style={{background:'black', width:'1080px', height:'1350px'}}></div>}>
      <SlideRenderer />
    </Suspense>
  );
}
