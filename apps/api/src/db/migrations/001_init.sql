CREATE TABLE IF NOT EXISTS players (
  address TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_daily_challenge_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_total_points ON players(total_points DESC);

CREATE TABLE IF NOT EXISTS round_sessions (
  round_id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  token TEXT,
  amount TEXT,
  token_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('issued', 'scored', 'resolved', 'expired', 'failed', 'needs_attention', 'permanent_failure')),
  score INTEGER,
  correct_count INTEGER,
  total INTEGER,
  won BOOLEAN,
  resolved_tx TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  onchain_created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_round_sessions_player ON round_sessions(player);

CREATE TABLE IF NOT EXISTS round_secrets (
  round_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE
);
