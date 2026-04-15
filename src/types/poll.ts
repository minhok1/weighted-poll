export type Tab = 'current' | 'past' | 'groups' | 'account';

export type SessionPhase = 'brainstorming' | 'voting' | 'results' | 'closed';

export type SessionRow = {
  id: string;
  group_id: string;
  title: string;
  phase: SessionPhase;
  final_ranking: unknown;
  created_at: string;
};

export type OptionRow = {
  id: string;
  session_id: string;
  title: string;
  details: string | null;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  session_id: string;
  user_id: string;
  ranking: unknown;
  submitted_at: string;
};

export type GroupRow = {
  id: string;
  name: string;
  invite_code: string;
  created_at?: string;
  member_count?: number;
  base_weight: number;
  rating_split: number;
  rating_lookback: number;
  first_pick_lookback: number;
  my_weight?: number;
};

export type FinalRankingEntry = {
  option_id?: string;
  title?: string;
  score?: number;
};

