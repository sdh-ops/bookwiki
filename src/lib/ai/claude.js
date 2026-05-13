import axios from 'axios';

/**
 * Claude Service for Strategic Card News Planning
 */
export const generatePlansWithClaude = async (analysisData, projectInfo = {}) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is missing.");
    return { error: "API Key Missing" };
  }

  const slideCount = projectInfo.slideCount || 4;

  const prompt = `
    당신은 세계 최고의 SNS 콘텐츠 기획자입니다. 
    제공된 원고 분석 데이터를 바탕으로, 인스타그램에서 '저장'과 '공유'를 유도하는 3가지 카드뉴스 기획안을 작성해주세요.

    [원고 분석 데이터]
    ${JSON.stringify(analysisData, null, 2)}

    [제작 조건]
    - 대상 도서: ${projectInfo.title}
    - 타겟 독자: ${projectInfo.targetAudience}
    - 제작 장수: ${slideCount}장
    - 플랫폼: ${projectInfo.snsPlatform}

    [기획 핵심 전략]
    - '호기심 간극(Curiosity Gap)'과 '사회적 증거' 등 심리적 트리거를 적극 활용할 것.
    - 첫 장은 반드시 3초 안에 독자를 멈추게 하는 '압도적 훅'이 있어야 함.
    - 인스타그램/스레드에서 현재 가장 바이럴이 잘 되는 문체(솔직함, 충격적 사실, 공감 유도)를 사용할 것.
    - 지루한 설명조를 배제하고, 독자에게 말을 거는 '대화형' 또는 '체험형' 대본을 짤 것.

    [컨셉별 지침]
    - 컨셉 1 (시네마틱): 영화 예고편처럼 웅장하고 미스터리한 분위기.
    - 컨셉 2 (테크니컬): 비밀 데이터, 유출된 서류, 전문적인 분석 리포트 스타일.
    - 컨셉 3 (바이럴): 실제 채팅창, SNS 알림창, 일기장 유출 등 극강의 몰입형 UI 스타일.
    2. 각 기획안은 다음 정보를 포함해야 합니다.
       - title: 컨셉 이름
       - strategy: 마케팅 전략 요약
       - tags: 관련 해시태그 3개
       - previewText: 첫 장의 강력한 훅 카피
       - slides: 각 슬라이드별 { n, role, text } 배열 (총 ${slideCount}장)

    답변은 반드시 유효한 JSON 형식으로만 해주세요. 
    형식: { "plans": [ { "id": 1, "title": "", "strategy": "", "tags": [], "previewText": "", "slides": [] }, ... ] }
  `;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-haiku-20240307', // Using Haiku for maximum compatibility test
        max_tokens: 4000,
        system: "당신은 도서 마케팅 및 SNS 전략 전문가입니다. 모든 출력은 순수 JSON이어야 합니다.",
        messages: [
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract JSON from response (handling potential markdown formatting)
    const content = response.data.content[0].text;
    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Claude API Planning Error:", error.response?.data || error.message);
    throw new Error("Claude 기획안 생성 중 오류가 발생했습니다.");
  }
};
