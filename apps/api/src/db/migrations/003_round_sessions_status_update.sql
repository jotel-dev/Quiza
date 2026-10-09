ALTER TABLE round_sessions DROP CONSTRAINT IF EXISTS round_sessions_status_check;
ALTER TABLE round_sessions ADD CONSTRAINT round_sessions_status_check
  CHECK (status IN ('issued', 'scored', 'resolved', 'expired', 'failed', 'needs_attention', 'permanent_failure'));
