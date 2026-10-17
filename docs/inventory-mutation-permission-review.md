# 1차 실제 재고 변경 권한 보호 — 적용 전 검토

## 범위와 변경

- 실제 재고 변경은 active admin/manager만 허용한다.
- 일반 출납 POST, 유형별 receive/issue/return/adjust/transfer POST,
  구형 items/movements POST, 초안 confirm POST에 manager 제한을 적용했다.
- 기존 역할 검사를 DB/session import가 없는 주입식 권한 모듈로 분리했다.
  실제 앱에서는 기존 authStorage를 주입한다. 매 요청마다 현재 계정의
  활성 상태와 역할을 조회하며, 실패·미인증·비활성·역할 부족은 거절한다.
  요청에 남은 currentUser가 권한을 부여하지 않도록 먼저 제거한다.
- 이미 manager 전용이던 자재/거래/릴/자산 변경 경로는 불필요하게 바꾸지 않았다.
- 요청 작성과 실제 출납 권한을 분리했다. staff의 요청 카트·작성 중 내용·
  요청 Undo 및 보고 접근은 유지한다. 배정 PO 팀리더 모델은 이번에 바꾸지 않았다.
- 일반 출납 폼의 버튼 외에 Enter/programmatic submit도 로컬에서 차단한다.
  제한 이유와 요청 화면 이동을 한/영/서로 제공한다.
- 직원의 일반 거래 편집/삭제 UI를 제한하고, 초안 확인 버튼을 비활성화한다.
  기존 초안 조회/이어보기와 기존 서버의 본인 초안 저장/삭제 정책은 유지한다.
  단순 초안 저장은 실제 재고 변경과 다르며, 이 작업은 초안 정책 전면개편이 아니다.

## 실제 수행 검사

아래는 재실행 횟수가 아니라 서로 다른 최종 검사 항목의 수이다.

| 검사 | 결과 | 증명 범위 |
|---|---|---|
| inventoryPermissions.test.ts | 10 통과 / 0 실패 | 실제 권한 모듈, 실제 routes.ts에서 추출한 등록문·handler, 실제 Express Router, 합성 세션/계정·모의 저장소 |
| inventoryPermissions.mock.test.ts | 6 통과 / 0 실패 | 실제 useAuth와 실제 홈/MovementForm/초안 목록/재고 카트, 모의 데이터·차단된 네트워크 |
| fieldCartFlow.mock.test.ts | 12 통과 / 0 실패 | 기존 저장 대기·Undo·초안 교체·닫기·충돌·통신유실·기록 보호 회귀 |
| movementSupplier.mock.test.ts | 1 통과 / 0 실패 | 실제 MovementForm 공급사 불러오기·변경·초안 저장 회귀 |
| materialRequestCommands.sql.test.ts | 22 통과 / 0 실패 | 새 폐기용 PostgreSQL 합성 데이터에서 기존 요청 서비스·Undo·권한·경합·재시도 회귀 |
| TypeScript | 통과 | tsc --noEmit --incremental false |

합계 51 통과, 최종 실패 0. 초기 검사에서는 모의 화면의 잘못된 카트 필드,
테스트의 성공 HTTP 상태 기대값(200 대신 실제 201), 기존 staff 편집 버튼을
전제한 회귀 fixture를 수정했다. 이 과정의 실행 실패를 운영 장애로 해석하지 않는다.

### 권한 검사 상세

- 26개 재고 변경 진입점: generic/typed/legacy movements, draft confirm,
  item 생성/수정/비활성화/복원, movement 수정/Undo/삭제/여러건 삭제·복구,
  wire reel 생성/여러건 생성/수정/비활성화/복원, tool asset 관리.
- viewer/manager_viewer/staff/알 수 없는 역할, 미로그인/비활성/계정조회 실패:
  저장소 read/write 모두 호출되지 않음을 검사했다.
- manager/admin: generic, 다섯 typed 경로, legacy, draft confirm의 실제 handler가
  모의 저장소에 정상 저장을 호출함을 검사했다.
- 세션을 유지한 채 역할/활성 상태가 변경되면 다음 요청에서 거절함을 검사했다.
- 화면은 390/1280폭, 한/영/서, light/dark의 직원 카트·안내를 검사했다.
  역할/상태 갱신 후 변경 버튼이 제한되고 기존 메모가 보존됨도 확인했다.

### 격리 경계

일반 권한 검사는 routes.ts 파일을 텍스트로 읽고 TypeScript AST로 지정한
라우트 등록문과 필요한 함수만 추출해 실행했다. 서버 진입점, 전체 registerRoutes,
DB 모듈, 세션 저장소, seed/migration/sync를 import/실행하지 않았다.
이는 동일 동작을 재작성한 유사 handler 검사가 아니지만 전체 앱 부팅 검사는 아니다.

브라우저 검사는 esbuild write:false와 Playwright setContent/inline script를
사용했다. 서비스 hook만 모의 경계로 교체했고 새 권한 검사는 실제 useAuth를
실행했다. HTTP 서버·추가 포트 없이 실행했으며 외부 네트워크는 차단했다.
기존 직원 DB·외부 서비스·앱 GET 화면을 사용하지 않았다.

요청 SQL 회귀는 기존 독립 검사 파일이 /tmp에 새로 생성한 PostgreSQL 클러스터,
합성 데이터, private Unix socket만 사용했다. TCP listen_addresses는 빈 값으로
확인했고 검사 종료 시 정리했다. 기존 DB 연결정보나 업무 데이터를 복제하지 않았다.

## 미검증과 남은 위험

- 실제 운영 배포 커밋·DB 매핑·지역 분리·운영 스키마·백업 상태는 확인하지 않았다.
- 실제 로그인 제공자, 쿠키 서명·실세션 저장소, 실제 운영 브라우저 통합은 미검증이다.
- 일반 출납 역할 검사는 요청 진입 시 최신 계정을 조회한다. 검사 후 진행 중인
  일반 저장과 계정 변경 사이의 DB 트랜잭션 단위 동시성까지 보장하지 않는다.
  기존 요청 명령의 실제 변경 트랜잭션 내 계정 잠금/검사는 그대로 유지했다.
- 일반 출납 후 별도 릴 HTTP 실패, 다품목 부분 저장, 재시도 중복과 일부 일반
  수정/삭제/복구 경합은 이번 범위 밖이다. 전체 수량 안전을 보장한다고 해석하지 않는다.
- 요청 완료의 SQL 회귀 통과는 일반 출납/릴 서비스 SQL의 검증 완료를 의미하지 않는다.
- 기존 선택창 진단, 공통 Select, 레이아웃, 필터 로직·디자인 시안은 변경하지 않았다.
  기존 앱을 통해 화면을 확인하는 행위는 DB 접근 가능성이 있어 수행하지 않았다.

## 운영 적용과 되돌리기

- DB 구조 변경·새 패키지·자격증명·환경/포트 변경은 필요하지 않았다.
- 기존 dev/prod DB 접속, 업무 데이터 변경, 스키마 적용, 앱 시작/재시작,
  배포·재배포, 백업 생성·복원은 수행하지 않았다.
- 운영 적용 전 실제 배포 버전·대상 DB·기존 백업 증거 확인과 별도 배포 승인이 필요하다.
- 코드 되돌리기는 직원의 업무 기록을 복원/덮어쓰기하는 방식으로 하지 않는다.
  이전 코드로 되돌리면 staff 직접 출납 허용이 다시 열릴 수 있다는 점을 검토해야 한다.
