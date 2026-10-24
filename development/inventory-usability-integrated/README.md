# 사용성 준비본 통합 — 실행 앱 미반영

## 결과와 위치

공통 화면·미디어·Field·Admin 네 준비본에 공통 작업 ID 보존 수정을
합쳤다. `prepared/` 안의 **35개 전체 소스 `.txt`**가 검토 대상이다.
실행 모듈이 아니며 자동으로 적용되지 않는다.

**실행 앱/Preview, 기존 DB, 실제 로그인·직원 세션, 저장소, 비밀값,
패키지, 환경·포트·워크플로, GitHub 원격, 배포는 변경하거나 접근하지 않았다.**
서버 시작·재시작도 하지 않았다.

## 1. 조합 순서와 동일성

1. `development/inventory-usability-common`
2. `development/inventory-usability-media`
3. `development/inventory-usability-field`
4. `development/inventory-usability-admin`
5. `development/request-operation-safety`
6. 아래 두 URL 연결 보완

`assembly.json`은 선행 준비본 manifest 해시와 파일별 후보 이력을
기록한다. 중복 경로는 위 순서의 최신 전체 후보를 사용하며, 기존
준비본은 덮어쓰지 않는다. 최초 조합 때 모든 선행 후보 해시와 현재
실행 파일 기준 해시를 확인했다.

`manifest.json`은 최종 후보/실행 기준 해시와 파일별 원본 이력,
통합 중 추가 보완 여부를 기록한다. 원본이 바뀌었다면 전체 파일을
그대로 덮어쓰지 말고 변경 부분을 다시 검토해야 한다.

`assemble.mjs`는 최초 조합용이며 실행 앱 경로에 쓰지 않는다.
검토된 통합 보완을 덮어쓰려 하면 중단한다. 수정된 통합본 위에서
다시 실행하는 적용 도구가 아니다.

## 2. 통합 중 보완한 연결 두 곳

### 재고 목록의 URL과 화면 상태

선행 Admin 후보는 URL 필터를 첫 마운트에만 읽고 이후 로컬 상태를
URL에 쓰는 방식이었다. 같은 컴포넌트의 다른 쿼리 이동이나
브라우저 뒤로/앞으로에서 새 URL을 옛 로컬 필터로 덮을 위험이 있었다.

통합 후보는 허용된 URL 검색 조건을 목록의 단일 상태 원본으로 사용한다.
기존 검색·분류·상태·사용패턴·페이지·페이지 크기·정렬 버튼은 유지한다.
연속된 필터 변경/페이지 초기화가 서로의 변경을 버리지 않도록
각 핸들러는 최신 URL을 읽는다. 기존 필터 변경의 replace 방식도 유지한다.

### Field 거래 화면의 탭과 URL

기존 거래 화면은 `tab`을 첫 마운트에만 읽어 같은 화면의 쿼리 이동에서
URL과 열린 탭이 달라질 수 있었다.

통합 후보는 요청/입출고 내역/임시 저장 탭을 URL에서 읽고, 기존 탭 버튼은
같은 지점 내부의 URL만 변경한다. 다른 쿼리 조건은 유지하며
브라우저 뒤로/앞으로에서 탭도 맞게 복귀한다.
업무 상태·권한·집계·저장 처리에는 변경이 없다.

위 변경은 각각 최종 `Inventory.tsx.txt`,
`pages/field/FieldTransactions.tsx.txt`에만 있다.
공통 작업 ID 수명·원래 본문·revision·완료 원본 작업 ID와 선행 미디어
권한/호환 경로는 그대로 유지한다.

## 3. 검증과 범위

최종 결과: **통합 후보 TypeScript 통과, 실제 App/Wouter 브라우저 53개,
작업 처리 브라우저 46개, receipt 서비스 쿼리 계약 대역 6개 통과.**
브라우저 예외와 예상 밖 외부/합성 요청은 두 묶음 모두 0건이다.
타입 검사는 최종 전체 입력에 대해 통과했으며, 후속 묶음에서는
전체 입력 해시 일치를 확인해 그 타입 결과만 재사용했다.

최종 정확한 경우 수/이름:

- `route-results.json`: 실제 App/Wouter 연결 및 화면 행렬.
- `command-results.json`: 공통 작업/Field/Admin 복구 브라우저 검사 및
  기존 receipt 서비스의 쿼리 계약 대역 검사.
- `command-manifest.json`: 작업 처리 검사에 사용한 최종 후보 해시.
- `generated-artifacts/inventory-usability-integrated/`: 타입 로그와
  합성 화면, 자체 포함 검토 보고서. Git/배포에서 제외된다.

```sh
env -i PATH="$PATH" LANG=C.UTF-8 NODE_ENV=test \
  node development/inventory-usability-integrated/verify-routes.mjs

env -i PATH="$PATH" LANG=C.UTF-8 NODE_ENV=test \
  node development/inventory-usability-integrated/verify-commands.mjs
```

두 검사는 자격증명 없는 별도 `/tmp` 작업본에 최종 후보만 조합한다.
이미 설치된 의존성만 사용하며 서버·새 포트·실제 네트워크 서비스를
사용하지 않는다. 타입 검사는 기존 네트워크/DB/프로세스 차단 가드 아래 실행한다.

### 실제 라우터 검사에서 사용한 것

실제 `App`, 설치된 Wouter, 지점 base, 실제 Admin/Field 라우터·가드·
layout·헤더, 관련 Dashboard/Inventory/ItemDetails/FieldTransactions/
FieldRequestsList와 기존 읽기/쓰기 helper·언어·테마·카트 공급자를 사용한다.
Wouter를 모의 구현으로 대체하지 않는다.

외부 HTTP는 전부 차단한다. 인증 훅/사용자/HTTP 응답은 합성 자료다.
App의 이번 범위와 무관한 페이지는 명시적 대역이며 실제 기능을
검사했다고 주장하지 않는다. 기존 공개 브랜드 로고만 인라인 이미지로 사용한다.

다음 연결을 검사한다:

- 같은 재고 목록의 쿼리 이동·뒤로/앞으로·연속 필터/페이지 초기화·정렬.
- Savannah/Indiana의 전체 상세 진입/목록 복귀와 허용된 필터 보존.
- 외부·다른 지점·허용되지 않은 쿼리 복귀 주소의 제한.
- Dashboard → 실제 Field 요청 탭과 관리자 상태 필터.
- Field 탭의 URL 이동·뒤로 이동.
- 실제 경로를 떠났다 돌아온 미확정 관리자 작업의 원래 ID 복구/중복 차단.
- 기존 Admin 화면 가드 및 Field 관리자 처리 버튼의 역할별 표시.
- 두 지점·세 언어·두 테마의 Dashboard/재고/요청 화면 행렬.

작업 처리 검사는 최종 통합 소스의 실제 helper/transport/queryClient와
Field/Admin 컴포넌트를 사용한다. 이 묶음의 인증/라우터는 합성 경계다.
별도의 실제 App/Wouter 검사와 혼동하지 않는다.

기존 receipt 서비스 검사는 합성 identity/쿼리 대역이며 실제
PostgreSQL·트랜잭션·행 잠금·지점 membership의 증거가 아니다.
이전 준비본의 검사 수나 반복 실행을 이번 결과에 합산하지 않는다.

`--checked-work`는 전체 타입 입력 해시가 같은 통과 작업본에만
타입 검사 재사용을 허용한다. 후보가 바뀌면 재사용이 거절된다.
`--case` 부분 검사는 공식 최종 성공 결과를 갱신하지 않는다.

## 4. 아직 실제 적용/재게시할 수 없는 이유

- 이번 결과는 **분리된 소스 통합과 합성 연결 검증**이다. 실행 코드 적용,
  현재 실제 계정의 업무 성공, 실제 저장소 연결, 운영 배포의 증거가 아니다.
- 미확정 작업 ID는 같은 문서의 화면 재진입에서 유지한다.
  새로고침/탭 종료/계정 변경의 새 문서를 넘는 보존은 추가하지 않았다.
  미확정 업무를 초기화하려고 새로고침·새 ID 제출을 하지 않는다.
- Field 카트는 기존 Field layout의 수명에 속한다. Field 내부 경로와
  모드/문서 전환을 같은 초안 보존 범위라고 간주하지 않는다.
  모드/지점 전환 전 작성 중 작업·미확정 업무를 확인해야 한다.
- 과거 권한이나 과거 성공을 현재 기록 본문 조회 권한으로 사용하지 않는다.
  권한이 없거나 결과가 계속 미확정이면 임의 재제출 대신 업무 확인이 필요하다.
- 기존 시작 설정 테스트 실패, 실제 로그인 업무/휴대폰, 실제 화면 이동
  대기시간, 실제 provider/bucket·과거 사진 연결은 미해결/미검증이다.
- 가격/RMS/일일보고서/라벨/아이콘·메뉴 전체 개편은 하지 않았다.

## 5. 다음 단계

보존 대상은 기존 `tkkyutae-hue/TK-ElectricMaterial-Inventory` 저장소의
**`Indiana` (대문자 I)** 브랜치다. 과거 `indiana-phase2` 지정은 이번
승인 대상이 아니다. `Indiana`는 개발 결과 보존·검토용이며 별도 승인된
변경을 최종적으로 공통 `main`에 합치는 용도다. 지점별 별도 제품/
저장소/서버/배포/영구 운영 브랜치를 만드는 작업이 아니다.

먼저 이 통합본과 검사 결과를 위 GitHub 보존 경로에 보존하고,
원격 동일성을 확인해야 한다. push가 자동 적용/배포를 유발하지 않는지
현재 설정을 확인하기 전에는 원격 변경을 하지 않는다.

그 후 실제 적용 변경목록에 파일·지점·역할·기존 직원 탭/초안/
미확정 요청 처리·실제 설정/저장소 확인 범위·재시작 허용 여부·
중단 조건을 명시해 사용자 승인을 받는다.

**GitHub 보존도 실제 적용 승인이 아니다. 승인 전 실행 코드 적용,
실제 업무 데이터 작업, 서버 재시작, 다시 게시를 하지 않는다.**

현재 보존 단계의 관찰·차단 조건·재현 기준은 `preservation/README.md`,
실제 적용 검토 목록은 `preservation/APPLICATION-REVIEW.md`에 분리한다.
