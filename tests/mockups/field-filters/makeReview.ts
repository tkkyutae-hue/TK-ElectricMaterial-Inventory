/** Produce a static, self-contained screenshot review. No app/network/DB. */
import { readFileSync, writeFileSync } from "node:fs";
const dir = "tests/mockups/field-filters/review";
const checks = JSON.parse(readFileSync(`${dir}/checks.json`, "utf8"));
const matrixCount = checks.observations.filter((o: any) => o.scenario).length;
const interactiveCount = checks.observations.filter((o: any) => o.filters).length;
if (matrixCount !== 240 || interactiveCount !== 5) throw Error("Complete offline matrix evidence required");
const screens = [
  ["mobile-dark-ko.jpg", "모바일 · 이미지 카테고리", "기존 TK 로고와 이미지 중심 탐색을 유지합니다. 아래 삽화는 실제 사진이 아닌 대표 샘플입니다."],
  ["mobile-dark-ko-selected.jpg", "모바일 · 선택 후 필터", "선택 카테고리를 접고 분류 단계, 자주 찾는 규격, 상세 필터와 선택 조건을 보여 줍니다."],
  ["mobile-dark-ko-results.jpg", "모바일 · 자재 목록", "자재명·규격·재고·단위를 먼저 보여 줍니다. 합성 재고이며 실제 입출고가 아닙니다."],
  ["desktop-light-en-results.jpg", "데스크톱 · 밝은 테마 비교표", "규격과 재고를 행 단위로 비교합니다. 모든 숫자와 품목은 모의 데이터입니다."],
  ["tablet-dark-es.jpg", "태블릿 · 스페인어", "중간 화면 폭에서는 좁은 표 대신 읽을 수 있는 목록으로 전환합니다."],
];
const figures = screens.map(([file, title, text]) => `<figure><figcaption><h2>${title}</h2><p>${text}</p><b>합성 데이터 · 실제 앱 미연결</b></figcaption><img alt="${title} — 합성 데이터 모의 화면" src="data:image/jpeg;base64,${readFileSync(`${dir}/${file}`).toString("base64")}"></figure>`).join("");
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TK Electric 필터 개선 · 분리 모의 화면 검토</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f7f3;color:#102619;font:16px/1.7 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:32px 20px}h1{font-size:28px;line-height:1.3}h2{font-size:21px}header,section,figure{background:white;border:1px solid #cfdfd0;border-radius:12px;padding:24px;margin:0 0 24px}figure img{display:block;max-width:100%;height:auto;max-height:1100px;margin:20px auto 0;border:1px solid #d4e0d5}figcaption b{color:#285c36}code{overflow-wrap:anywhere}li{margin:6px 0}.note{border-left:4px solid #397b49;padding-left:16px}a{color:#245a34}</style>
<main><header><p>TK ELECTRIC · 검토용 / SYNTHETIC DATA</p><h1>필드모드 자재 탐색·필터 개선안</h1><p>실제 앱과 연결하지 않은 분리 모의 화면입니다. 저장·입출고·요청 제출 기능을 실행하지 않습니다.</p><p class="note">기존 직원 DB, 실제 앱 코드, 공통 Select, 오류 진단 코드, 설정과 배포는 변경하지 않았습니다. 기존 카테고리 사진을 대체하는 제안이 아닙니다.</p></header>
<section><h2>검증 범위</h2><ul><li>36개 자동 검사 통과: 320/390/768/1024/1440 × 한국어/영어/스페인어 × 밝음/어두움의 8개 상태 = ${matrixCount}개 상태 조합.</li><li>${interactiveCount}개 화면 폭에서 필터 적용·개별 해제·초기화·카테고리 변경·상세 필터 초점 가두기/복귀·하단 카트 가림 검사.</li><li>다중 조건 결과수, 사진 누락/깨짐 구분, 사진 확대, 재시도, 카트 수량, 품절/조회 오류 구분 확인.</li><li>네트워크 요청과 업무 호출은 차단·검사했고 0건입니다. 앱 서버와 기존 DB는 사용하지 않았습니다.</li><li>모의 컴포넌트의 별도 TypeScript 검사 통과.</li></ul></section>
${figures}
<section><h2>통합 전 남은 확인</h2><ul><li>미해결 선택창 오류의 진단 코드를 보존하고 원인 확인과 통합 시점을 조정해야 합니다.</li><li>실제 필터 API의 분류 연결·결과수·페이지 나누기 정합성은 검증하지 않았습니다.</li><li>실제 카테고리/제품 사진과 기존 카트·릴/자재 상세 흐름을 보존하여 연결해야 합니다. DB에서 사진을 조회하지 않았습니다.</li><li>이 결과는 Chromium 모의 화면 검사입니다. 실제 모바일 기기, Safari, 전체 스크린리더/WCAG 감사, 운영 데이터 동작은 미검증입니다.</li><li>한글 캡처는 이미 설치돼 있던 로컬 Nanum 글꼴을 메모리에만 넣어 생성했습니다. 새 패키지·글꼴 설치 및 외부 다운로드는 없습니다.</li></ul><p><strong>실제 앱 통합·스키마 변경·재시작·배포는 별도 승인 전 진행하지 않습니다.</strong></p></section></main></html>`;
writeFileSync(`${dir}/filter-review.html`, html);
console.log(`Static review created: ${Buffer.byteLength(html)} bytes`);
