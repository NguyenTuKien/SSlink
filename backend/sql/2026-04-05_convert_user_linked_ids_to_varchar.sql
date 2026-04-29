BEGIN;

-- Convert user-linked IDs from bigint identity to varchar so they match JPA String IDs.
-- Target PK columns: users.id, lecturers.id, students.id
-- Also convert all FK columns that reference any of those three tables.

CREATE TEMP TABLE _fk_backup (
  schema_name text,
  table_name text,
  constraint_name text,
  constraint_def text
) ON COMMIT DROP;

CREATE TEMP TABLE _fk_columns (
  schema_name text,
  table_name text,
  column_name text
) ON COMMIT DROP;

INSERT INTO _fk_backup (schema_name, table_name, constraint_name, constraint_def)
SELECT
  ns.nspname,
  tbl.relname,
  con.conname,
  pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class tbl ON tbl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
JOIN pg_class ref ON ref.oid = con.confrelid
WHERE con.contype = 'f'
  AND ref.relname IN ('users', 'lecturers', 'students');

INSERT INTO _fk_columns (schema_name, table_name, column_name)
SELECT DISTINCT
  ns.nspname,
  tbl.relname,
  att.attname
FROM pg_constraint con
JOIN pg_class tbl ON tbl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
JOIN pg_class ref ON ref.oid = con.confrelid
JOIN LATERAL unnest(con.conkey) AS ck(attnum) ON true
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ck.attnum
WHERE con.contype = 'f'
  AND ref.relname IN ('users', 'lecturers', 'students');

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM _fk_backup LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      c.schema_name,
      c.table_name,
      c.constraint_name
    );
  END LOOP;
END $$;

-- Drop identity/default on PK columns if these tables were created with bigint identity.
ALTER TABLE users
  ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE users
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE lecturers
  ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE lecturers
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE students
  ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE students
  ALTER COLUMN id DROP DEFAULT;

-- Convert PKs to varchar.
ALTER TABLE users
  ALTER COLUMN id TYPE varchar(255) USING id::text;
ALTER TABLE lecturers
  ALTER COLUMN id TYPE varchar(255) USING id::text;
ALTER TABLE students
  ALTER COLUMN id TYPE varchar(255) USING id::text;

-- Convert every FK column that references users/lecturers/students.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT schema_name, table_name, column_name
    FROM _fk_columns
    WHERE NOT (
      (table_name = 'users' AND column_name = 'id') OR
      (table_name = 'lecturers' AND column_name = 'id') OR
      (table_name = 'students' AND column_name = 'id')
    )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE varchar(255) USING %I::text',
      c.schema_name,
      c.table_name,
      c.column_name,
      c.column_name
    );
  END LOOP;
END $$;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT * FROM _fk_backup LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
      c.schema_name,
      c.table_name,
      c.constraint_name,
      c.constraint_def
    );
  END LOOP;
END $$;

COMMIT;
