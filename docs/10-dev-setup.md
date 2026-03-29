# 다시서기 정신건강 평가관리 시스템 로컬 개발환경 설정 가이드

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `01-screen-structure.md`, `02-db-design.md`, `03-api-spec.md`, `04-scale-json.md`, `05-backend-architecture.md`, `06-frontend-architecture.md`, `09-test-scenarios.md`를 기준으로,  
다시서기 정신건강 평가관리 시스템의 **로컬 개발환경 구성, 실행 순서, 초기 데이터 준비, 척도 JSON 배치, 기본 실행 규칙**을 실제 구현 가능한 수준으로 정리한 문서이다.

본 문서의 목적은 다음과 같다.

- 바이브 코딩 직전에 필요한 로컬 실행 기준을 고정한다.
- 백엔드, 프론트엔드, DB, 척도 JSON 파일의 위치와 연결 방식을 통일한다.
- 새 개발자가 문서만 보고 같은 로컬 환경을 재현할 수 있게 한다.
- 테스트 시나리오 실행을 위한 기본 계정/기초 데이터 구성을 함께 정리한다.
- 운영 환경 문서와 분리하여, 로컬 개발과 테스트에 필요한 설정만 우선 명확히 한다.

---

## 2. 적용 범위

이 문서는 아래 범위를 다룬다.

- 로컬 PC 개발환경
- 사내 테스트 서버에 올리기 전의 개발 실행 환경
- 백엔드/프론트엔드 동시 실행
- DB 생성 및 초기화
- 테스트용 사용자/대상자 더미 데이터
- 척도 JSON 배치 위치
- 백업 경로의 로컬 대체 설정

이 문서는 아래 범위를 직접 다루지 않는다.

- 실제 내부망 운영 배포 절차
- 운영 백업 정책 상세
- 운영 서버 계정/보안 정책
- 운영 로그 수집 체계
- 장애 대응 플레이북

위 내용은 다음 단계 문서인 `11-deployment.md` 에서 다룬다.

---

## 3. 로컬 개발환경 설계 원칙

### 3.1 문서와 코드의 단일 기준 유지
- 설계 문서의 기준을 그대로 코드 구조에 옮긴다.
- 로컬 개발환경도 문서와 충돌하지 않아야 한다.
- 특히 세션 인증, 척도 JSON 로딩, 세션 단위 저장 구조는 로컬에서도 동일하게 유지한다.

### 3.2 단순한 시작, 명확한 구조
- 초기 로컬 환경은 복잡한 인프라보다 빠르게 실행 가능한 구조를 우선한다.
- 단, 나중에 운영 환경으로 옮길 때 큰 구조 변경이 발생하지 않게 한다.

### 3.3 백엔드가 기준 원본을 가진다
- 척도 정의 원본은 백엔드 리소스 기준으로 둔다.
- 프론트는 척도 정의 API를 사용하고, 최종 계산은 항상 백엔드가 수행한다.
- 프론트는 로컬 preview를 할 수 있지만 정의 원본을 따로 관리하지 않는다.

### 3.4 테스트 가능한 상태를 기본으로 한다
- 로컬 환경은 “앱이 켜진다” 수준이 아니라, 최소한 로그인 / 대상자 등록 / 세션 저장 / 세션 상세 / 통계 조회까지 확인 가능한 상태를 목표로 한다.

---

## 4. 권장 프로젝트 디렉터리 구조

초기 구현은 아래 구조를 권장한다.

```text
mental-health-system/
├── backend/
│   ├── build.gradle
│   ├── settings.gradle
│   ├── src/main/java/...
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-local.yml
│   │   └── scales/
│   │       ├── common/
│   │       ├── phq9.json
│   │       ├── gad7.json
│   │       ├── mkpq16.json
│   │       ├── kmdq.json
│   │       ├── pss10.json
│   │       ├── isik.json
│   │       ├── auditk.json
│   │       └── iesr.json
│   └── src/test/java/...
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.development
│   ├── src/
│   └── public/
├── docs/
│   ├── 00-project-overview.md
│   ├── 01-screen-structure.md
│   ├── 02-db-design.md
│   ├── 03-api-spec.md
│   ├── 04-scale-json.md
│   ├── 05-backend-architecture.md
│   ├── 06-frontend-architecture.md
│   ├── 07-validation-rules.md
│   ├── 08-error-handling.md
│   ├── 09-test-scenarios.md
│   └── 10-dev-setup.md
├── scripts/
│   ├── init-db.sql
│   ├── seed-local.sql
│   └── reset-local-db.sql
├── local-backups/
└── README.md
```

### 권장 이유
- 백엔드와 프론트를 명확히 분리한다.
- 척도 정의 원본을 백엔드 리소스에 둔다.
- 문서는 `docs/` 아래에 고정해 찾기 쉽게 한다.
- `scripts/` 로 DB 초기화와 시드 입력을 반복 가능하게 만든다.
- `local-backups/` 로 운영용 백업 경로를 로컬에서 대체한다.

---

## 5. 필수 설치 항목

## 5.1 백엔드
- Java 21
- Gradle Wrapper 사용 권장
- IntelliJ IDEA 또는 VS Code + Java 확장

## 5.2 프론트엔드
- Node.js 20 LTS 권장
- npm 사용 권장
- VS Code 권장

## 5.3 데이터베이스
- MariaDB 10.11+ 또는 MySQL 8.x
- 로컬 접속 도구
  - DBeaver
  - HeidiSQL
  - MySQL Workbench 중 택1

## 5.4 기타
- Git
- UTF-8 편집 가능한 에디터
- 내부망 환경과 유사한 한글 파일명/경로 처리 확인 가능 OS

---

## 6. 권장 버전 기준

### 6.1 권장 버전
- Java: 21
- Spring Boot: 3.x
- Gradle: Wrapper 사용
- Node.js: 20 LTS
- npm: Node 설치 버전 사용
- React: 18+
- TypeScript: 5+
- MariaDB/MySQL: 현재 사내 테스트 환경과 맞추되, 로컬은 MariaDB 우선 권장

### 6.2 버전 관리 원칙
- 로컬마다 도구 버전이 달라서 생기는 오류를 줄이기 위해, 프로젝트 루트 `README.md` 에 최소 버전 표를 반드시 둔다.
- 가능하면 `.nvmrc` 또는 Volta 설정을 둔다.
- Java는 IDE 설정과 터미널 설정이 같은 버전을 가리키는지 확인한다.

---

## 7. 로컬 환경 변수 및 설정 파일 구조

## 7.1 백엔드 설정 파일 권장 구조

```text
backend/src/main/resources/
├── application.yml
├── application-local.yml
├── application-dev.yml
└── application-prod.yml
```

### application.yml 역할
- 공통 기본값
- profile 공통 설정
- JPA, Jackson, logging 기본 옵션

### application-local.yml 역할
- 로컬 DB 접속 정보
- 로컬 백업 경로
- 척도 JSON 기본 경로
- local 전용 로그 레벨

---

## 7.2 백엔드 application-local.yml 예시

```yaml
server:
  port: 8080
  servlet:
    session:
      timeout: 120m

spring:
  datasource:
    url: jdbc:mariadb://localhost:3306/mental_health_local?useUnicode=true&characterEncoding=utf8
    username: mental_user
    password: mental_pass
    driver-class-name: org.mariadb.jdbc.Driver

  jpa:
    hibernate:
      ddl-auto: update
    open-in-view: false
    properties:
      hibernate:
        format_sql: true

  jackson:
    time-zone: Asia/Seoul

logging:
  level:
    root: INFO
    com.dasisuhgi.mentalhealth: DEBUG

app:
  backup:
    root-path: ./local-backups
  scale:
    resource-path: classpath:/scales
```

### 로컬 설정 원칙
- 세션 타임아웃은 운영 기준과 동일하게 120분을 유지한다.
- 백업 경로는 로컬에서 실제 생성 가능한 상대경로로 둔다.
- 타임존은 `Asia/Seoul` 기준으로 통일한다.

---

## 7.3 프론트엔드 환경 변수 예시

`frontend/.env.development`

```env
VITE_API_BASE_URL=/api/v1
VITE_APP_TITLE=다시서기 정신건강 평가관리 시스템
```

### 원칙
- 개발 중에는 Vite proxy를 사용해 `/api` 경로를 백엔드 `localhost:8080` 으로 전달한다.
- 세션 쿠키 기반이므로 프론트가 직접 백엔드 절대주소를 하드코딩하지 않는 구성을 우선 권장한다.

---

## 7.4 Vite proxy 예시

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

### 이유
- 프론트와 백엔드 포트가 달라도 쿠키 기반 세션 개발이 단순해진다.
- CORS 설정 복잡도를 낮출 수 있다.

---

## 8. 데이터베이스 로컬 준비

## 8.1 로컬 DB 권장명
- DB Name: `mental_health_local`
- User: `mental_user`
- Password: `mental_pass`

### 예시 SQL
```sql
CREATE DATABASE mental_health_local CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'mental_user'@'localhost' IDENTIFIED BY 'mental_pass';
GRANT ALL PRIVILEGES ON mental_health_local.* TO 'mental_user'@'localhost';
FLUSH PRIVILEGES;
```

## 8.2 초기 전략 권장안
초기 바이브 코딩 단계에서는 아래 전략을 권장한다.

### 1단계
- JPA `ddl-auto=update` 로 빠르게 개발 시작

### 2단계
- 테이블 구조 안정화 후 `schema.sql` 또는 Flyway/Liquibase 로 전환

### 현재 추천
- 지금 문서 단계에서는 **1단계로 시작**하는 것이 가장 빠르다.
- 단, 엔터티가 안정되면 DB 구조를 마이그레이션 도구 기반으로 고정해야 한다.

---

## 8.3 로컬 DB 초기화 스크립트 권장 구성

```text
scripts/
├── init-db.sql
├── seed-local.sql
└── reset-local-db.sql
```

### init-db.sql 역할
- DB 생성
- 사용자 생성
- 권한 부여
- 기본 charset 설정

### seed-local.sql 역할
- 관리자/일반 사용자 계정 생성
- 테스트 대상자 생성
- 테스트 세션 또는 기초 참조 데이터 생성

### reset-local-db.sql 역할
- 로컬 DB를 비우고 다시 초기화

---

## 9. 척도 JSON 파일 배치 기준

## 9.1 배치 위치
척도 정의 파일은 아래 위치를 기준으로 둔다.

```text
backend/src/main/resources/scales/
```

세부 구조는 아래를 따른다.

```text
backend/src/main/resources/scales/
├── common/
│   ├── scale-registry.json
│   ├── option-sets.json
│   ├── alert-types.json
│   └── result-snapshot-schema.json
├── phq9.json
├── gad7.json
├── mkpq16.json
├── kmdq.json
├── pss10.json
├── isik.json
├── auditk.json
└── iesr.json
```

## 9.2 로컬 개발 규칙
- 척도 원본은 이 위치만 수정한다.
- 프론트 프로젝트 안에 척도 정의 원본 복사본을 두지 않는다.
- 프론트 preview 계산은 scale detail API 응답을 기준으로 구현한다.
- 서버 시작 시 preload 실패하면 앱을 띄우지 않는 방향을 권장한다.

## 9.3 체크리스트
- `scale-registry.json` 의 활성 척도 수와 개별 파일 수가 일치하는지 확인
- JSON 파일명과 `scaleCode` 가 일관적인지 확인
- `questionCount` 와 실제 items 수가 일치하는지 확인
- mKPQ-16은 이름만 보고 문항 수를 하드코딩하지 않도록 확인

---

## 10. 테스트용 시드 데이터 기준

로컬 개발환경은 아래 기본 테스트 데이터를 권장한다.

## 10.1 사용자 계정
`09-test-scenarios.md` 기준으로 아래 계정을 만든다.

1. `adminA`
   - role: ADMIN
   - status: ACTIVE

2. `userA`
   - role: USER
   - status: ACTIVE

3. `userB`
   - role: USER
   - status: ACTIVE

4. `pendingUser`
   - role: USER
   - status: PENDING

5. `inactiveUser`
   - role: USER
   - status: INACTIVE

6. `rejectedUser`
   - role: USER
   - status: REJECTED

## 10.2 대상자 데이터
1. 정상 대상자 A
   - status: ACTIVE
   - createdBy: userA

2. 정상 대상자 B
   - status: ACTIVE
   - createdBy: userB

3. 오등록 대상자 C
   - status: MISREGISTERED
   - createdBy: userA

4. 비활성 대상자 D
   - status: INACTIVE

## 10.3 세션 데이터
1. 정상 세션 S1
   - status: COMPLETED
   - createdBy: userA

2. 정상 세션 S2
   - status: COMPLETED
   - alert 포함

3. 오입력 세션 S3
   - status: MISENTERED
   - createdBy: userA

---

## 11. 비밀번호 및 시드 데이터 운영 규칙

## 11.1 로컬 공통 비밀번호 권장
초기 로컬 개발에서는 모든 테스트 계정에 같은 비밀번호를 써도 된다.

예:
- `Test1234!`

단, 아래 원칙을 지킨다.
- 운영 비밀번호와 절대 같지 않게 한다.
- seed SQL 또는 seed 코드에 평문이 아니라 해시를 넣는 방식을 권장한다.
- README 또는 팀 내부 메모에만 테스트 계정 정보를 남긴다.

## 11.2 시드 생성 방식 권장
아래 두 방식 중 하나를 택한다.

### 방식 A. SQL seed
- 빠르고 단순함
- 초기 화면 확인에 유리

### 방식 B. ApplicationRunner seed
- 비밀번호 해시 처리, 조건 분기, 중복 방지에 유리
- 환경별 seed 제어가 쉬움

### 현재 추천
- 초기 버전은 **ApplicationRunner + local profile 한정 실행**을 권장한다.

---

## 12. 백엔드 실행 절차

## 12.1 첫 실행 전 체크
1. Java 21 설치 확인
2. DB 생성 확인
3. `application-local.yml` 설정 확인
4. 척도 JSON 파일 존재 확인
5. `local-backups/` 폴더 생성 확인

## 12.2 실행 명령
프로젝트 루트 기준이 아니라 `backend/` 기준으로 실행한다.

```bash
./gradlew bootRun --args='--spring.profiles.active=local'
```

또는

```bash
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
```

## 12.3 실행 성공 확인
- 콘솔에 scale registry preload 성공 로그 출력
- `Tomcat started on port 8080`
- `/api/v1/auth/me` 비로그인 401 확인
- DB에 기본 테이블 생성 확인

---

## 13. 프론트엔드 실행 절차

## 13.1 첫 실행 전 체크
1. Node.js 설치 확인
2. `npm install` 수행
3. `.env.development` 생성 확인
4. Vite proxy 설정 확인

## 13.2 실행 명령

```bash
npm install
npm run dev
```

## 13.3 실행 성공 확인
- `http://localhost:5173` 접속 가능
- 로그인 화면 노출
- 로그인 성공 시 `/clients` 이동
- 세션 쿠키 기반 동작 확인

---

## 14. 개발 시작 기본 순서

실제 바이브 코딩은 아래 순서를 권장한다.

### 1단계
- backend: 공통 응답/예외/세션 인증
- frontend: 라우팅, 로그인, 앱 레이아웃

### 2단계
- backend: users, clients 엔터티/리포지토리/API
- frontend: 대상자 목록/상세/등록/수정

### 3단계
- backend: scale registry / scale detail API / scoring engine
- frontend: 척도 선택/입력/store/요약

### 4단계
- backend: assessment session save/detail
- frontend: 저장/상세/오입력 처리

### 5단계
- backend: records/statistics/admin
- frontend: 검사기록/통계/관리자 화면

---

## 15. 로컬 스모크 테스트 절차

로컬 환경이 정상인지 가장 빠르게 확인하는 순서다.

1. 백엔드 실행
2. 프론트 실행
3. `adminA` 로그인
4. 대상자 목록 진입
5. 신규 대상자 등록
6. 대상자 상세 진입
7. 검사 시작
8. PHQ-9 단일 척도 저장
9. 세션 상세 확인
10. 검사기록 목록 확인
11. 통계 화면 확인
12. 관리자 승인 대기/사용자 관리 진입 확인

### 통과 기준
- 위 흐름에서 500 오류가 없어야 한다.
- 저장 후 세션 상세까지 끊김 없이 이동해야 한다.
- 기본 목록에서 `MISREGISTERED`, `MISENTERED` 숨김 정책이 적용되어야 한다.

---

## 16. 로컬 개발 시 반드시 지킬 규칙

## 16.1 척도 정의 관련
- 척도 정의 원본은 백엔드 리소스만 수정한다.
- 프론트에서 총점 preview를 만들더라도 서버 계산 결과가 최종값이다.
- 척도 정의가 바뀌면 백엔드와 프론트 preview 둘 다 확인한다.

## 16.2 DB 관련
- 오입력/오등록은 delete가 아니라 상태값 변경으로 테스트한다.
- 세션 저장 실패 시 부분 저장이 남지 않는지 확인한다.
- 목록/통계 조회 시 기본 제외 정책을 항상 같이 확인한다.

## 16.3 프론트 관련
- 연락처는 대상자 상세 화면에서만 노출한다.
- 세션 메모는 요약 입력/상세 보기에서만 사용한다.
- 관리자 메뉴는 role 기반으로만 노출한다.
- 버튼 숨김만 믿지 말고 403 응답 처리도 반드시 만든다.

## 16.4 백엔드 관련
- 세션 저장은 반드시 단일 트랜잭션
- 검증은 컨트롤러 + 서비스 + scale engine 각 단계에서 책임 분리
- 로그는 운영 로그와 activity log를 구분

---

## 17. 로컬 로그 및 백업 경로 기준

## 17.1 로그 경로 권장
로컬에서는 아래처럼 단순하게 둔다.

```text
backend/logs/
```

또는

```text
./logs
```

### 원칙
- 운영 경로와 혼동되지 않는 로컬 전용 상대경로 사용
- Git ignore 처리

## 17.2 백업 경로 권장
```text
./local-backups
```

### 원칙
- 로컬 수동 백업 테스트가 실제 파일 생성까지 확인 가능해야 한다.
- 백업 성공/실패가 `backup_histories` 에 반영되는지 함께 확인한다.

---

## 18. Git 관리 권장 규칙

## 18.1 커밋 전 제외 파일
아래 파일은 커밋하지 않는다.

- `.env*` 중 민감값 포함 파일
- 로컬 DB dump
- `local-backups/`
- `logs/`
- IDE 개인 설정
- 운영 비밀번호 포함 설정 파일

## 18.2 권장 .gitignore 예시 항목

```gitignore
# backend
backend/build/
backend/.gradle/
backend/logs/

# frontend
frontend/node_modules/
frontend/dist/

# local env
frontend/.env.development.local
backend/src/main/resources/application-local-secret.yml

# local files
local-backups/
logs/
*.log
```

---

## 19. 로컬 개발용 체크리스트

## 19.1 최초 1회 체크리스트
- [ ] Java 21 설치
- [ ] Node.js 20 설치
- [ ] MariaDB/MySQL 설치
- [ ] 로컬 DB 생성
- [ ] 백엔드 `application-local.yml` 작성
- [ ] 프론트 `.env.development` 작성
- [ ] 척도 JSON 파일 배치
- [ ] seed 데이터 준비
- [ ] backend 실행 확인
- [ ] frontend 실행 확인

## 19.2 기능 개발 시작 전 체크리스트
- [ ] 로그인 가능
- [ ] 대상자 목록 조회 가능
- [ ] scale registry 로딩 성공
- [ ] 관리자/일반 사용자 시드 계정 존재
- [ ] local-backups 폴더 writable
- [ ] 기본 로그 파일 생성 확인

---

## 20. 자주 발생하는 로컬 이슈와 대응

## 20.1 세션 쿠키가 유지되지 않음
가능 원인
- Vite proxy 미설정
- Axios `withCredentials` 누락
- 백엔드 세션 설정 누락

대응
- proxy 설정 확인
- Axios 인스턴스 확인
- 로그인 후 Set-Cookie 확인

## 20.2 한글 깨짐
가능 원인
- DB charset 미설정
- JDBC URL 인코딩 설정 누락
- 에디터 인코딩 불일치

대응
- DB `utf8mb4`
- application-local.yml 확인
- 파일 UTF-8 저장

## 20.3 척도 JSON 로딩 실패
가능 원인
- 파일명 불일치
- `scaleCode` 오타
- `questionCount` 와 items 불일치
- optionSetRef 누락

대응
- 서버 시작 로그 확인
- JSON 검증 우선
- scale registry와 개별 파일 교차 확인

## 20.4 세션 저장은 되는데 상세에서 깨짐
가능 원인
- raw_result_snapshot 구조 불일치
- alert/answer 저장 누락
- detail DTO 매핑 누락

대응
- 저장 API 응답과 상세 API 응답 구조 비교
- session_scales / session_answers / session_alerts 데이터 확인

## 20.5 통계 수치가 맞지 않음
가능 원인
- MISENTERED 제외 조건 누락
- date range 기준 컬럼 혼용
- session 기준/scale 기준 집계 혼동

대응
- 통계 쿼리 where 절 점검
- session/session_scale 단위 차이 재확인

---

## 21. 추천 초기 작업 목록

로컬 환경을 만든 직후 아래 순서로 구현하는 것을 권장한다.

1. 로그인 API + 로그인 페이지
2. 대상자 목록/등록/상세
3. 척도 목록/상세 API
4. assessment draft store
5. 세션 저장 API
6. 세션 상세 페이지
7. 검사기록 목록
8. 통계 요약
9. 관리자 승인
10. 백업 실행/이력 조회

---

## 22. 바이브 코딩 전 최종 준비 상태

아래 상태면 로컬 개발환경 준비가 끝난 것으로 본다.

- 백엔드 local profile로 정상 기동
- 프론트 dev 서버 정상 기동
- 시드 계정으로 로그인 가능
- 대상자 등록 가능
- 최소 1개 척도로 세션 저장 가능
- 세션 상세 조회 가능
- 기본 통계 조회 가능
- 관리자 화면 진입 가능
- 로컬 백업 테스트 가능
- 척도 JSON 수정 후 서버 재기동으로 반영 가능

---

## 23. 초안 기준 최종 권장 사항

- 로컬 개발환경은 `backend / frontend / docs / scripts / local-backups` 구조를 권장한다.
- 백엔드는 Java 21 + Spring Boot + MariaDB/MySQL, 프론트는 React + TypeScript + Vite를 기준으로 한다.
- 척도 정의 원본은 `backend/src/main/resources/scales` 아래에 둔다.
- 프론트는 척도 정의 API를 사용하고, 최종 계산은 백엔드가 수행한다.
- 초기 DB 생성은 빠르게 시작하기 위해 local profile에서 JPA 자동 생성으로 시작하는 것을 허용한다.
- 시드 데이터는 `09-test-scenarios.md` 의 테스트 계정/대상자/세션 기준을 그대로 따른다.
- 세션 인증 개발 편의를 위해 Vite proxy를 기본으로 사용한다.
- 로컬 백업 경로는 `./local-backups`, 로컬 로그 경로는 `./logs` 또는 `backend/logs` 를 권장한다.

---

## 24. 다음 단계 연계

본 문서 다음 단계에서는 `11-deployment.md` 를 작성하는 것을 권장한다.

다음 문서에는 아래 내용을 포함한다.

- 내부망 서버 권장 배포 구조
- 운영용 application-prod 설정 원칙
- 백업 경로 및 로그 경로 운영 기준
- 운영 체크리스트
- 장애 대응 및 복구 절차
- 운영 전 최소 검수 항목

---

## 25. 결정사항 요약

- 로컬 개발환경은 backend / frontend 분리 구조로 구성한다.
- 척도 JSON 원본은 백엔드 리소스 경로에 둔다.
- 백엔드는 local profile로 실행한다.
- 프론트는 Vite proxy를 사용해 세션 기반 개발을 단순화한다.
- 초기 DB 생성은 빠른 개발을 위해 JPA 자동 생성으로 시작한다.
- 시드 데이터는 테스트 시나리오 문서의 계정/대상자/세션 구조를 따른다.
- 로컬 백업 경로는 `local-backups/` 를 사용한다.
- 로컬 환경 목표는 로그인, 대상자, 세션 저장, 세션 상세, 통계까지 확인 가능한 상태다.
