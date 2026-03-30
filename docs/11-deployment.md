# 다시서기 정신건강 평가관리 시스템 배포 및 운영 가이드

## 1. 문서 목적

본 문서는 `00-project-overview.md`, `02-db-design.md`, `03-api-spec.md`, `05-backend-architecture.md`, `08-error-handling.md`, `09-test-scenarios.md`, `10-dev-setup.md`를 기준으로,  
다시서기 정신건강 평가관리 시스템의 **내부망 배포 구조, 운영 환경 설정 원칙, 로그/백업 기준, 운영 전 체크리스트, 장애 대응 절차**를 실제 운영 가능한 수준으로 정리한 문서이다.

본 문서의 목적은 다음과 같다.

- 로컬 개발환경과 실제 내부망 운영환경을 구분한다.
- 운영 서버에 올릴 때 필요한 최소 배포 기준을 고정한다.
- 백업, 로그, 점검, 장애 대응 절차를 개발 문서와 분리해서 명확히 한다.
- 운영자가 실제로 무엇을 확인해야 하는지 체크리스트 기반으로 정리한다.
- 바이브 코딩 이후 “실행은 되지만 운영은 불안정한 상태”를 피하도록 기준을 만든다.

---

## 2. 적용 범위

이 문서는 아래 범위를 다룬다.

- 기관 내부망 서버 배포
- 운영용 백엔드/프론트엔드 구성
- 운영 DB 연결 기준
- 운영용 설정 파일 관리 원칙
- 로그 경로 / 백업 경로 / 파일 보존 기준
- 배포 전 검수 체크리스트
- 장애 발생 시 1차 대응 절차
- 운영 변경 및 재배포 기본 절차

이 문서는 아래 범위를 직접 다루지 않는다.

- 실제 기관 네트워크 장비 설정
- 방화벽/스위치/망분리 장비 설정
- AD/SSO 같은 조직 공통 인증 체계 연동
- OS 하드닝 상세
- 기관 보안정책 전체 문서
- 운영 배치 스크립트에 의한 서비스 시작/중지 자동화
- 운영 배치 스크립트에 의한 웹서버 재시작 또는 정적 파일 반영 완료 보장
- IIS/Nginx 설정 변경
- 운영 배치 스크립트 실행만으로 `backup_histories` 적재 보장

---

## 3. 운영 배포 설계 원칙

### 3.1 내부망 단독 운영 원칙
- 본 시스템은 기관 내부망에서만 접근 가능한 웹 시스템을 기준으로 한다.
- 외부 인터넷 공개를 전제로 설계하지 않는다.
- 운영 URL, DB 접속, 백업 경로, 로그 경로는 내부 자원 기준으로 관리한다.

### 3.2 백엔드 기준 진실값 원칙
- 운영 환경에서도 최종 점수/판정/경고 계산은 반드시 백엔드가 수행한다.
- 척도 JSON 원본은 운영 백엔드 리소스 기준으로만 관리한다.
- 프론트는 운영 중에도 정의 원본 복제본을 따로 가지지 않는다.

### 3.3 상태값 기반 안전 운영 원칙
- 대상자/세션 데이터는 삭제보다 상태값(`MISREGISTERED`, `MISENTERED`) 기반 운영을 유지한다.
- 운영 DB에서도 물리 삭제를 일상적 처리수단으로 사용하지 않는다.
- 운영 배포 후 데이터 정정 절차는 “오입력 처리 + 재입력”을 기준으로 한다.

### 3.4 로그와 백업의 분리 원칙
- 애플리케이션 로그와 업무 활동 로그를 분리한다.
- 파일 로그는 장애 분석용이다.
- DB 활동 로그는 관리자 조회용이다.
- 백업 파일은 로그 경로와 같은 위치에 두지 않는다.

### 3.5 단순하고 복구 가능한 배포 원칙
- 운영 배포는 복잡한 마이크로서비스 구조보다 단일 시스템 운영을 우선한다.
- 장애 발생 시 빠르게 중단/복구할 수 있는 구조를 우선한다.
- 운영 절차는 “누가 보더라도 같은 순서로 반복 가능”해야 한다.

---

## 4. 권장 운영 배포 구조

초기 운영은 아래와 같은 단일 서버 또는 2계층 구조를 권장한다.

## 4.1 권장안 A: 단일 서버 + 별도 DB 서버
가장 추천하는 구조다.

```text
[사용자 PC]
   ↓ 내부망 접속
[운영 웹/앱 서버]
  - frontend 정적 파일
  - backend Spring Boot
  - 로그 저장
  - 백업 스크립트 실행
   ↓ 내부망 DB 연결
[운영 DB 서버]
  - MariaDB/MySQL
```

### 이유
- 운영과 백업 책임이 분명하다.
- 앱 재배포와 DB 운영을 분리할 수 있다.
- 장애 원인 파악이 비교적 쉽다.

## 4.2 권장안 B: 단일 서버 통합
초기 기관 환경이 작고 리소스가 제한적이면 허용 가능하다.

```text
[사용자 PC]
   ↓ 내부망 접속
[통합 운영 서버]
  - frontend 정적 파일
  - backend Spring Boot
  - MariaDB/MySQL
  - 로그 저장
  - 백업 실행
```

### 주의점
- 서버 장애 시 앱과 DB가 동시에 영향받는다.
- 디스크 공간 관리가 더 중요하다.
- 로그/백업/DB 데이터 경로를 명확히 분리해야 한다.

## 4.3 비권장 구조
- 프론트와 백엔드 개발 서버를 운영처럼 계속 띄우는 방식
- 운영 DB와 백업 파일을 같은 폴더에 두는 방식
- 운영 척도 JSON을 프론트와 백엔드 양쪽에서 각각 수정하는 방식
- 실행파일과 로그/업로드/백업 파일이 한 폴더에 뒤섞인 방식

---

## 5. 권장 운영 디렉터리 구조

운영 서버 기준으로 아래 구조를 권장한다.

```text
<app-home>/
├── app/
│   ├── backend/
│   │   ├── mental-health-app.jar
│   │   ├── application-prod.yml
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
│   └── frontend/
│       └── dist/
├── logs/
│   ├── application/
│   └── access/
├── backups/
│   ├── db/
│   ├── app-config/
│   └── release/
├── scripts/
│   ├── run-backup.bat
│   ├── deploy-backend.bat
│   ├── deploy-frontend.bat
│   └── health-check.bat
└── temp/
```

### 구조 원칙
- 실행 파일은 `app/`
- 설정 파일은 backend 실행 위치 근처
- 로그는 `logs/`
- 백업은 `backups/`
- 운영 스크립트는 `scripts/`
- 임시 파일은 `temp/`

### 주의사항
- `logs/` 와 `backups/` 는 별도 보존 정책을 적용한다.
- 운영 서버 사용자에게 필요한 경로만 권한을 부여한다.
- jar와 로그 파일을 같은 폴더에 장기간 쌓아두지 않는다.

### 운영 스크립트 반영 기준
운영 문서에서 `scripts/` 는 아래 4개 스크립트만 배포/점검 보조 도구로 본다.

- `scripts/health-check.bat`
  - `/api/v1/health` 응답을 확인하는 점검 스크립트다.
  - 인자 없이 실행하면 기본 대상 `http://127.0.0.1:8080/api/v1/health` 를 확인한다.
  - 인자 1에는 base URL (`http://127.0.0.1:8080/api/v1`) 또는 full `/health` URL (`http://127.0.0.1:8080/api/v1/health`) 을 받을 수 있다.
  - 인자 1은 `http://` 또는 `https://` URL만 지원한다.
- `scripts/run-backup.bat`
  - 운영자가 직접 DB dump 파일을 생성할 때 사용하는 보조 스크립트다.
  - 명령행 인자는 받지 않고 환경 변수만 사용한다.
  - `APP_BACKUP_ROOT_PATH`, `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` 가 필요하다.
  - `.sql` 파일 생성까지가 범위이며, `/api/v1/admin/backups/run` 대체 용도가 아니다.
  - `backup_histories` 적재와 관리자 활동 로그 기록은 수행하지 않는다.
- `scripts/deploy-backend.bat`
  - 새 backend jar 를 `app/backend/mental-health-app.jar` 위치에 배치하는 보조 스크립트다.
  - 인자 1로 배포 대상 jar 파일 경로를 필수로 받는다.
  - 인자 1은 실제 존재하는 `.jar` 파일이어야 하며, 디렉터리 경로는 허용하지 않는다.
  - `APP_HOME` 이 있으면 해당 경로를, 없으면 스크립트 기준 상위 경로를 앱 루트로 해석한다.
  - 기존 backend 프로세스는 운영자가 먼저 수동 중지해야 하며, 스크립트는 서비스 시작/중지를 수행하지 않는다.
  - 기존 jar 가 있으면 `app/backend/backup/mental-health-app-YYYYMMDD-HHMMSS.jar` 형식으로 백업한다.
- `scripts/deploy-frontend.bat`
  - 새 frontend `dist` 를 `app/frontend/dist` 위치에 배치하는 보조 스크립트다.
  - 인자 1로 배포 대상 `dist` 디렉터리 경로를 필수로 받으며, `index.html` 가 존재하고 해당 경로가 디렉터리가 아닌 실제 파일인지 검증한다.
  - `APP_HOME` 이 있으면 해당 경로를, 없으면 스크립트 기준 상위 경로를 앱 루트로 해석한다.
  - 기존 `dist` 는 `backups/release/frontend-dist-YYYYMMDD-HHMMSS/` 아래에 백업하고, `temp/deploy-frontend-YYYYMMDD-HHMMSS` 경로를 거쳐 최종 교체한다.
  - 웹서버 재시작, health check 호출, IIS/Nginx 설정 반영, cache invalidation 확인은 별도 운영 절차를 따른다.

- 4개 스크립트 모두 성공 시 종료코드 `0`, 실패 시 `0` 이외 값을 반환한다.

아래 작업은 이번 스크립트 범위에 포함되지 않는다.

- 서비스 시작/중지
- 백엔드 프로세스 재기동
- 웹서버 재시작
- IIS/Nginx 설정 변경
- `backup_histories` 적재

즉, 배포 절차에서 스크립트는 파일 배치와 상태 확인을 돕는 수준이며, 서비스 제어와 운영 검수 판단은 운영자가 별도 절차로 수행한다.

---

## 6. 운영 기술 구성 권장안

## 6.1 백엔드
- Java 21
- Spring Boot 실행 jar
- 프로필: `prod`
- 세션 기반 인증 유지
- 백업 스케줄링 활성화
- 로그 파일 저장 활성화

## 6.2 프론트엔드
초기 운영은 아래 두 방식 중 하나를 권장한다.

### 방식 A. 백엔드가 정적 파일 서빙
- 운영 단순성 높음
- 구성 요소 수가 적음
- 내부망 운영에 적합

### 방식 B. 별도 웹서버(Nginx/IIS 등)에서 정적 파일 서빙
- 프론트 교체가 쉬움
- 캐시/압축/리버스 프록시 제어가 쉬움
- 기관 서버 운영 표준이 있으면 더 적합

### 현재 추천
- 초기 운영은 **방식 A 또는 기관 표준 웹서버 방식 중 더 단순한 쪽**을 선택한다.
- 별도 표준이 없다면 백엔드와 함께 정적 서빙하는 구조가 가장 빠르다.

## 6.3 데이터베이스
- MariaDB 또는 MySQL
- 운영 DB는 로컬 개발 DB와 분리
- 운영 계정은 최소 권한 원칙 적용
- 백업 자동화 가능해야 함

---

## 7. 운영 설정 파일 원칙

## 7.1 application-prod.yml 분리
운영 환경은 반드시 `application-prod.yml` 또는 동등한 운영 설정 파일을 분리한다.

### 이유
- local/dev 설정과 운영 설정을 명확히 구분하기 위해
- 운영 비밀번호/경로를 개발 설정에 섞지 않기 위해
- 배포 시 실수로 local 설정이 올라가는 것을 방지하기 위해

## 7.2 운영 설정에 포함할 항목
### application-prod.yml 실제 설정 키
- `server.port`
- `server.servlet.session.timeout`
- `server.forward-headers-strategy`
- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`
- `spring.datasource.driver-class-name`
- `spring.jpa.hibernate.ddl-auto`
- `spring.jpa.open-in-view`
- `spring.jpa.properties.hibernate.format_sql`
- `spring.jackson.time-zone`
- `spring.jackson.serialization.write-dates-as-timestamps`
- `logging.file.path`
- `logging.level.root`
- `logging.level.com.dasisuhgi.mentalhealth`
- `app.organization.name`
- `app.scale.resource-path`
- `app.export.temp-path`
- `app.backup.root-path`
- `app.backup.db-dump-command`
- `app.security.trust-proxy-headers`
- `app.seed.enabled`

### 운영 관리 항목
- scale JSON 파일 배치 위치
- 운영 스크립트가 사용하는 release backup 위치
- 운영 작업용 임시 디렉터리
- 운영 스크립트 실행에 필요한 환경 변수 값과 실제 서버 경로 값

## 7.3 운영 비밀정보 관리 원칙
- DB 비밀번호, 민감한 경로, 계정 정보는 Git에 직접 커밋하지 않는다.
- 운영용 비밀값은 아래 중 하나로 분리한다.
  - 환경 변수
  - 서버 별도 설정 파일
  - 운영자만 접근 가능한 외부 secret 파일

### 금지
- 운영 비밀번호를 `application.yml` 기본 파일에 직접 하드코딩
- local/prod 설정을 한 파일에서 주석 전환으로 관리
- 개인 PC에 있는 설정 파일을 운영에 그대로 복사

---

## 8. application-prod.yml 권장 예시

```yaml
server:
  port: ${APP_SERVER_PORT:8080}
  servlet:
    session:
      timeout: ${APP_SESSION_TIMEOUT:120m}
  forward-headers-strategy: ${APP_FORWARD_HEADERS_STRATEGY:none}

spring:
  datasource:
    url: ${APP_DB_URL:jdbc:mariadb://DB_HOST_PLACEHOLDER:3306/DB_NAME_PLACEHOLDER}
    username: ${APP_DB_USERNAME:DB_USERNAME_PLACEHOLDER}
    password: ${APP_DB_PASSWORD:DB_PASSWORD_PLACEHOLDER}
    driver-class-name: ${APP_DB_DRIVER:org.mariadb.jdbc.Driver}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
    properties:
      hibernate:
        format_sql: false
  jackson:
    time-zone: Asia/Seoul
    serialization:
      write-dates-as-timestamps: false

logging:
  file:
    path: ${APP_LOG_FILE_PATH:LOG_PATH_PLACEHOLDER}
  level:
    root: INFO
    com.dasisuhgi.mentalhealth: INFO

app:
  organization:
    name: ${APP_ORGANIZATION_NAME:다시서기 정신건강 평가관리 시스템}
  scale:
    resource-path: ${APP_SCALE_RESOURCE_PATH:classpath:scales}
  export:
    temp-path: ${APP_EXPORT_TEMP_PATH:./tmp/exports}
  backup:
    root-path: ${APP_BACKUP_ROOT_PATH:BACKUP_ROOT_PATH_PLACEHOLDER}
    db-dump-command: ${APP_DB_DUMP_COMMAND:${APP_BACKUP_DB_DUMP_COMMAND:mariadb-dump}}
  security:
    trust-proxy-headers: ${APP_TRUST_PROXY_HEADERS:false}
  seed:
    enabled: false
```

### 운영 설정 원칙
- 운영에서는 `ddl-auto=validate` 를 권장한다.
- 운영 로그는 DEBUG 대신 INFO 중심으로 시작한다.
- reverse proxy 환경이면 `server.forward-headers-strategy` 와 `app.security.trust-proxy-headers` 값을 함께 점검한다.
- `app.scale.resource-path` 는 실제 지원되는 설정이며, `classpath:scales` 또는 `<app-home>/app/backend/scales` 같은 filesystem 경로를 사용할 수 있다.
- `app.export.temp-path` 는 실제 지원되는 설정이며, CSV export 시 사용할 writable 임시 디렉터리를 가리켜야 한다.

---

## 9. 운영 DB 관리 원칙

## 9.1 DB 생성/변경 원칙
- 운영 DB 구조 변경은 로컬에서 충분히 검증 후 반영한다.
- 운영에서는 JPA 자동 생성에 의존하지 않는다.
- 운영 구조 변경은 스크립트 또는 마이그레이션 도구로 통제한다.

## 9.2 권장 단계
### 초기 배포 전
- `schema.sql` 또는 Flyway/Liquibase 기반 구조 고정

### 운영 시작 후
- 모든 스키마 변경은 버전 관리된 SQL 또는 마이그레이션 파일로 관리

## 9.3 운영 DB 계정 원칙
- 앱 전용 계정 사용
- root 계정 직결 사용 금지
- 운영 백업 계정이 별도로 필요하면 최소 권한 원칙 적용

## 9.4 운영 전 필수 확인
- charset: `utf8mb4`
- timezone 일관성
- 인덱스 생성 여부
- backup user 또는 backup script 권한 확인

---

## 10. 척도 JSON 운영 반영 원칙

## 10.1 운영 척도 정의 위치
운영 서버에서는 아래 중 한 곳을 기준으로 고정한다.

1. jar 내부 리소스
2. 운영 외부 파일 경로

### 현재 추천
- **운영 외부 파일 경로 방식**을 권장한다.
- 운영 외부 파일 경로를 쓰면 `app.scale.resource-path` 를 `<app-home>/app/backend/scales` 같은 실제 서버 경로로 맞춘다.

### 이유
- 척도 정의 변경 시 전체 jar 재빌드 없이 추적 가능
- 운영자가 현재 사용 중인 정의 버전을 눈으로 확인 가능
- 백업 시 설정 파일과 함께 보존하기 쉬움

## 10.2 운영 반영 절차
1. 로컬/테스트 환경에서 척도 정의 검증
2. 서버 시작 테스트 통과 확인
3. 변경 파일 백업
4. 운영 경로에 새 JSON 배치
5. 앱 재기동
6. scale registry 로딩 성공 로그 확인
7. 척도 상세 API 확인
8. 샘플 세션 저장 검증

## 10.3 변경 통제 원칙
- 운영 척도 JSON을 직접 편집한 경우 변경 이력을 남긴다.
- 문항 수, option set, scoring rule이 바뀌면 반드시 회귀 테스트를 다시 수행한다.
- 척도 JSON 변경은 “사소한 설정 변경”이 아니라 운영 변경으로 취급한다.

---

## 11. 로그 운영 기준

## 11.1 로그 분리
운영 로그는 최소 아래 2종으로 나눈다.

### 1) 애플리케이션 로그
- 서버 시작/종료
- 예외
- 백업 결과
- 척도 로딩 결과
- 주요 경고

### 2) DB 활동 로그
- 로그인
- 승인/반려
- 대상자 등록/수정
- 세션 저장
- 세션 오입력 처리
- 출력
- 수동 백업

## 11.2 파일 로그 경로 권장
```text
<app-home>/logs/application/
```

필요 시 접근 로그를 분리한다.

```text
<app-home>/logs/access/
```

## 11.3 로그 보존 정책 권장안
초기 운영 권장:
- application 로그: 30일 보관
- access 로그: 30일 보관
- 압축 로그: 90일 보관
- 활동 로그(DB): 업무 필요에 따라 장기 보관

## 11.4 로그에 남기지 말아야 할 것
- 비밀번호 원문
- 세션 쿠키 값
- 전체 개인정보 덤프
- 전체 문항응답 원문 전부
- DB 계정 비밀번호
- 내부 파일 시스템 전체 경로를 과도하게 노출하는 메시지

---

## 12. 백업 운영 기준

## 12.1 백업 대상
최소 백업 대상은 아래와 같다.

1. 운영 DB
2. 운영 척도 JSON 및 설정 파일
3. 필요한 경우 정적 프론트 배포본
4. 배포 스크립트
5. 운영 체크리스트/버전 메모

## 12.2 권장 백업 경로
```text
<app-home>/backups/
├── db/
├── app-config/
└── release/
```

## 12.3 권장 백업 주기
- 자동 DB 백업: 매일 1회
- 수동 백업: 배포 전 / 구조 변경 전 / 척도 JSON 변경 전
- 설정/척도 파일 백업: 변경 시마다

## 12.4 백업 파일 명명 규칙 예시
```text
db-backup-20260329-230000.sql
app-config-backup-20260329-230500.zip
mental-health-app-20260329-231000.jar
frontend-dist-20260329-231500/
```

## 12.5 백업 성공 검증 원칙
- 파일 생성만으로 끝내지 않는다.
- `scripts\run-backup.bat` 사용 시에는 `.sql` 파일 생성 여부, 파일 크기, 저장 경로를 확인한다.
- 관리자 화면/API 기반 수동 백업을 사용한 경우에만 `backup_histories` 에 성공/실패 기록이 남는지 확인한다.
- 관리자 화면/API 기반 수동 백업을 사용한 경우 가능하면 `backupMethod` 가 의도한 방식(`DB_DUMP` 또는 `SNAPSHOT`)인지 확인한다.
- 주기적으로 복원 가능성 검증을 한다.

## 12.6 백업 실패 시 대응 기본 원칙
- 실패 즉시 운영 로그 확인
- 디스크 공간 확인
- 경로 쓰기 권한 확인
- DB dump 명령 실패 여부 확인
- 같은 날 수동 백업 1회 재시도
- 실패 지속 시 배포/변경 작업 중지

## 12.7 현재 구현 기준 백업 방식
### 12.7.1 `scripts\run-backup.bat` 기준
- 운영자 직접 DB dump 파일 생성 보조 스크립트다.
- `APP_BACKUP_ROOT_PATH`, `APP_DB_URL`, `APP_DB_USERNAME`, `APP_DB_PASSWORD` 값을 사용한다.
- dump command 는 `APP_DB_DUMP_COMMAND` 또는 PATH 의 `mariadb-dump` / `mysqldump` 를 사용한다.
- 성공 시 `.sql` dump 파일 생성까지가 범위다.
- `backup_histories` 적재, 관리자 활동 로그 기록, `SNAPSHOT` fallback 은 수행하지 않는다.

### 12.7.2 관리자 화면/API 기반 백업 기준
- `BackupService` 를 통해 수동 백업을 실행한다.
- MariaDB/MySQL: preflight 통과 + dump command 사용 가능 시 `DB_DUMP`
- MariaDB/MySQL: dump command 미탐지 시 `SNAPSHOT` fallback
- H2/기타: `SNAPSHOT`
- API 응답과 `backup_histories` 에서 `backupMethod`, 상태, 파일 경로를 확인할 수 있다.

## 12.8 복구 개요
- `DB_DUMP`: 생성된 `.sql` 파일을 대상 DB 에 import 한다.
- `SNAPSHOT`: 설정/척도 JSON/메타데이터 확인용이며 DB restore 파일은 아니다.

---

## 13. 배포 단위 및 릴리스 원칙

## 13.1 백엔드 배포 단위
- versioned jar 1개
- 운영 설정 파일
- 운영 척도 JSON 세트
- 필요 시 DB 마이그레이션 스크립트

## 13.2 프론트 배포 단위
- 빌드된 정적 파일(dist)
- 버전 메모
- API base 경로 확인

## 13.3 릴리스 단위 원칙
아래 변경은 같은 릴리스 묶음으로 취급한다.
- 백엔드 코드
- 프론트 빌드 결과
- DB 변경 스크립트
- 척도 JSON 변경
- 설정 파일 변경

### 이유
- 운영에서 “버전 섞임”을 막기 위해서다.

---

## 14. 배포 전 필수 체크리스트

## 14.1 코드/문서 기준
- [ ] P0 테스트 100% 통과
- [ ] 세션 저장/롤백 검증 완료
- [ ] 오입력/오등록 기본 숨김 검증 완료
- [ ] 관리자 승인/백업 최소 1회 검증 완료
- [ ] 운영용 척도 JSON 세트 확정
- [ ] 변경 문서 반영 완료

## 14.2 백엔드 기준
- [ ] `prod` 설정 파일 준비 완료
- [ ] DB 접속 정보 점검 완료
- [ ] reverse proxy 환경이면 `APP_TRUST_PROXY_HEADERS=true` 적용 여부 점검
- [ ] `/api/v1/health` 가 DB/scale registry 포함 `UP` 응답
- [ ] 운영 로그 경로 존재
- [ ] 운영 백업 경로 존재
- [ ] 운영 temp 경로 존재
- [ ] 척도 JSON 파일 preload 테스트 완료

## 14.3 프론트 기준
- [ ] 운영 빌드 생성 완료
- [ ] 로그인/대상자/세션/통계 핵심 화면 스모크 테스트 완료
- [ ] role 기반 메뉴 노출 점검 완료
- [ ] 민감정보 노출 기준 점검 완료

## 14.4 운영 준비 기준
- [ ] 배포 전 수동 백업 완료 (`scripts\run-backup.bat` 또는 관리자 수동 백업 기준)
- [ ] 복구용 직전 버전 보관
- [ ] 장애 연락 담당자 확인
- [ ] 배포 시간대 확정
- [ ] 배포 후 검수 담당자 지정

---

## 15. 권장 배포 절차

배포 결과 기록은 [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 를 참조해 `docs/deploy-results/YYYY-MM-DD.md` 에 남긴다.
검증 환경에서 미리 확인한 성공 항목은 같은 문서의 `검증 환경 결과` 에, 실제 운영 서버 반영과 배포 후 확인 결과는 `실제 운영 배포 결과` 에 분리 기록한다.

## 15.1 배포 전
1. 운영 DB 수동 백업 실행
2. 척도 JSON / 설정 파일 백업
3. 현재 운영 버전 백업
4. 배포 대상 파일 무결성 확인
5. 배포 공지 또는 내부 공유

예시 명령:

```powershell
$env:APP_BACKUP_ROOT_PATH = "<backup-root-path>"
$env:APP_DB_URL = "<jdbc-url>"
$env:APP_DB_USERNAME = "<db-username>"
$env:APP_DB_PASSWORD = "<db-password>"
$env:APP_DB_DUMP_COMMAND = "<dump-command-or-path>"
scripts\run-backup.bat
```

주의:
- `APP_DB_DUMP_COMMAND` 는 PATH 에 `mariadb-dump` 또는 `mysqldump` 가 잡혀 있으면 생략 가능하다.
- 이 스크립트는 운영자용 직접 DB dump 파일 생성 보조만 수행한다.
- `backup_histories` 적재 확인이 필요하면 관리자 화면/API 기반 수동 백업을 별도로 수행한다.

기록:
- 배포 직전 검증 환경에서 다시 확인한 테스트/백업 결과는 `docs/deploy-results/YYYY-MM-DD.md` 의 `검증 환경 결과` 에 기록한다.
- 실제 운영 서버에서 수행한 배포 전 백업, 설정 확인, 배포 시작 준비 상태는 같은 문서의 `실제 운영 배포 결과` 에 기록한다.

## 15.2 배포 중
1. 사용자 사용 중지 안내
2. 기존 앱 프로세스 중지
3. 새 jar 배치
4. 새 프론트 빌드 반영
5. 설정 파일/척도 JSON 최종 확인
6. 앱 재기동
7. 기동 로그 확인

예시 명령:

```powershell
$env:APP_HOME = "<app-home>"
scripts\deploy-backend.bat "<release-jar-path>"
scripts\deploy-frontend.bat "<release-dist-path>"
```

주의:
- `scripts\deploy-backend.bat` 는 backend jar 배치 보조만 수행하므로, 기존 프로세스 중지와 새 프로세스 시작은 운영자가 별도 수행해야 한다.
- `scripts\deploy-backend.bat` 는 인자 1로 전달한 실제 `.jar` 파일을 `app\backend\mental-health-app.jar` 로 교체하고, 기존 jar 가 있으면 `app\backend\backup\mental-health-app-YYYYMMDD-HHMMSS.jar` 형식으로 백업한다.
- `scripts\deploy-frontend.bat` 는 인자 1로 전달한 `dist` 디렉터리를 `app\frontend\dist` 로 교체하며, `index.html` 가 존재하고 디렉터리가 아닌 실제 파일인지 확인한다.
- `scripts\deploy-frontend.bat` 는 기존 `dist` 를 `backups/release/frontend-dist-YYYYMMDD-HHMMSS/` 아래에 백업하고 `temp/deploy-frontend-YYYYMMDD-HHMMSS` 경유로 교체하지만, 웹서버 재시작, health check 호출, IIS/Nginx 설정 반영, cache invalidation 확인은 별도 운영 절차로 수행해야 한다.
- `scripts\deploy-frontend.bat` 실행 성공만으로 정적 파일 서비스 전환 완료까지 보장하지는 않는다.

기록:
- 실제 운영 반영을 수행했다면 배포 시작 시각, 완료 시각, 담당자, 반영 대상 버전/커밋, 배포 중 오류 여부를 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 기록한다.
- 검증 환경에서 파일 배치 절차를 리허설한 경우는 실제 운영 배포 성공으로 기록하지 않고 `검증 환경 결과` 에만 남긴다.

## 15.3 배포 후
1. 로그인 확인
2. `scripts/health-check.bat` 또는 `GET /api/v1/health` 확인
3. 대상자 목록 확인
4. 대상자 상세 확인
5. 8종 중 최소 2종 선택한 샘플 세션 저장 확인
6. 세션 상세/print view/통계 확인
7. CSV export 확인
8. 관리자 승인/반려 및 사용자 상태/역할 변경 확인
9. 관리자 로그/백업 이력 조회 확인
10. 로그 오류 여부 확인

예시 명령:

```powershell
scripts\health-check.bat
scripts\health-check.bat "http://127.0.0.1:8080/api/v1"
scripts\health-check.bat "http://127.0.0.1:8080/api/v1/health"
```

주의:
- `scripts\health-check.bat` 는 무인자 실행 시 기본 health URL 을 확인한다.
- 인자 1은 base URL 과 full `/health` URL 둘 다 받을 수 있다.

기록:
- 실제 운영 반영 직후 수행한 로그인/세션 저장/통계/백업/health 결과는 `docs/deploy-results/YYYY-MM-DD.md` 의 `실제 운영 배포 결과` 에 기록한다.
- 검증 환경에서 같은 스모크 테스트가 성공했더라도, 실제 운영 서버에서 다시 확인하기 전에는 실제 운영 배포 성공으로 보지 않는다.

---

## 16. 배포 후 스모크 테스트 권장 순서

운영 반영 직후 아래 순서를 반드시 수행한다.

1. `adminA` 또는 운영 관리자 로그인
2. 대상자 목록 조회
3. 대상자 상세 조회
4. 척도 목록 조회
5. 최소 2종 멀티 척도 샘플 세션 저장
6. 세션 상세 조회
7. print view 조회
8. 검사기록 목록 조회
9. 통계 summary/scales/alerts 조회
10. CSV export 조회
11. 관리자 승인/반려 조회
12. 관리자 사용자 상태/역할 변경
13. 관리자 로그 조회
14. 수동 백업 실행 또는 백업 이력 조회
15. `/api/v1/health` 확인

### 통과 기준
- 500 에러 없음
- 세션 저장부터 상세 이동까지 정상
- 기본 숨김 정책 적용
- 관리자 기능 접근 정상

---

## 17. 장애 대응 절차

## 17.1 장애 등급 간단 분류
### P1
- 로그인 불가
- 세션 저장 불가
- 전체 서비스 접속 불가
- DB 연결 불가

### P2
- 통계만 실패
- 관리자 백업만 실패
- 특정 화면 일부 오류
- 특정 기능만 느림

### P3
- 경미한 UI 오류
- 로그 메시지 이상
- 비핵심 화면 표시 문제

## 17.2 공통 1차 대응 절차
1. 장애 시간 기록
2. 영향 범위 확인
3. 최근 배포 여부 확인
4. application 로그 확인
5. `scripts\health-check.bat` 또는 `/api/v1/health` 로 앱/DB/scale registry 상태 확인
6. 디스크 공간 확인
7. 백업/로그 경로 접근 가능 여부 확인
8. 즉시 롤백 필요 여부 판단

## 17.3 로그인 불가 시
- 세션 설정 확인
- auth 관련 예외 로그 확인
- DB user 상태 확인
- 최근 배포된 설정 파일 차이 확인

## 17.4 세션 저장 불가 시
- validation/business exception 로그 확인
- scale registry preload 상태 확인
- DB 쓰기 가능 여부 확인
- `assessment_sessions` / `session_scales` 부분 저장 흔적 확인

## 17.5 통계 오류 시
- 최근 오입력 처리 여부 확인
- 통계 쿼리 오류 로그 확인
- date range 파라미터 확인
- 운영 DB 인덱스 상태 확인

## 17.6 백업 실패 시
- 디스크 공간 확인
- 백업 경로 존재/쓰기 권한 확인
- DB dump 명령어 동작 확인
- `scripts\run-backup.bat` 사용 시 콘솔 출력과 종료 코드 확인
- 관리자 화면/API 기반 수동 백업이면 preflight summary 확인
- 관리자 화면/API 기반 수동 백업이면 `backup_histories` 실패 사유 확인

---

## 18. 롤백 기준 및 절차

## 18.1 롤백이 필요한 상황
- 로그인/세션 저장 같은 핵심 기능이 배포 후 즉시 실패
- 운영 DB 마이그레이션 이후 주요 오류 발생
- 척도 JSON 변경으로 저장/상세가 깨짐
- 배포 후 500 오류가 연속적으로 발생

## 18.2 롤백 기본 절차
1. 새 버전 프로세스 중지
2. 직전 안정 버전 jar 복원
3. 직전 프론트 빌드 복원
4. 변경된 척도 JSON/설정 파일 복원
5. 필요 시 DB 복구 여부 판단
6. 앱 재기동
7. 핵심 스모크 테스트 재실행

## 18.3 주의사항
- DB 구조가 변경된 배포는 단순 jar 롤백만으로 끝나지 않을 수 있다.
- 그래서 DB 변경이 있는 배포는 사전 백업과 복구 절차를 더 엄격히 준비해야 한다.

---

## 19. 운영 점검 체크리스트

## 19.1 일일 점검 권장
- [ ] 서버 프로세스 정상 동작
- [ ] 전일 자동 백업 성공
- [ ] 디스크 사용량 과도 증가 여부
- [ ] 주요 ERROR 로그 유무
- [ ] 통계/기록 조회 이상 제보 유무

## 19.2 주간 점검 권장
- [ ] 로그 보관량 확인
- [ ] 백업 파일 보관 상태 확인
- [ ] 척도 JSON/설정 파일 변경 이력 확인
- [ ] 운영자 계정 상태 점검
- [ ] 복구 테스트 계획 점검

## 19.3 배포 전 점검 권장
- [ ] 직전 운영 버전 보관
- [ ] DB 백업
- [ ] 운영 경로 writable 확인
- [ ] 테스트 문서 기준 P0 통과 확인
- [ ] 배포 후 검수 담당자 대기

---

## 20. 운영 보안/접근 제어 최소 원칙

## 20.1 최소 원칙
- 운영 서버 접근 계정을 최소화한다.
- 운영 DB 접속 권한을 개발자/운영자 역할에 맞게 분리한다.
- 설정 파일 접근 권한을 제한한다.
- 백업 파일 접근 권한도 별도로 관리한다.

## 20.2 운영 파일 권한 권장
- `app/` : 운영자/배포 담당자만 수정
- `logs/` : 운영자 읽기, 시스템 쓰기
- `backups/` : 운영자/백업 담당자만 접근
- `scripts/` : 운영자만 수정

## 20.3 민감정보 보호
- 비밀번호, DB 연결정보, 운영 경로는 공용 문서에 그대로 남기지 않는다.
- 운영자 전달 문서에는 placeholder를 사용하고, 실제 값은 별도 전달한다.

---

## 21. 운영 중 변경 관리 원칙

## 21.1 변경 대상
아래는 운영 변경으로 취급한다.

- 백엔드 코드 변경
- 프론트 빌드 변경
- DB 구조 변경
- 척도 JSON 변경
- 운영 설정 변경
- 백업/로그 경로 변경

## 21.2 변경 기록 권장 항목
- 변경 일시
- 변경 담당자
- 변경 대상
- 변경 사유
- 관련 문서/이슈
- 결과 기록 문서 위치
- 배포 후 확인 결과
- 롤백 필요 여부

## 21.3 권장 방식
- 최소한 `release-note.md` 또는 운영 변경 이력 문서를 유지한다.
- 실제 운영 변경이나 재배포를 수행한 날짜에는 [docs/14-deploy-result-template.md](./14-deploy-result-template.md) 를 참고해 `docs/deploy-results/YYYY-MM-DD.md` 를 생성 또는 갱신한다.
- 같은 문서 안에서 `검증 환경 결과` 와 `실제 운영 배포 결과` 를 분리한다.
- 척도 JSON 변경은 일반 코드 변경과 구분해서 적는다.

---

## 22. 운영 인수인계 시 반드시 전달할 것

1. 운영 서버 접속 절차
2. 운영 DB 접속 절차
3. application-prod 위치
4. 척도 JSON 위치
5. 로그 경로
6. 백업 경로
7. 운영 스크립트 4종 사용법 (`health-check.bat`, `run-backup.bat`, `deploy-backend.bat`, `deploy-frontend.bat`)
8. 수동 백업 실행 절차
9. 배포 절차
10. 롤백 절차
11. 장애 시 확인 순서

---

## 23. 바이브 코딩 후 운영 전 반드시 정리할 항목

1. `application-prod.yml` 템플릿
2. 운영용 배포 스크립트
3. 초기 DB 스키마 고정본
4. 운영 척도 JSON 확정본
5. 배포 체크리스트
6. 운영 점검 체크리스트
7. 릴리스 노트 양식
8. 장애 대응 연락체계

---

## 24. 초안 기준 최종 권장 사항

- 운영은 내부망 단독 웹 시스템 기준으로 배포한다.
- 초기 운영 구조는 “앱 서버 + 별도 DB 서버”를 가장 권장한다.
- 운영 설정은 `application-prod.yml` 로 분리하고 비밀값은 외부화한다.
- 운영에서는 DB 자동 생성 대신 validate + 버전 관리된 스키마를 사용한다.
- 척도 JSON은 운영 외부 경로에서 관리하는 방식을 권장한다.
- 로그와 백업은 별도 경로에 두고 보존 정책을 분리한다.
- 배포 전에는 반드시 수동 백업, P0 검증 통과, 직전 버전 보관을 확인한다.
- 배포 후에는 로그인/대상자/세션 저장/통계/관리자 기능까지 스모크 테스트를 수행한다.
- 장애 대응은 로그 확인 → 영향 범위 파악 → 롤백 판단의 순서를 기본으로 한다.

---

## 25. 다음 단계 연계

본 문서까지 작성되면, 바이브 코딩 전/직후 운영 준비를 위한 기본 문서 세트는 아래 수준까지 갖춰진다.

1. `00-project-overview.md`
2. `01-screen-structure.md`
3. `02-db-design.md`
4. `03-api-spec.md`
5. `04-scale-json.md`
6. `05-backend-architecture.md`
7. `06-frontend-architecture.md`
8. `07-validation-rules.md`
9. `08-error-handling.md`
10. `09-test-scenarios.md`
11. `10-dev-setup.md`
12. `11-deployment.md`

다음 추천 작업은 아래 중 하나다.

1. 운영용 `application-prod.yml` 템플릿 파일 만들기
2. `scripts/` 운영 스크립트와 운영 환경 값 정합성 점검
3. DB 초기 스키마 SQL 초안 만들기
4. 백엔드/프론트 프로젝트 뼈대 코드 생성 시작

---

## 26. 결정사항 요약

- 운영은 내부망 기준으로 배포한다.
- 권장 운영 구조는 앱 서버 + 별도 DB 서버다.
- 운영 설정은 prod 전용 파일로 분리한다.
- 운영에서는 DB 자동 생성 대신 validate 기반으로 운영한다.
- 척도 JSON은 운영 외부 경로에서 관리하는 방식을 권장한다.
- 로그와 백업은 별도 경로로 분리한다.
- 배포 전 수동 백업과 P0 검증 통과를 필수로 본다.
- 배포 후에는 핵심 기능 스모크 테스트를 반드시 수행한다.
- 장애 시에는 로그 확인, 영향 범위 확인, 롤백 판단 순서로 대응한다.
