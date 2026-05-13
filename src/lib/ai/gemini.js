/**
 * Unified Visual Engine (Kimi 2.6 Driven)
 * Completely eliminates Gemini costs by using Kimi's pre-generated specs.
 */
export const generateVisualSpecWithGemini = async (plan, visualMood) => {
  // We rename the function but internally we ONLY use Kimi's data to save cost.
  console.log("🚀 Kimi 2.6 전용 비주얼 엔진 가동 (비용 최적화 모드)");

  if (plan.visualSpec) {
    console.log("✅ Kimi가 설계한 정밀 비주얼 가이드를 적용합니다.");
    return plan.visualSpec;
  }

  // Fallback (Should not happen with latest Kimi prompt)
  console.log("⚠️ 비주얼 가이드가 누락되어 기본 프리셋을 적용합니다.");
  return {
    style: "Cinematic & Minimalist",
    palette: { main: "#CF5C3F", accent: "#131316", bg: "#F8F9FA" },
    imagePrompts: plan.slides?.map(s => s.text) || ["abstract book background"]
  };
};
