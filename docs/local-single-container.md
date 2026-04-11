# Local Single-Container Bundle

`docker-compose.single-container.yml` 은 local 전용 1컨테이너 실행 경로입니다. 기존 `docker-compose.yml`, `docker-compose.local-db.yml`, `docker-compose.prod.yml` 흐름은 그대로 두고, 로컬에서 빠르게 한 번에 확인할 수 있는 번들 이미지를 추가했습니다.

## 실행 명령

```bash
docker compose -f docker-compose.single-container.yml up -d --build
docker compose -f docker-compose.single-container.yml ps
curl -fsS http://127.0.0.1:4173/api/v1/health
```

## 내부 구성

- 컨테이너 1개 안에서 `MariaDB + Spring Boot backend + Nginx frontend` 가 함께 실행됩니다.
- 외부 공개 포트는 `4173` 하나만 사용합니다.
- 프론트엔드는 Nginx가 정적 파일을 서빙하고, `/api` 요청은 같은 컨테이너의 `127.0.0.1:8080` backend 로 프록시합니다.
- backend 는 `local` profile 로 실행되며, H2 대신 컨테이너 내부 MariaDB 를 사용합니다.

## 초기화 순서

컨테이너 시작 시 `docker/single-container/entrypoint.sh` 와 `docker/single-container/init-db.sh` 가 아래 순서로 동작합니다.

1. MariaDB data directory 준비 여부를 확인합니다.
2. data directory 가 비어 있으면 `mariadb-install-db` 로 초기화합니다.
3. 임시 MariaDB 를 소켓 모드로 띄웁니다.
4. `mental_health_local` DB 와 `mental_user` 계정을 보장합니다.
5. 앱 스키마가 비어 있으면 `backend/src/main/resources/schema.sql` 을 적용합니다.
6. 임시 MariaDB 를 종료합니다.
7. `supervisord` 가 실제 MariaDB, backend, nginx 를 순서대로 띄웁니다.

## 유지되는 데이터

- MariaDB data: named volume `single_container_mariadb_data`
- backend logs: 호스트 `./logs` -> 컨테이너 `/data/logs`
- backups: 호스트 `./local-backups` -> 컨테이너 `/data/backups`

기존 DB 데이터를 완전히 초기화하려면 아래 명령을 사용합니다.

```bash
docker compose -f docker-compose.single-container.yml down -v
```

`down -v` 는 named volume 인 MariaDB data 를 제거합니다. `./logs`, `./local-backups` 의 bind mount 데이터는 남습니다.

## 기본 local 확인값

- 접속 주소: `http://127.0.0.1:4173`
- health: `http://127.0.0.1:4173/api/v1/health`
- seed 계정: `admina / Test1234!`

backend 가 local seed 를 켠 상태로 실행되므로 DB 가 비어 있는 첫 기동 후에는 위 계정으로 로그인 확인이 가능합니다.
