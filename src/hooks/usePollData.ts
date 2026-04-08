import { useCallback, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { GroupRow, OptionRow, SessionPhase, SessionRow, SubmissionRow } from '../types/poll';

type CreateSessionInput = {
  title: string;
};

type AddOptionInput = {
  title: string;
  details: string;
};

export type PollErrorScope = 'current' | 'groups' | 'account' | 'system' | null;
type RankingEntry = { option_id: string; position: number };
type FinalRankingEntry = { option_id: string; title: string; position: number; score: number };

type UsePollDataResult = {
  isConfigured: boolean;
  loading: boolean;
  error: string | null;
  errorScope: PollErrorScope;
  status: string;
  userId: string | null;
  userEmail: string | null;
  displayName: string;
  isEmailVerified: boolean;
  groups: GroupRow[];
  activeGroupId: string | null;
  activeGroup: GroupRow | null;
  currentSession: SessionRow | null;
  pastSessions: SessionRow[];
  options: OptionRow[];
  submissions: SubmissionRow[];
  memberDisplayNames: Record<string, string>;
  sessionRatings: Record<string, number>;
  refresh: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signOutUser: () => Promise<boolean>;
  updateDisplayName: (nextDisplayName: string) => Promise<boolean>;
  createGroup: (groupName: string) => Promise<boolean>;
  joinGroup: (inviteCode: string) => Promise<boolean>;
  selectActiveGroup: (groupId: string) => void;
  createSession: (input: CreateSessionInput) => Promise<boolean>;
  addOption: (input: AddOptionInput) => Promise<boolean>;
  removeOption: (optionId: string) => Promise<boolean>;
  updateSessionPhase: (phase: SessionPhase) => Promise<boolean>;
  submitRanking: (orderedOptionIds: string[]) => Promise<boolean>;
  submitSessionRating: (rating: number) => Promise<boolean>;
};

export function usePollData(): UsePollDataResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorScope, setErrorScope] = useState<PollErrorScope>(null);
  const [status, setStatus] = useState('Not checked');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [memberDisplayNames, setMemberDisplayNames] = useState<Record<string, string>>({});
  const [sessionRatings, setSessionRatings] = useState<Record<string, number>>({});
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);

  const currentSession = useMemo(() => {
    return sessions.find((session) => session.phase !== 'closed') ?? null;
  }, [sessions]);

  const activeGroupId = useMemo(() => {
    if (selectedGroupId) {
      return selectedGroupId;
    }
    if (currentSession?.group_id) {
      return currentSession.group_id;
    }
    if (groups.length > 0) {
      return groups[0].id;
    }
    return null;
  }, [selectedGroupId, currentSession, groups]);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) {
      return null;
    }
    return groups.find((group) => group.id === activeGroupId) ?? null;
  }, [activeGroupId, groups]);

  const pastSessions = useMemo(() => {
    return sessions.filter((session) => session.phase === 'closed');
  }, [sessions]);

  const resolveDefaultGroupId = useCallback(
    async (currentUserId: string | null, knownSessions: SessionRow[]) => {
      if (knownSessions.length > 0) {
        return knownSessions[0].group_id;
      }

      if (!currentUserId || !supabase) {
        return null;
      }

      const membership = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUserId)
        .limit(1)
        .maybeSingle();

      if (membership.error) {
        return null;
      }

      return membership.data?.group_id ?? null;
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setStatus('Missing or invalid Supabase configuration');
      setError('Set EXPO_PUBLIC_SUPABASE_URL and publishable key in .env');
      setErrorScope('system');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorScope(null);

    const authResult = await supabase.auth.getUser();
    if (authResult.error) {
      setLoading(false);
      setStatus(`Error: ${authResult.error.message}`);
      setError(authResult.error.message);
      setErrorScope('system');
      return;
    }
    const currentUserId = authResult.data.user?.id ?? null;
    const currentUserEmail = authResult.data.user?.email ?? null;
    const currentDisplayName =
      (authResult.data.user?.user_metadata?.display_name as string | undefined) ??
      (authResult.data.user?.user_metadata?.full_name as string | undefined) ??
      '';
    const verifiedAt =
      authResult.data.user?.email_confirmed_at ??
      (authResult.data.user?.user_metadata?.email_confirmed_at as string | undefined) ??
      (authResult.data.user?.confirmed_at as string | undefined) ??
      null;
    setUserId(currentUserId);
    setUserEmail(currentUserEmail);
    setDisplayName(currentDisplayName);
    setIsEmailVerified(Boolean(verifiedAt));

    if (currentUserId) {
      const membershipsResult = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUserId);

      if (!membershipsResult.error) {
        const groupIds = (membershipsResult.data ?? []).map((row) => row.group_id as string);
        let preferredGroupId: string | null = null;
        if (selectedGroupId && groupIds.includes(selectedGroupId)) {
          preferredGroupId = selectedGroupId;
        } else if (groupIds.length > 0) {
          preferredGroupId = groupIds[0];
        }
        setSelectedGroupId(preferredGroupId);
        setDefaultGroupId(preferredGroupId);

        if (groupIds.length > 0) {
          const groupsResult = await supabase
            .from('groups')
            .select('id, name, invite_code, created_at')
            .in('id', groupIds)
            .order('created_at', { ascending: true });
          if (!groupsResult.error) {
            const membershipsForGroupsResult = await supabase
              .from('group_members')
              .select('group_id')
              .in('group_id', groupIds);

            const countsByGroupId = new Map<string, number>();
            if (!membershipsForGroupsResult.error) {
              for (const row of membershipsForGroupsResult.data ?? []) {
                const groupId = row.group_id as string;
                countsByGroupId.set(groupId, (countsByGroupId.get(groupId) ?? 0) + 1);
              }
            }

            const groupsWithCounts = ((groupsResult.data ?? []) as GroupRow[]).map((group) => ({
              ...group,
              member_count: countsByGroupId.get(group.id) ?? 0,
            }));
            setGroups(groupsWithCounts);
          } else {
            setGroups([]);
          }
        } else {
          setGroups([]);
          setDefaultGroupId(null);
        }
      } else {
        setGroups([]);
        setDefaultGroupId(null);
      }
    } else {
      setGroups([]);
      setDefaultGroupId(null);
    }

    let sessionsQuery = supabase
      .from('sessions')
      .select('id, group_id, title, phase, final_ranking, created_at')
      .order('created_at', { ascending: false });
    if (defaultGroupId ?? selectedGroupId) {
      sessionsQuery = sessionsQuery.eq('group_id', defaultGroupId ?? selectedGroupId ?? '');
    }
    const sessionsResult = await sessionsQuery;

    if (sessionsResult.error) {
      setLoading(false);
      setStatus(`Error: ${sessionsResult.error.message}`);
      setError(sessionsResult.error.message);
      setErrorScope('system');
      setSessions([]);
      setGroups([]);
      setOptions([]);
      setSubmissions([]);
      setMemberDisplayNames({});
      setSessionRatings({});
      return;
    }

    const allSessions = (sessionsResult.data ?? []) as SessionRow[];
    setSessions(allSessions);

    const primaryGroupId = await resolveDefaultGroupId(currentUserId, allSessions);
    if (!defaultGroupId && primaryGroupId) {
      setDefaultGroupId(primaryGroupId);
    }

    const nextCurrentSession = allSessions.find((session) => session.phase !== 'closed') ?? null;

    if (!nextCurrentSession) {
      setOptions([]);
      setSubmissions([]);
      setMemberDisplayNames({});
      setSessionRatings({});
      setLoading(false);
      setStatus('Connected');
      return;
    }

    const [optionsResult, submissionsResult] = await Promise.all([
      supabase
        .from('session_options')
        .select('id, session_id, title, details, created_at')
        .eq('session_id', nextCurrentSession.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('session_submissions')
        .select('id, session_id, user_id, ranking, submitted_at')
        .eq('session_id', nextCurrentSession.id)
        .order('submitted_at', { ascending: true }),
    ]);

    if (optionsResult.error) {
      setLoading(false);
      setStatus(`Error: ${optionsResult.error.message}`);
      setError(optionsResult.error.message);
      setErrorScope('system');
      return;
    }

    if (submissionsResult.error) {
      setLoading(false);
      setStatus(`Error: ${submissionsResult.error.message}`);
      setError(submissionsResult.error.message);
      setErrorScope('system');
      return;
    }

    setOptions((optionsResult.data ?? []) as OptionRow[]);
    setSubmissions((submissionsResult.data ?? []) as SubmissionRow[]);
    const submissionUserIds = Array.from(
      new Set(
        ((submissionsResult.data ?? []) as SubmissionRow[])
          .map((row) => row.user_id)
          .filter((id): id is string => typeof id === 'string')
      )
    );
    const namesMap: Record<string, string> = {};
    if (currentUserId && currentDisplayName) {
      namesMap[currentUserId] = currentDisplayName;
    }
    if (submissionUserIds.length > 0) {
      const profilesResult = await supabase
        .from('profiles')
        .select('id, display_name, full_name')
        .in('id', submissionUserIds);
      if (!profilesResult.error) {
        for (const profile of profilesResult.data ?? []) {
          const profileId = profile.id as string | undefined;
          const name =
            (profile.display_name as string | undefined) ??
            (profile.full_name as string | undefined) ??
            '';
          if (profileId && name.trim()) {
            namesMap[profileId] = name;
          }
        }
      }
    }
    setMemberDisplayNames(namesMap);
    const ratingsResult = await supabase
      .from('session_ratings')
      .select('user_id, rating')
      .eq('session_id', nextCurrentSession.id);
    if (!ratingsResult.error) {
      const ratingsMap = Object.fromEntries(
        (ratingsResult.data ?? [])
          .filter((row) => typeof row.user_id === 'string' && typeof row.rating === 'number')
          .map((row) => [row.user_id as string, row.rating as number])
      ) as Record<string, number>;
      setSessionRatings(ratingsMap);
    } else {
      setSessionRatings({});
    }
    setLoading(false);
    setStatus('Connected');
  }, [defaultGroupId, resolveDefaultGroupId, selectedGroupId]);

  const generateInviteCode = () => {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  };

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayNameInput?: string) => {
      setErrorScope('account');
      if (!supabase) {
        setError('Supabase is not configured.');
        return false;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const displayNameValue = (displayNameInput ?? '').trim();
      if (!normalizedEmail || !password || !displayNameValue) {
        setError('Email, display name, and password are required.');
        return false;
      }

      setLoading(true);
      setError(null);

      const redirectTo = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || undefined;
      const result = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          data: {
            display_name: displayNameValue,
            full_name: displayNameValue,
          },
        },
      });

      if (result.error) {
        setLoading(false);
        setError(result.error.message);
        return false;
      }

      const identities = result.data.user?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setLoading(false);
        setError('Email is already registered. Log in, then update your display name in Account.');
        return false;
      }

      if (result.data.session) {
        const metadataWrite = await supabase.auth.updateUser({
          data: {
            display_name: displayNameValue,
            full_name: displayNameValue,
          },
        });
        if (metadataWrite.error) {
          setLoading(false);
          setError(metadataWrite.error.message);
          return false;
        }
      }

      setLoading(false);
      setStatus('Sign-up successful. Check your email for verification link.');
      await refresh();
      return true;
    },
    [refresh]
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      setErrorScope('account');
      if (!supabase) {
        setError('Supabase is not configured.');
        return false;
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        setError('Email and password are required.');
        return false;
      }

      setLoading(true);
      setError(null);

      const result = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (result.error) {
        setLoading(false);
        setError(result.error.message);
        return false;
      }

      setLoading(false);
      setStatus('Logged in.');
      await refresh();
      return true;
    },
    [refresh]
  );

  const signOutUser = useCallback(async () => {
    setErrorScope('account');
    if (!supabase) {
      setError('Supabase is not configured.');
      return false;
    }
    setLoading(true);
    const result = await supabase.auth.signOut();
    if (result.error) {
      setLoading(false);
      setError(result.error.message);
      return false;
    }
    setLoading(false);
    setStatus('Logged out.');
    await refresh();
    return true;
  }, [refresh]);

  const updateDisplayName = useCallback(
    async (nextDisplayName: string) => {
      setErrorScope('account');
      if (!supabase) {
        setError('Supabase is not configured.');
        return false;
      }
      if (!userId) {
        setError('Please log in first.');
        return false;
      }

      const trimmed = nextDisplayName.trim();
      if (!trimmed) {
        setError('Display name cannot be empty.');
        return false;
      }

      setLoading(true);
      setError(null);

      const result = await supabase.auth.updateUser({
        data: {
          display_name: trimmed,
        },
      });

      if (result.error) {
        setLoading(false);
        setError(result.error.message);
        return false;
      }

      setDisplayName(trimmed);
      setLoading(false);
      await refresh();
      return true;
    },
    [refresh, userId]
  );

  const createGroup = useCallback(
    async (groupName: string) => {
      setErrorScope('groups');
      if (!supabase) {
        setError('Supabase is not configured.');
        return false;
      }
      if (!userId) {
        setError('Please log in before creating a group.');
        return false;
      }
      const trimmedName = groupName.trim();
      if (!trimmedName) {
        setError('Group name is required.');
        return false;
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const inviteCode = generateInviteCode();
        const groupInsert = await supabase
          .from('groups')
          .insert({ name: trimmedName, invite_code: inviteCode, created_by: userId })
          .select('id')
          .maybeSingle();

        if (groupInsert.error || !groupInsert.data?.id) {
          continue;
        }

        const membershipInsert = await supabase.from('group_members').insert({
          group_id: groupInsert.data.id,
          user_id: userId,
        });

        if (membershipInsert.error) {
          setError(membershipInsert.error.message);
          return false;
        }

        setSelectedGroupId(groupInsert.data.id);
        setDefaultGroupId(groupInsert.data.id);
        await refresh();
        return true;
      }

      setError('Could not create group. Try again.');
      return false;
    },
    [refresh, userId]
  );

  const joinGroup = useCallback(
    async (inviteCode: string) => {
      setErrorScope('groups');
      if (!supabase) {
        setError('Supabase is not configured.');
        return false;
      }
      if (!userId) {
        setError('Please log in before joining a group.');
        return false;
      }
      const normalizedCode = inviteCode.trim().toUpperCase();
      if (!normalizedCode) {
        setError('Invite code is required.');
        return false;
      }

      const groupResult = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', normalizedCode)
        .maybeSingle();

      if (groupResult.error || !groupResult.data?.id) {
        setError('Group not found for this invite code.');
        return false;
      }

      const membershipUpsert = await supabase.from('group_members').upsert(
        {
          group_id: groupResult.data.id,
          user_id: userId,
        },
        { onConflict: 'group_id,user_id' }
      );

      if (membershipUpsert.error) {
        setError(membershipUpsert.error.message);
        return false;
      }

      setSelectedGroupId(groupResult.data.id);
      setDefaultGroupId(groupResult.data.id);
      await refresh();
      return true;
    },
    [refresh, userId]
  );

  const selectActiveGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    setDefaultGroupId(groupId);
  }, []);

  const createSession = useCallback(
    async (input: CreateSessionInput) => {
      setErrorScope('current');
      if (!supabase) {
        setError('Supabase is not configured.');
        return false;
      }
      if (!defaultGroupId) {
        setError('No group found for this account. Create/join a group first.');
        return false;
      }
      if (!userId) {
        setError('Please log in before creating a session.');
        return false;
      }

      const result = await supabase.from('sessions').insert({
        group_id: defaultGroupId,
        title: input.title.trim(),
        phase: 'brainstorming',
        created_by: userId,
      });

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [defaultGroupId, refresh, userId]
  );

  const addOption = useCallback(
    async (input: AddOptionInput) => {
      setErrorScope('current');
      if (!supabase || !currentSession) {
        setError('No active session.');
        return false;
      }
      if (!userId) {
        setError('Please log in before adding books.');
        return false;
      }

      const result = await supabase.from('session_options').insert({
        session_id: currentSession.id,
        title: input.title.trim(),
        details: input.details.trim() || null,
        added_by: userId,
      });

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [currentSession, refresh, userId]
  );

  const removeOption = useCallback(
    async (optionId: string) => {
      setErrorScope('current');
      if (!supabase || !currentSession) {
        setError('No active session.');
        return false;
      }
      if (!userId) {
        setError('Please log in before removing books.');
        return false;
      }
      if (!optionId.trim()) {
        setError('Invalid book.');
        return false;
      }

      const result = await supabase
        .from('session_options')
        .delete()
        .eq('id', optionId)
        .eq('session_id', currentSession.id);

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [currentSession, refresh, userId]
  );

  const updateSessionPhase = useCallback(
    async (phase: SessionPhase) => {
      setErrorScope('current');
      if (!supabase || !currentSession) {
        setError('No active session.');
        return false;
      }

      let payload: { phase: SessionPhase; final_ranking?: FinalRankingEntry[] } = { phase };
      if (phase === 'results') {
        const [optionsResult, submissionsResult, pastSessionsResult] = await Promise.all([
          supabase
            .from('session_options')
            .select('id, title')
            .eq('session_id', currentSession.id),
          supabase
            .from('session_submissions')
            .select('user_id, ranking')
            .eq('session_id', currentSession.id),
          supabase
            .from('sessions')
            .select('id, final_ranking, created_at')
            .eq('group_id', currentSession.group_id)
            .eq('phase', 'closed')
            .neq('id', currentSession.id)
            .order('created_at', { ascending: false })
            .limit(2),
        ]);

        if (optionsResult.error) {
          setError(optionsResult.error.message);
          return false;
        }
        if (submissionsResult.error) {
          setError(submissionsResult.error.message);
          return false;
        }
        if (pastSessionsResult.error) {
          setError(pastSessionsResult.error.message);
          return false;
        }

        const currentOptions = (optionsResult.data ?? []) as Array<{ id: string; title: string }>;
        const currentSubmissions = (submissionsResult.data ?? []) as Array<{
          user_id: string;
          ranking: unknown;
        }>;
        const pastSessions = (pastSessionsResult.data ?? []) as Array<{
          id: string;
          final_ranking: unknown;
        }>;

        let pastSubmissions: Array<{ session_id: string; user_id: string; ranking: unknown }> = [];
        if (pastSessions.length > 0) {
          const pastSubmissionsResult = await supabase
            .from('session_submissions')
            .select('session_id, user_id, ranking')
            .in(
              'session_id',
              pastSessions.map((session) => session.id)
            );
          if (pastSubmissionsResult.error) {
            setError(pastSubmissionsResult.error.message);
            return false;
          }
          pastSubmissions = (pastSubmissionsResult.data ?? []) as Array<{
            session_id: string;
            user_id: string;
            ranking: unknown;
          }>;
        }

        const participantIds = Array.from(new Set(currentSubmissions.map((submission) => submission.user_id)));
        const historyScores = computeHistoryScores(participantIds, pastSessions, pastSubmissions);
        const finalRanking = buildWeightedFinalRanking(currentOptions, currentSubmissions, historyScores);
        payload = {
          phase,
          final_ranking: finalRanking,
        };
      }

      const result = await supabase.from('sessions').update(payload).eq('id', currentSession.id);
      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [currentSession, refresh]
  );

  const submitRanking = useCallback(
    async (orderedOptionIds: string[]) => {
      setErrorScope('current');
      if (!supabase || !currentSession) {
        setError('No active session.');
        return false;
      }
      if (!userId) {
        setError('Please log in before submitting.');
        return false;
      }

      const ranking = orderedOptionIds.map((optionId, index) => ({
        option_id: optionId,
        position: index + 1,
      }));

      const result = await supabase.from('session_submissions').upsert(
        {
          session_id: currentSession.id,
          user_id: userId,
          ranking,
        },
        { onConflict: 'session_id,user_id' }
      );

      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [currentSession, refresh, userId]
  );

  const submitSessionRating = useCallback(
    async (rating: number) => {
      setErrorScope('current');
      if (!supabase || !currentSession) {
        setError('No active session.');
        return false;
      }
      if (!userId) {
        setError('Please log in before submitting a rating.');
        return false;
      }
      if (rating < 0.5 || rating > 5) {
        setError('Rating must be between 0.5 and 5 stars.');
        return false;
      }

      const roundedRating = Math.round(rating * 2) / 2;
      const result = await supabase.from('session_ratings').upsert(
        {
          session_id: currentSession.id,
          user_id: userId,
          rating: roundedRating,
        },
        { onConflict: 'session_id,user_id' }
      );
      if (result.error) {
        setError(result.error.message);
        return false;
      }

      await refresh();
      return true;
    },
    [currentSession, refresh, userId]
  );

  return {
    isConfigured: isSupabaseConfigured,
    loading,
    error,
    errorScope,
    status,
    userId,
    userEmail,
    displayName,
    isEmailVerified,
    groups,
    activeGroupId,
    activeGroup,
    currentSession,
    pastSessions,
    options,
    submissions,
    memberDisplayNames,
    sessionRatings,
    refresh,
    signUpWithEmail,
    signInWithEmail,
    signOutUser,
    updateDisplayName,
    createGroup,
    joinGroup,
    selectActiveGroup,
    createSession,
    addOption,
    removeOption,
    updateSessionPhase,
    submitRanking,
    submitSessionRating,
  };
}

function buildWeightedFinalRanking(
  options: Array<{ id: string; title: string }>,
  submissions: Array<{ user_id: string; ranking: unknown }>,
  historyScores: Map<string, { enjoyment: number; reflection: number }>
): FinalRankingEntry[] {
  if (options.length === 0) {
    return [];
  }

  const optionIds = options.map((option) => option.id);
  const optionTitles = new Map(options.map((option) => [option.id, option.title]));
  const pairwise = new Map<string, Map<string, number>>();
  for (const optionId of optionIds) {
    pairwise.set(optionId, new Map());
  }

  for (const submission of submissions) {
    const rankingEntries = parseRankingEntries(submission.ranking);
    if (rankingEntries.length === 0) {
      continue;
    }
    const positions = buildPositionMap(rankingEntries, optionIds);
    const history = historyScores.get(submission.user_id);
    const enjoyment = history?.enjoyment ?? 0.5;
    const reflection = history?.reflection ?? 0.5;
    const voterWeight = 0.6 + 0.2 * enjoyment + 0.2 * reflection;

    for (let i = 0; i < optionIds.length; i += 1) {
      for (let j = i + 1; j < optionIds.length; j += 1) {
        const a = optionIds[i];
        const b = optionIds[j];
        const posA = positions.get(a);
        const posB = positions.get(b);
        if (posA === undefined || posB === undefined || posA === posB) {
          continue;
        }
        const winner = posA < posB ? a : b;
        const loser = winner === a ? b : a;
        const winnerMap = pairwise.get(winner);
        if (!winnerMap) {
          continue;
        }
        winnerMap.set(loser, (winnerMap.get(loser) ?? 0) + voterWeight);
      }
    }
  }

  const orderedOptionIds =
    optionIds.length <= 8
      ? maximizeKemenyOrdering(optionIds, pairwise)
      : [...optionIds].sort((a, b) => getNetPairwiseScore(pairwise, b, optionIds) - getNetPairwiseScore(pairwise, a, optionIds));

  return orderedOptionIds.map((optionId, index) => ({
    option_id: optionId,
    title: optionTitles.get(optionId) ?? optionId,
    position: index + 1,
    score: Number(getNetPairwiseScore(pairwise, optionId, optionIds).toFixed(4)),
  }));
}

function computeHistoryScores(
  userIds: string[],
  pastSessions: Array<{ id: string; final_ranking: unknown }>,
  pastSubmissions: Array<{ session_id: string; user_id: string; ranking: unknown }>
): Map<string, { enjoyment: number; reflection: number }> {
  const submissionsBySession = new Map<string, Array<{ user_id: string; ranking: unknown }>>();
  for (const submission of pastSubmissions) {
    if (!submissionsBySession.has(submission.session_id)) {
      submissionsBySession.set(submission.session_id, []);
    }
    submissionsBySession.get(submission.session_id)?.push({ user_id: submission.user_id, ranking: submission.ranking });
  }

  const scores = new Map<string, { enjoymentSamples: number[]; reflectionSamples: number[] }>();
  for (const userId of userIds) {
    scores.set(userId, { enjoymentSamples: [], reflectionSamples: [] });
  }

  for (const session of pastSessions) {
    const finalOrder = parseFinalRankingOrder(session.final_ranking);
    if (finalOrder.length === 0) {
      continue;
    }
    const winner = finalOrder[0];
    const submissions = submissionsBySession.get(session.id) ?? [];
    for (const submission of submissions) {
      if (!scores.has(submission.user_id)) {
        continue;
      }
      const parsed = parseRankingEntries(submission.ranking);
      if (parsed.length === 0) {
        continue;
      }
      const userTop = [...parsed].sort((a, b) => a.position - b.position)[0]?.option_id;
      if (userTop) {
        scores.get(submission.user_id)?.enjoymentSamples.push(userTop === winner ? 1 : 0);
      }
      const userOrder = parsed
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.option_id);
      const reflection = kendallAgreement(finalOrder, userOrder);
      if (reflection !== null) {
        scores.get(submission.user_id)?.reflectionSamples.push(reflection);
      }
    }
  }

  const output = new Map<string, { enjoyment: number; reflection: number }>();
  for (const userId of userIds) {
    const userScore = scores.get(userId);
    output.set(userId, {
      enjoyment: average(userScore?.enjoymentSamples) ?? 0.5,
      reflection: average(userScore?.reflectionSamples) ?? 0.5,
    });
  }
  return output;
}

function parseRankingEntries(value: unknown): RankingEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const optionId = (entry as { option_id?: unknown }).option_id;
      const position = (entry as { position?: unknown }).position;
      if (typeof optionId !== 'string' || typeof position !== 'number') {
        return null;
      }
      return { option_id: optionId, position };
    })
    .filter((entry): entry is RankingEntry => Boolean(entry));
}

function parseFinalRankingOrder(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const optionId = (entry as { option_id?: unknown }).option_id;
      return typeof optionId === 'string' ? optionId : null;
    })
    .filter((entry): entry is string => Boolean(entry));
}

function buildPositionMap(ranking: RankingEntry[], optionIds: string[]) {
  const map = new Map<string, number>();
  const sorted = [...ranking].sort((a, b) => a.position - b.position);
  let fallback = sorted.length + 1;
  for (const entry of sorted) {
    if (!map.has(entry.option_id)) {
      map.set(entry.option_id, entry.position);
    }
  }
  for (const optionId of optionIds) {
    if (!map.has(optionId)) {
      map.set(optionId, fallback);
      fallback += 1;
    }
  }
  return map;
}

function getPairwise(pairwise: Map<string, Map<string, number>>, a: string, b: string) {
  return pairwise.get(a)?.get(b) ?? 0;
}

function getNetPairwiseScore(pairwise: Map<string, Map<string, number>>, optionId: string, optionIds: string[]) {
  return optionIds.reduce((sum, otherId) => {
    if (otherId === optionId) {
      return sum;
    }
    return sum + getPairwise(pairwise, optionId, otherId) - getPairwise(pairwise, otherId, optionId);
  }, 0);
}

function maximizeKemenyOrdering(optionIds: string[], pairwise: Map<string, Map<string, number>>) {
  let bestOrder = [...optionIds];
  let bestScore = Number.NEGATIVE_INFINITY;

  const evaluate = (order: string[]) => {
    let score = 0;
    for (let i = 0; i < order.length; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        score += getPairwise(pairwise, order[i], order[j]);
      }
    }
    return score;
  };

  const permute = (arr: string[], idx: number) => {
    if (idx === arr.length) {
      const score = evaluate(arr);
      if (score > bestScore) {
        bestScore = score;
        bestOrder = [...arr];
      }
      return;
    }
    for (let i = idx; i < arr.length; i += 1) {
      [arr[idx], arr[i]] = [arr[i], arr[idx]];
      permute(arr, idx + 1);
      [arr[idx], arr[i]] = [arr[i], arr[idx]];
    }
  };

  permute([...optionIds], 0);
  return bestOrder;
}

function kendallAgreement(finalOrder: string[], userOrder: string[]) {
  const common = finalOrder.filter((optionId) => userOrder.includes(optionId));
  if (common.length < 2) {
    return null;
  }
  const userPosition = new Map<string, number>();
  userOrder.forEach((optionId, index) => userPosition.set(optionId, index));
  let agreements = 0;
  let total = 0;
  for (let i = 0; i < common.length; i += 1) {
    for (let j = i + 1; j < common.length; j += 1) {
      const a = common[i];
      const b = common[j];
      total += 1;
      if ((userPosition.get(a) ?? 0) < (userPosition.get(b) ?? 0)) {
        agreements += 1;
      }
    }
  }
  if (total === 0) {
    return null;
  }
  return agreements / total;
}

function average(values: number[] | undefined) {
  if (!values || values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

