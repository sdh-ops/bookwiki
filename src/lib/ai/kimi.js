import axios from 'axios';

/**
 * Kimi 2.6 All-in-One Service (v3.2)
 * Enhanced Contextual Visualization & Consistency Engine.
 */
export const analyzeAndPlanWithKimi = async (text, projectInfo = {}) => {
  const KIMI_API_KEY = process.env.KIMI_API_KEY;
  
  if (!KIMI_API_KEY) {
    console.error("KIMI_API_KEY is missing.");
    return { error: "API Key Missing" };
  }

  const slideCount = projectInfo.slideCount || 4;
  
  // [Deep Reading] 대규모 3점 샘플링 (총 50,000자 스캔)
  const totalLen = text.length;
  const startPart = text.substring(0, 20000);
  const midPoint = Math.floor(totalLen / 2);
  const midPart = text.substring(midPoint - 7500, midPoint + 7500);
  const endPart = text.substring(totalLen - 15000);
  
  const manuscriptContext = `
    [도입부 (20k)]: ${startPart}
    ...
    [핵심부 (15k)]: ${midPart}
    ...
    [결말부 (15k)]: ${endPart}
  `;
  const concepts = projectInfo.concepts || ['hook', 'info', 'mbti'];
  const conceptMap = {
    hook: "질문/후킹형: 질문으로 시작해 독자의 페인 포인트를 자극하는 방식.",
    info: "정보/요약형: 책의 핵심 내용을 '정보 요약'이나 '꿀팁' 형태로 제공.",
    mbti: "MBTI/페르소나형: 특정 성격이나 상황(예: 파워J, 소심한 I 등)을 타겟팅.",
    minimal: "미니멀/인용형: 책 속의 강력한 한 문장에만 집중하는 프리미엄 미학 방식.",
    story: "스토리텔링형: 독자의 실제 고민이나 사례를 일기처럼 풀어가는 서사 방식.",
    checklist: "체크리스트형: 핵심 요약이나 꿀팁 위주의 저장 유도 방식."
  };

  const prompt = `
    당신은 데이터 기반 도서 마케팅과 비주얼 브랜딩의 거장입니다.
    원고를 딥스캔하고, 사용자가 선택한 아래 3가지 컨셉에 맞춰 최적화된 마케팅 팩을 생성하세요.

    [입력 데이터]
    - 도서: ${projectInfo.title} (${projectInfo.author})
    - 타겟: ${projectInfo.targetAudience || '대중'}
    - 플랫폼/장수: ${projectInfo.snsPlatform} / ${slideCount}장
    - 원고 입체 스캔: ${manuscriptContext}

    [Kimi의 필수 지시사항: 다양성 및 언어 무결성]
    1. **한자 사용 금지**: 모든 텍스트(카피, 제목, 설명)에서 불필요한 한자(Chinese Characters) 사용을 절대 금지합니다. 오직 깨끗한 한글(Hangul)과 필요한 영문만 사용하세요.
    2. **선택된 3종 전략 (필수)**: 아래 3가지 컨셉을 각각 하나씩 담당하는 3가지 기획안을 생성하세요.
       - 전략 1: ${conceptMap[concepts[0]] || conceptMap.hook}
       - 전략 2: ${conceptMap[concepts[1]] || conceptMap.info}
       - 전략 3: ${conceptMap[concepts[2]] || conceptMap.mbti}

    [Kimi의 비주얼 전략: 디자인 자율화]
    1. **디자인 좌표 설계 (필수)**: 하드코딩된 레이아웃을 버리고, 각 요소의 **CSS 좌표(\`textStyle\`, \`coverStyle\`)**를 직접 설계하세요.
       - **텍스트 (\`textStyle\`)**: \`{ "top": "50%", "left": "30%", "width": "600px", "textAlign": "left" }\` 등
       - **표지 (\`coverStyle\`)**: 표지 노출 시 텍스트와 겹치지 않게 반대편이나 구석에 배치. \`{ "top": "50%", "left": "75%", "width": "450px", "rotate": "-5deg" }\` 등
    2. **God-tier Mesh 배경**: 최소 3개 레이어의 복합 메쉬 그라데이션(\`bgStyle\`)을 필수 적용하세요.
    3. **표지 노출 (필수)**: 기획안 중 **단 1번**만 표지를 사용하세요. (\`showCover: true\`) 

    [Kimi의 카피라이팅 가이드: 절대적 사실 및 디테일]
    1. **Zero Fiction**: 단 하나의 수치, 이름도 허구로 지어내지 마세요.
    2. **디테일의 힘**: 원고 속의 **특정 감각적 묘사, 실제 대사, 고유한 사건**을 핀셋처럼 뽑아내어 카피에 녹여내세요. (예: "그녀의 향기" 대신 "그녀가 쓰던 낡은 라벤더 비누 향")
    3. **최종 맞춤법 검수**: 표준어 엄수.
    1. **페르소나 분석**: 타겟 독자가 이 책에서 느낄 핵심 갈망(Desire)을 3가지 키워드로 정의하세요.
    2. **슬라이드 사양**:
       - **비주얼 테마**: 전략 컨셉에 어울리는 시각적 톤앤매너 (영문 키워드).
       - **문구**: 위 가이드에 따라 1~2줄의 짧고 강력한 문장. '무렵' 등 표준어 엄수.
       - **배경**: 텍스트 상징과 완벽하게 매칭되는 영문 검색 키워드.
       - **색상**: 세련된 HEX 컬러.

    [응답 형식 - 반드시 유효한 JSON]
    {
      "analysis": { "targetDesire": [], "marketPosition": "", "visualMood": "" },
      "plans": [
        {
          "id": 1,
          "title": "[후킹형] 기획 제목",
          "strategy": "궁금증 유발 중심의 전략 설명",
          "tags": ["후킹", "공감"],
          "previewText": "첫 슬라이드 강렬한 질문 문구",
          "visualSpec": { 
            "visualTheme": "English Mood",
            "palette": { "main": "#HEX", "accent": "#HEX", "bg": "#HEX" }
          },
          "slides": [ 
            { 
              "n": 1, 
              "role": "hook", 
              "text": "카피 내용", 
              "fontSizePx": 110,
              "fontWeight": 900,
              "fontFamily": "Pretendard",
              "bgStyle": "CSS Mesh Gradient",
              "textStyle": { "top": "50%", "left": "50%", "width": "900px", "textAlign": "center" },
              "showCover": false,
              "coverStyle": { "top": "50%", "left": "75%", "width": "500px" }
            }
          ]
        },
        {
          "id": 2,
          "title": "[정보형] 기획 제목",
          "strategy": "실용적 핵심 요약 중심의 전략 설명",
          "tags": ["요약", "정보"],
          "previewText": "꼭 알아야 할 핵심 내용",
          "visualSpec": { ... },
          "slides": [ ... ]
        },
        {
          "id": 3,
          "title": "[MBTI/페르소나형] 기획 제목",
          "strategy": "특정 대상 타겟팅 중심의 전략 설명",
          "tags": ["MBTI", "페르소나"],
          "previewText": "00한 당신을 위한 추천",
          "visualSpec": { ... },
          "slides": [ ... ]
        }
      ]
    }
  `;

  try {
    const response = await axios.post(
      'https://api.moonshot.ai/v1/chat/completions',
      {
        model: 'kimi-k2.6',
        messages: [
          { role: 'system', content: '도서 마케팅 및 디자인 디렉터입니다. 창의적이고 정확한 JSON을 출력합니다. 코드 블록이나 설명 없이 순수 JSON만 응답하세요.' },
          { role: 'user', content: prompt }
        ],
        temperature: 1,
        response_format: { type: "json_object" }
      },
      {
        headers: { 'Authorization': `Bearer ${KIMI_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 300000 
      }
    );
    
    let content = response.data.choices[0].message.content;
    
    // Most Robust JSON Extraction (Find first '{' and last '}')
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      content = content.substring(jsonStart, jsonEnd + 1);
    }
    
    try {
      const result = JSON.parse(content);
      console.log("Kimi 2.6 Diverse Planning Success");
      return result;
    } catch (parseError) {
      console.error("JSON Parsing Failed. Content snippet:", content.substring(0, 200));
      throw new Error(`응답 데이터 해석 실패: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Kimi Unified API Error Detail:", error.response?.data || error.message);
    const detail = error.response?.data?.error?.message || error.message;
    throw new Error(`Kimi 통합 분석 중 오류가 발생했습니다: ${detail}`);
  }
};
