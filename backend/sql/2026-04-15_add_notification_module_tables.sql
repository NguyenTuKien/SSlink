-- 2026-04-15: Add notification module structures

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS class_id BIGINT,
  ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500);

-- Fill default content for legacy rows before enforcing NOT NULL
UPDATE notifications
SET content = COALESCE(content, title)
WHERE content IS NULL;

ALTER TABLE notifications
  ALTER COLUMN content SET NOT NULL;

ALTER TABLE notifications
  ADD CONSTRAINT IF NOT EXISTS fk_notifications_class
  FOREIGN KEY (class_id) REFERENCES classes(id);

CREATE TABLE IF NOT EXISTS notification_recipients (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT NOT NULL,
  student_id VARCHAR(255) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_notification_recipients_notification
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_recipients_student
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_student_id
  ON notification_recipients(student_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id
  ON notification_recipients(notification_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at);
