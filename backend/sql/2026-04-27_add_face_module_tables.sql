CREATE TABLE face_profile (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(255) UNIQUE NOT NULL REFERENCES students(id),
    azure_person_id VARCHAR(255),
    azure_face_persisted_id VARCHAR(255),
    avatar_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_ENROLLED',
    quality_score FLOAT,
    liveness_level VARCHAR(50),
    last_verified_at TIMESTAMP,
    updated_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE face_update_request (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL REFERENCES students(id),
    old_avatar_url TEXT,
    new_avatar_url TEXT NOT NULL,
    new_azure_face_id VARCHAR(255),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    review_note TEXT,
    reviewed_by VARCHAR(255) REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE face_attendance_session (
    id BIGSERIAL PRIMARY KEY,
    lecturer_id VARCHAR(255) NOT NULL REFERENCES lecturers(id),
    class_id BIGINT NOT NULL REFERENCES classes(id),
    event_id BIGINT NOT NULL REFERENCES events(id),
    semester_id BIGINT NOT NULL REFERENCES semesters(id),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE face_attendance_match_log (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES face_attendance_session(id),
    student_id VARCHAR(255) REFERENCES students(id),
    confidence FLOAT,
    result VARCHAR(50) NOT NULL,
    snapshot_url VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
