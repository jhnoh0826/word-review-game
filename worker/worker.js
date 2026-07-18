/* =========================================================================
 *  단어 복습 게임 - AI 중계 서버 (Cloudflare Worker)
 * =========================================================================
 *  게임(GitHub Pages)에서 이 서버로 요청하면, 서버에 보관된 제미나이 API 키로
 *  단어장을 생성해서 돌려줍니다. 키는 Cloudflare 환경변수에만 저장됩니다.
 *
 *  환경변수 (Cloudflare 대시보드 → Workers → 이 워커 → Settings → Variables):
 *    GEMINI_API_KEY  (Secret)  : 제미나이 API 키
 *    BETA_CODE       (Secret)  : 베타테스터에게만 알려주는 코드 (설정 안 하면 누구나 사용 가능)
 *    MODEL           (선택)    : 기본값 gemini-2.5-flash
 * ========================================================================= */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function buildPrompt(words, hasFile) {
  const source = words
    ? `단어 목록: ${words}`
    : `첨부한 파일들(사진/PDF)에 나오는 영어 단어를 모두 찾아서 정리해줘. 파일이 여러 개면 전부 확인해줘.`;
  return `다음 영어 단어들을 초등 고학년~중학생 수준 단어 학습용으로 표로 정리해줘.
컬럼은 Word / Definition (KR) / Definition / Example Sentence 순서로 만들어줘.
- Word: 영어 단어의 기본형 (동사는 원형, 명사는 단수형)
- Definition (KR): 한글 뜻
- Definition: 영어로 된 쉬운 뜻 풀이
- Example Sentence: 반드시 해당 단어(또는 그 단어의 자연스러운 변형)를 포함한 예문
다른 설명 없이 마크다운 표만 출력해줘.

${hasFile && words ? "파일에서 찾은 단어와 아래 단어 목록을 합쳐서 정리해줘.\n" : ""}${source}`;
}

// 환경변수 이름에 실수로 공백이 섞여 들어가도 찾을 수 있게 이름을 다듬어서 조회
function getEnv(env, name) {
  if (env[name] !== undefined) return env[name];
  const key = Object.keys(env).find((k) => k.trim() === name);
  return key ? env[key] : undefined;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const GEMINI_API_KEY = getEnv(env, "GEMINI_API_KEY");

    // 진단용: 사용 가능한 모델 목록 (모델 이름만 반환, 비밀정보 없음)
    if (request.method === "GET" && new URL(request.url).pathname === "/models") {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": GEMINI_API_KEY || "" },
      });
      const d = await r.json().catch(() => ({}));
      const names = (d.models || []).map((m) => m.name);
      return json({ status: r.status, models: names });
    }

    if (request.method !== "POST") {
      return json({ error: "POST 요청만 받아요" }, 405);
    }
    const BETA_CODE = getEnv(env, "BETA_CODE");
    const MODEL = getEnv(env, "MODEL");

    if (!GEMINI_API_KEY) {
      return json({ error: "서버에 API 키가 아직 설정되지 않았어요. (Cloudflare 대시보드에서 GEMINI_API_KEY를 등록하세요)" }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "잘못된 요청 형식이에요" }, 400);
    }

    // 베타 코드 확인 (BETA_CODE가 설정된 경우에만)
    if (BETA_CODE && body.betaCode !== BETA_CODE) {
      return json({ error: "베타 코드가 올바르지 않아요" }, 403);
    }

    const words = (body.words || "").toString().slice(0, 4000).trim();
    // files: [{ mimeType, data(base64) }, ...]  (구버전 호환: file 단일 객체도 허용)
    const files = Array.isArray(body.files) ? body.files : (body.file ? [body.file] : []);

    if (!words && !files.length) {
      return json({ error: "단어를 입력하거나 파일을 선택해 주세요" }, 400);
    }
    if (files.length > 8) {
      return json({ error: "파일은 한 번에 8개까지만 올릴 수 있어요" }, 400);
    }
    const okTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    let totalSize = 0;
    for (const f of files) {
      if (typeof f?.data !== "string" || typeof f?.mimeType !== "string") {
        return json({ error: "파일 형식이 올바르지 않아요" }, 400);
      }
      if (!okTypes.includes(f.mimeType)) {
        return json({ error: "사진(JPG/PNG/WebP) 또는 PDF만 지원해요" }, 400);
      }
      totalSize += f.data.length;
    }
    // base64 길이 기준 합계 약 13MB 제한
    if (totalSize > 18_000_000) {
      return json({ error: "파일 용량 합계가 너무 커요. 장수를 줄이거나 작은 파일로 올려주세요" }, 400);
    }

    const parts = files.map((f) => ({ inline_data: { mime_type: f.mimeType, data: f.data } }));
    parts.push({ text: buildPrompt(words, files.length > 0) });

    // gemini-flash-latest: 구글이 최신 flash 모델로 자동 연결해주는 별칭 (모델 세대가 바뀌어도 계속 동작)
    const model = MODEL || "gemini-flash-latest";
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify({ contents: [{ parts }] }),
        }
      );
    } catch {
      return json({ error: "AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요" }, 502);
    }

    if (!res.ok) {
      const status = res.status;
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      if (status === 429) return json({ error: "오늘 사용량 한도를 넘었어요. 내일 다시 시도해 주세요" }, 429);
      if (status === 403) return json({ error: "API 키가 잘못됐거나 권한이 없어요 (관리자 확인 필요)" }, 502);
      return json({ error: `AI 서버 오류 (${status}). 잠시 후 다시 시도해 주세요`, detail }, 502);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text.includes("|")) {
      return json({ error: "AI가 단어장을 만들지 못했어요. 단어나 파일을 확인하고 다시 시도해 주세요" }, 502);
    }

    return json({ table: text });
  },
};
