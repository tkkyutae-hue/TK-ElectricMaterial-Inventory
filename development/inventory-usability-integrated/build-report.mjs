/** Self-contained synthetic evidence file; no server, network or application imports. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const delivery=dirname(fileURLToPath(import.meta.url)),root=resolve(delivery,"../..");
const read=p=>JSON.parse(readFileSync(join(delivery,p),"utf8"));
const routes=read("route-results.json"),commands=read("command-results.json"),manifest=read("manifest.json");
const escape=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const images=routes.screenshots.map(p=>`<figure><img alt="${escape(p.split("/").pop())}" src="data:image/jpeg;base64,${readFileSync(join(root,p)).toString("base64")}"><figcaption>${escape(p.split("/").pop())} · 합성 자료</figcaption></figure>`).join("");
const rows=manifest.files.map(f=>`<tr><td>${escape(f.path)}</td><td>${f.integrationAdjusted?"URL 연결 보완":"선행 준비본 유지"}</td></tr>`).join("");
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>준비본 통합 검사</title><style>
body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#f3f7f4;color:#142a20}main{max-width:1120px;margin:auto;padding:28px}header{background:#103d2a;color:white;padding:24px;border-top:5px solid #2ddb6f}h1{margin:0;font-size:28px}h2{margin-top:30px}.notice{padding:18px;border-left:4px solid #2b7650;background:white}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}figure{margin:0;background:white;padding:10px}img{max-width:100%;height:auto}figcaption{font-size:13px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;background:white}td,th{padding:10px;border-bottom:1px solid #d7e5db;text-align:left;overflow-wrap:anywhere}td:first-child{font-size:13px}li{margin:7px 0}</style>
<header><main><h1>TK Inventory 준비본 통합 검사</h1><p>공통 · 미디어 · Field · Admin · 작업 ID 보존</p></main></header><main>
<p class="notice"><strong>실행 앱 미반영 · 다시 게시 전 단계</strong><br>화면과 응답은 합성 자료입니다. 실제 직원 로그인·DB·저장소·실행 앱 접근, GitHub push, 서버 재시작, 배포를 하지 않았습니다.</p>
<h2>검사 결과</h2><ul><li>통합 후보 ${manifest.files.length}개 · TypeScript 통과</li><li>실제 App/Wouter 연결 검사 ${routes.scenarios}개</li><li>작업 처리 브라우저 검사 ${commands.browserScenarios}개</li><li>기존 결과 확인 서비스의 쿼리 계약 대역 검사 ${commands.receiptQueryContractCases}개</li><li>브라우저 예외 ${routes.browserErrors+commands.browserErrors}건 · 예상 밖 요청 ${routes.unexpectedRequests+commands.unexpectedRequests}건</li></ul>
<h2>연결 보완</h2><ol><li>재고 목록이 URL 필터를 상태 원본으로 사용하도록 보완해 같은 화면의 쿼리 이동과 뒤로·앞으로 이동을 반영했습니다.</li><li>Field 거래 화면의 탭과 URL을 연결해 요청 탭 복귀와 상태 필터를 유지했습니다.</li></ol>
<h2>남은 경계</h2><p>인증과 HTTP는 합성 경계입니다. 새로고침·탭 종료를 넘는 작업 ID 보존, 실제 로그인 업무·휴대폰·저장소 연결, 기존 시작 설정 실패와 화면 이동 지연은 해결됐다고 주장하지 않습니다.</p>
<p>다음은 GitHub 보존과 실제 적용 변경목록 검토입니다. 사용자 승인 전 실제 앱 반영이나 다시 게시를 하지 않습니다.</p>
<h2>실제 App을 사용한 합성 화면</h2><div class="grid">${images}</div><h2>최종 통합 파일</h2><table><thead><tr><th>경로</th><th>통합 처리</th></tr></thead><tbody>${rows}</tbody></table></main></html>`;
const output=join(root,"generated-artifacts/inventory-usability-integrated/check-report.html");
writeFileSync(output,html);console.log(output);
