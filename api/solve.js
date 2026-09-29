export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    const { imageBase64, isHandwriting, isHard } = req.body;

    const promptText = `
수학 문제 이미지를 분석하여 아래의 JSON 구조로만 정확하게 답변해주세요. 다른 설명이나 마크다운 래핑 없이 JSON만 출력하세요.

JSON 형식 예시:
{
  "title": "공통수학1 · 이차방정식과 이차함수",
  "isExample": false,
  "problemHtml": "이차함수 $y = x^2 - 4x + k$의 그래프가 $x$축과 서로 다른 두 점에서 만나도록 하는 실수 $k$의 값의 범위를 구하시오.",
  "approach": "그래프와 $x$축의 교점 개수는 이차방정식 $x^2 - 4x + k = 0$의 실근 개수와 같아요.",
  "steps": [
    {
      "title": "교점을 방정식으로 바꾸기",
      "hint": "이차함수 $y = f(x)$가 $x$축과 만나는 점의 $x$좌표는 방정식 $f(x)=0$의 실근입니다.",
      "content": "이차함수 $y = x^2 - 4x + k$의 그래프가 $x$축과 만나는 점의 $x$좌표는 방정식 $x^2 - 4x + k = 0$의 실근과 같습니다."
    }
  ],
  "finalAnswer": "k < 4",
  "answerExplanation": "$y = x^2 - 4x + k$에서 $x$축과 서로 다른 두 점에서 만나려면 판별식 $D > 0$이어야 합니다.",
  "concepts": [
    {
      "title": "판별식",
      "formula": "D = b^2 - 4ac",
      "desc": "$D > 0$이면 서로 다른 두 실근을 가져요."
    }
  ],
  "similarProblems": [
    {
      "level": "쉬움",
      "text": "이차함수 $y = x^2 + 2x + k$의 그래프가 $x$축과 만나지 않도록 하는 실수 $k$의 값의 범위를 구하시오.",
      "hint": "판별식 $D < 0$이어야 합니다.",
      "answer": "k > 1"
    }
  ]
}
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: 'image/png',
                    data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await geminiResponse.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      return res.status(500).json({ error: 'AI 응답 형식이 올바르지 않습니다.' });
    }

    const responseText = data.candidates[0].content.parts[0].text;
    const cleanJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonText);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });
  }
}
