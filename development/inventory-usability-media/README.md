# 사진·첨부 연결과 상태 안내 — 실행 앱 미반영 준비본

## 범위와 결과

`prepared/client/src/.../*.txt`는 전체 소스 후보이며 실행 모듈이 아니다.
기존 `client/`, `server/`, DB, 저장소, 세션, 설정, 패키지, workflow를 변경하지 않았다.
실제 앱/Preview를 조회하거나 서버를 시작·재시작하지 않았다.
전후 화면은 실제 직원 자료가 아닌 **격리 브라우저의 합성 자료**다.

현재 실행 코드와 예전 `development/indiana-media/`,
`development/indiana-integrated/` 자료를 대조했다. 예전 문서에 미연결로
적혀 있다는 이유만으로 현재 서버가 없다고 판단하지 않았다.
실제 현재 서버에는 대상별 목록·업로드·본문·다운로드·삭제·ZIP과
개발용 provider loader가 있다. 이 작업은 이를 새로 만들거나 활성화하지 않는다.
**실제 환경의 현재 저장소 설정·권한·파일 상태는 조회하지 않았으며 미검증이다.**

## 1. 확인한 불편과 수정

| 현재 코드의 확인된 문제 | 준비본의 수정 |
|---|---|
| `BranchAttachments`는 자재 상세에만 사용됨 | 기존 지원 대상인 카테고리·프로젝트·저장된 요청·거래에만 접점 추가 |
| 파일 다운로드는 일반 링크여서 처리·오류·중복 클릭 상태를 확인할 수 없음 | 기존 인증 다운로드 응답을 blob으로 받아 기록 옆에 처리/실패 표시. 브라우저 전달과 장치 저장 완료를 구분 |
| 서버의 대상별 ZIP에 화면 진입점 없음 | 동일 대상 권한 검사를 거치는 ZIP 버튼 연결. 기존 보고서/PPT 내보내기는 활성화하지 않음 |
| 사진 로딩 오류에서 DOM을 숨기거나 `innerHTML`로 치환, 상태를 구분하지 않음 | `BranchMediaImage`가 기존 지점 인증 요청을 사용해 없음/미설정/로딩/실패/제한/허용된 파일 유실 표시 |
| 일반 404를 실제 파일 유실처럼 안내 | 일반 401/403/404는 현재 조회 불가. 서버가 대상 권한 확인 뒤 반환하는 `BRANCH_MEDIA_OBJECT_MISSING`만 실제 내용 유실로 구분 |
| 갤러리 오류에서도 Field가 품목의 이전 대표 사진으로 대체할 수 있음 | 지점 갤러리는 성공한 현재 결과만 표시. 실패/권한 제한에서 이전 대표 이미지로 대체하지 않음 |
| 자재 갤러리 업로드 오류는 토스트뿐이고 같은 파일 확인 버튼 없음 | 첨부 영역 한 곳에서 파일/카메라 업로드·같은 파일 확인·결과 표시. 기존 파일 해시와 작업 ID 사용 |
| 삭제 응답 유실을 단순 오류로 처리 | 같은 파일 ID를 유지. 성공한 현재 권한 목록에서 제거가 확인되거나 서버의 `{id,state:"deleted"}` 응답이 있어야 완료. 미확정 동안 다른 변경 차단 |
| 첨부 쿼리 키에 계정/지점 식별이 없음 | 계정·지점·대상 종류·ID로 범위 지정. 전환/세션 종료 시 이전 이미지·작업 상태 숨김, object URL 폐기 |
| `CartPhoto`가 지점에서도 원래 URL을 직접 사용 | 지점 문서에선 허용된 URL과 인증 경로만 사용. 비지점 기존 URL 동작은 유지 |

이전 업로드가 미확정인 상태에서 같은 파일의 재시도가 나중에 권한 거절을
받아도, 그것을 최초 업로드의 실패 증거로 삼지 않는다. 원래 작업 ID와
미확정을 유지하고 새 제출을 막으며, 더 이상 재시도가 허용되지 않으면
무조건 재시도 버튼 대신 관리자 확인 안내를 제공한다.

기존 작업 ID/권한/DB/미디어 서비스·원본·tombstone·초안 정책은 변경하지 않는다.
썸네일은 상태별 짧은 표시와 현 언어의 접근 가능한 설명/title을 사용한다.
전체 설명과 재시도는 상세 사진 영역에 제공한다.

## 2. 현재 연결 현황표

표의 “실행 코드”는 **현재 소스 연결 유무**다. 실제 서비스 작동/저장소 검증을 뜻하지 않는다.
“준비본 연결”은 `prepared/`에만 있는 변경이다.

| 대상/기능 | 실행 코드 | 이번 준비본 | 코드 근거·권한 |
|---|---|---|---|
| 자재 목록·상세 갤러리 조회 | 연결됨 | 상태·실패·확대 보기 보완 | `ItemDetails.tsx: ItemGalleryPanel`, `FieldInventory.tsx: FieldItemDetailPanel`, `BranchMediaImage` |
| 자재 업로드·삭제·대표 사진 지정 | 연결됨 | 첨부 작업 상태로 통합, 카메라 유지, 읽기 전용 원본 안내 | `BranchAttachments`, `BranchItemGallery`; 서버 `mediaRoutes.ts`, `media.ts: upload/remove/primary` |
| 자재 첨부 목록·업로드·삭제 | 연결됨 | 확인/중복 방지/계정·대상 범위 보완 | 기존 `ItemDetails`의 `BranchAttachments` 사용을 유지 |
| 개별 첨부 다운로드 | 연결됨(일반 링크) | 처리·오류·중복 방지 연결 | `/api/media/:id/download` → `content`에서 매번 현재 대상 권한 확인 |
| 대상별 새 첨부 ZIP | UI 누락, 서버 연결됨 | 화면 연결 | `/api/media/targets/:kind/:id/export` → `archive`, 새 관리 첨부만, 100개/총20MiB 이하 |
| 카테고리 첨부 목록·업로드·다운로드·삭제·ZIP | UI 누락, 서버 연결됨 | 기존 카테고리 화면에 접힌 첨부 영역 | `CategoryDetail`, `mediaTarget("category",id)`, 조회: 활성 지점 멤버, 변경: admin/manager |
| 저장된 요청의 첨부 목록·업로드·다운로드·삭제·ZIP | UI 누락, 서버 연결됨 | 기존 요청 카드 펼침 안에 연결 | `FieldRequestsList: RequestCard`, 서버 `guarded`: manager 조회/변경, staff 본인 조회·requested일 때 변경 |
| 프로젝트 첨부 목록·업로드·다운로드·삭제·ZIP | UI 누락, 서버 연결됨 | 기존 상세 화면의 접힌 첨부 영역 | `ProjectDetail`, 조회: admin/manager/manager_viewer, 변경: admin/manager |
| 거래 첨부 목록·업로드·다운로드·삭제·ZIP | UI 누락, 서버 연결됨 | 기존 거래 행의 접힌 첨부 영역 | `Transactions`, `movement`는 실제 `inventory_movements` 부모. 조회/변경 역할은 프로젝트와 같음 |
| Savannah 원본 자재 사진 | 읽기 전용 경로 연결됨 | 원본 변경 없이 상태 안내 유지 | `legacyContent`, 현재 권한 및 exact 원본 참조 확인. provider의 실제 준비 상태는 이번에 확인 안 함 |
| Indiana 승인 카탈로그 그림 | 코드 연결됨 | 읽기 전용 안내 및 인증 표시 경로 유지 | `branchMediaSource`, `catalogContent`, catalog routes. 원본/승인 참조/슬롯을 변경하지 않음 |
| 카테고리·가족 그룹 대표 그림의 기존 반입/공통 사용 | 별도 기존 코드·정책 | 범위 밖, 신규 반입 없음 | 새 일반 첨부를 임의로 그룹 그림에 연결하지 않음 |
| PO/견적/도면/일일보고서 첨부, PPT·기존 보고서 내보내기 | 지원 대상 목록 밖/기존 gate 유지 | 범위 밖, 새로 활성화 안 함 | `mediaTarget` 종류는 item/category/request/project/movement뿐. `po` 등은 UI도 요청 안 함 |
| 실제 provider/bucket/권한 연결 여부 | 이번에 확인하지 않음 | 설정 변경 없음 | `server/index.ts`, `loadDevelopmentSharedMedia`의 기존 wiring을 읽기만 함 |

기존 권한 근거: `server/branches/media.ts`의 `guarded`가 활성 계정·현재
지점 membership·부모 기록·역할/소유자를 확인한다. 목록·업로드·내용·다운로드·삭제·ZIP·
작업결과 조회 모두 이 기존 서비스를 사용한다. `mediaRoutes.ts`는 내부 객체 키를
응답하지 않고 private/no-store와 nosniff를 설정한다. 서버는 수정하지 않았다.
버튼의 `canWrite`는 업무 편의 표시일 뿐 서버 권한을 대신하지 않는다.

## 3. 변경 목록과 후속 화면 작업 연결

- `lib/branchMedia.ts`: 기존 mediaMessages EN/KO/ES 확장, 오류 분류,
  인증 blob/다운로드/ZIP helper, 같은 파일 동시 업로드 단일화,
  파일 읽기·해시·응답 body 이후 세션 무효화 확인.
- `components/BranchAttachments.tsx`: 기존 컴포넌트 보완. 선택 props
  `canWrite`, `showCamera`; 기본 `kind`, `targetId` 유지.
  업로드/삭제 성공 전 임의 목록 제거 없음. 업무 초안은 소유/변경하지 않음.
- `components/BranchMediaImage.tsx`: 사진 상태와 object URL 수명 관리.
  선택 `compact`는 좁은 리스트/카트 썸네일용. 일반 URL을 지점 밖으로 프록시하지 않음.
- `components/BranchItemGallery.tsx`: 지점 전용 현재 권한 갤러리,
  대표 사진 지정·확대 유지, 원본 readOnly 유지. Field는 조회용.
- `components/BranchAttachmentDisclosure.tsx`: 펼친 기록만 조회하는 기존
  대상의 작은 진입점. 닫힌 목록의 모든 기록에 요청을 보내지 않음.
- `components/ImageLightbox.tsx`: 같은 인증 이미지/오류 표시 재사용.
- `pages/ItemDetails.tsx`: 지점만 새 갤러리/동일 첨부 컨트롤 사용;
  비지점 갤러리 기존 구현 유지.
- `pages/field/FieldInventory.tsx`, `FieldCartReview.tsx`: 지점 사진과
  상세 갤러리의 미디어 표시만 연결. 검색/수량/카트 계산·입력 동작 수정 없음.
- `pages/CategoryDetail.tsx`, `ProjectDetail.tsx`, `Transactions.tsx`,
  `pages/field/FieldRequestsList.tsx`: 위 표의 첨부 호스트만 추가.
  상태 전환/승인·취소·revision·요청 제출/출고 로직 수정 없음.

후속 Field/Admin 작업은 이 컴포넌트를 재사용하고 미디어 관련 새 문구를
다른 전역 번역/상태 체계로 복제하지 않는다. 해당 업무 화면의 전체 UX는
이번 작업에서 다루지 않았다.

`manifest.json`의 `currentRootSha256`와 현재 파일이 다르면 후보를 그대로
덮어쓰면 안 된다. 공통 화면 준비본 및 기존 다른 패치를 다시 적용하는
누적 패치가 아니다. 승인된 반영 시점에 변경된 호스트를 대조해야 한다.

## 4. 격리 검사와 화면 근거

최종 결과: 후보 TypeScript 통과, 브라우저 **92개 경우**, 실제 미디어
서비스/라우트와 모의 저장소 **9개 경우** 통과. 전후 비교 **12쌍**,
브라우저 예외 0건·예상하지 않은 외부 요청 0건. 원본 실행 파일의 해시가
변경되지 않았음을 확인했다. 경우 수는 아래 개별 시나리오 기준이며
반복 실행이나 예전 검사 수를 합산하지 않았다.

실행 명령:

```sh
env -i PATH="$PATH" LANG=C.UTF-8 NODE_ENV=test \
  node development/inventory-usability-media/verify.mjs
```

- 새 `/tmp` 작업본에 소스만 복사하고 준비본을 그곳에만 겹친다.
- 기존 설치된 TypeScript/esbuild/PostCSS/Tailwind/Playwright/Chromium만 사용한다.
- 실제 전체 후보의 TypeScript 검사. 코드·설정 입력 해시가 같은 검사만 재사용한다.
- 실제 미디어 서비스와 Express routes를 `guardStartupPlanOffline.cjs` 아래에서
  검사한다. HTTP listener 없이 기존 inMemoryMediaHttp 사용, 합성 계정,
  쿼리 계약 대역과 메모리 객체 저장소 사용.
- **쿼리 대역이므로 PostgreSQL SQL·트랜잭션·행 잠금 증거가 아니다.**
  이전 전체 DB/권한 검사 묶음을 반복하지 않았다.
- 실제 수정 UI·실제 branchTransport·기존 언어/테마 provider·실제 CSS를
  독립 브라우저에서 검사. 모든 통신은 합성 `.invalid` 문서/HTTP 모델뿐이다.
  이 HTTP 모델 검사는 실제 인증 세션/실제 provider 연동 증거가 아니다.
- 합성 입력 probe가 유지되는지 확인한다. 이것은 실제 전체 업무 폼 생명주기
  검사를 완료했다는 뜻이 아니다.
- 3개 언어·2개 테마·390/1280px의 같은 첨부 자료 전후 비교 12쌍.
  실제 앱 캡처가 아니며 전체 화면/모든 모바일 크기를 보장하지 않는다.
- 최신 시나리오 수/이름과 결과: `results.json`. 타입/서비스 로그와
  자체 포함 비교 HTML: `generated-artifacts/inventory-usability-media/`.
  검사 중 발견한 후보의 unknown JSX 타입 오류와 합성 테스트의 JSX/모듈
  형식·쿼리 대역 누락을 고친 뒤 최종 결과를 기록한다.

`--session-cases-only`는 준비본·기준 해시가 이전 성공 결과와 같은 경우에만
추가 세션/미확정 결과 경우를 검사하는 개발용 옵션이다. 기본 명령은 전체
이번 범위를 재현한다. 이전 서버 전체 검사 결과를 새 실행 결과로 합산하지 않는다.

실제 로그인 후 업무 흐름과 기존 시작 설정 테스트 실패는 **미해결/미검증으로 유지**한다.
화면 이동 대기시간도 이 작업으로 측정하거나 해결한 것이 아니다.

## 5. 실제 연결에 남은 설정·승인

1. **실행 코드 반영 시점 승인:** 현재 앱은 실행 중이므로 HMR/재조회가
   발생할 수 있다. 이번 준비본을 실행 소스로 적용하거나 서버를 재시작하지 않았다.
2. **대상별 실제 설정 확인 승인:** common/Savannah/Indiana 대상 매핑과
   현재 media provider 연결 상태를 승인된 범위에서 확인해야 한다.
   `loadDevelopmentSharedMedia`가 존재한다는 사실과 실제 활성화는 다르다.
   미설정이면 기존 private provider에 필요한 비공개 bucket·지점 전용
   접두 경로·조건부 immutable write/read 권한을 연결해야 한다.
   이번 작업은 환경변수/비밀값을 읽거나 설정하지 않았다.
3. **실제 저장소 작업 승인:** 실제 새 업로드·다운로드·논리 삭제·ZIP,
   권한 철회·실패 경로 검사는 대상·합성 파일·보존/정리 방식을 지정한 별도 승인
   아래 해야 한다. 기존 읽기/anonymous403 근거는 새 private write 성공 증거가 아니다.
   비공개 원본과 삭제 tombstone은 유지한다.
4. **기존 사진 범위:** 승인된 Indiana 카탈로그 그림과 Savannah 원본 자재
   사진은 기존 정확한 source/slot 정책만 사용한다. 타 지점 업무 사진,
   그룹/도면/견적/보고서 파일을 추정해 연결·복사·삭제하지 않는다.
   해당 대상은 종류·소유권·권한·서버 지원을 별도 승인해야 한다.
5. **현재 역할별 실환경 확인:** 승인 후 실제 계정에서 staff 본인 requested
   요청 변경, manager/viewer 조회 범위와 상태 변경 후 거절을 좁게 확인한다.
   이번에는 실제 직원 계정/세션을 사용하지 않았다.

자동 적용/DB 접속/seed/migration/backfill/sync/저장소 반입/재시작/배포
명령은 제공하거나 실행하지 않았다.
