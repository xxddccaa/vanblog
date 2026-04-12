#!/bin/sh
set -eu

if [ -n "${PG_HOST:-}" ] && [ -n "${PG_DB:-}" ] && [ "${WALINE_SKIP_PG_BOOTSTRAP:-false}" != "true" ]; then
  export PGPASSWORD="${PG_PASSWORD:-}"
  MAINTENANCE_DB="${PG_BOOTSTRAP_DATABASE:-postgres}"
  echo "[waline-entrypoint] ensuring PostgreSQL database ${PG_DB} exists"

  attempts=0
  until psql \
    -h "${PG_HOST}" \
    -p "${PG_PORT:-5432}" \
    -U "${PG_USER:-postgres}" \
    -d "${MAINTENANCE_DB}" \
    -v ON_ERROR_STOP=1 <<EOSQL
SELECT format('CREATE DATABASE %I', '${PG_DB}')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${PG_DB}');
\gexec
EOSQL
  do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "${WALINE_PG_BOOTSTRAP_RETRIES:-20}" ]; then
      echo "[waline-entrypoint] failed to ensure PostgreSQL database ${PG_DB} exists" >&2
      exit 1
    fi
    sleep 3
  done
fi

if [ -n "${PG_HOST:-}" ] && [ -n "${PG_DB:-}" ] && [ "${WALINE_SKIP_SCHEMA_BOOTSTRAP:-false}" != "true" ]; then
  WALINE_TABLE_PREFIX="${PG_PREFIX:-${POSTGRES_PREFIX:-wl_}}"
  case "${WALINE_TABLE_PREFIX}" in
    *[!A-Za-z0-9_]*)
      echo "[waline-entrypoint] invalid PostgreSQL table prefix: ${WALINE_TABLE_PREFIX}" >&2
      exit 1
      ;;
  esac

  echo "[waline-entrypoint] ensuring Waline schema exists in PostgreSQL database ${PG_DB}"
  attempts=0
  until psql \
    -h "${PG_HOST}" \
    -p "${PG_PORT:-5432}" \
    -U "${PG_USER:-postgres}" \
    -d "${PG_DB}" \
    -v ON_ERROR_STOP=1 <<EOSQL
CREATE SEQUENCE IF NOT EXISTS ${WALINE_TABLE_PREFIX}comment_seq;
CREATE TABLE IF NOT EXISTS ${WALINE_TABLE_PREFIX}comment (
  id integer NOT NULL DEFAULT nextval('${WALINE_TABLE_PREFIX}comment_seq'::regclass),
  user_id integer,
  insertedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  ip text,
  link text,
  mail text,
  nick text NOT NULL,
  pid integer,
  rid integer,
  "like" integer DEFAULT 0,
  comment text,
  status text,
  sticky boolean DEFAULT FALSE,
  ua text,
  url text,
  objectId text,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  avatar text,
  label text,
  type text DEFAULT '',
  PRIMARY KEY (id)
);

CREATE SEQUENCE IF NOT EXISTS ${WALINE_TABLE_PREFIX}counter_seq;
CREATE TABLE IF NOT EXISTS ${WALINE_TABLE_PREFIX}counter (
  id integer NOT NULL DEFAULT nextval('${WALINE_TABLE_PREFIX}counter_seq'::regclass),
  time integer DEFAULT 0,
  url text,
  objectId text,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE SEQUENCE IF NOT EXISTS ${WALINE_TABLE_PREFIX}users_seq;
CREATE TABLE IF NOT EXISTS ${WALINE_TABLE_PREFIX}users (
  id integer NOT NULL DEFAULT nextval('${WALINE_TABLE_PREFIX}users_seq'::regclass),
  display_name text,
  email text,
  github text,
  insertedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  label text,
  link text,
  objectId text,
  password text,
  type text DEFAULT 'user',
  avatar text,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  ip text,
  token text,
  uid text,
  url text,
  verified text,
  nick text,
  mail text,
  "2fa" text,
  PRIMARY KEY (id)
);
EOSQL
  do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "${WALINE_SCHEMA_BOOTSTRAP_RETRIES:-20}" ]; then
      echo "[waline-entrypoint] failed to ensure Waline schema exists in PostgreSQL database ${PG_DB}" >&2
      exit 1
    fi
    sleep 3
  done
fi

exec node runner.cjs
