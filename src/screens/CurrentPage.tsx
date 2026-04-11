import {
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Play,
  Plus,
  Pencil,
  Search,
  Send,
  Star,
  Trophy,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { PrimaryActionButton } from "../components/PrimaryActionButton";
import { SessionHeader } from "../components/SessionHeader";
import type {
  OptionRow,
  SessionPhase,
  SessionRow,
  SubmissionRow,
} from "../types/poll";

type Props = {
  loading: boolean;
  error: string | null;
  activeGroupName: string | null;
  currentSession: SessionRow | null;
  options: OptionRow[];
  submissions: SubmissionRow[];
  memberDisplayNames: Record<string, string>;
  sessionRatings: Record<string, number>;
  userId: string | null;
  onCreateSession: (title: string) => Promise<boolean>;
  onAddOption: (title: string, details: string) => Promise<boolean>;
  onRemoveOption: (optionId: string) => Promise<boolean>;
  onUpdateOption: (optionId: string, title: string, details: string) => Promise<boolean>;
  onUpdateSessionPhase: (phase: SessionPhase) => Promise<boolean>;
  onSubmitRanking: (orderedOptionIds: string[]) => Promise<boolean>;
  onSubmitSessionRating: (rating: number) => Promise<boolean>;
};

type RankingEntry = { option_id: string; position: number };
type StoredBookDetails = {
  source?: "open-library" | "manual";
  synopsis?: string;
  author?: string;
  tags?: string[];
  coverUrl?: string | null;
  externalRating?: number | null;
};
type BookSearchResult = {
  id: string;
  workKey: string | null;
  title: string;
  author: string;
  synopsis: string;
  tags: string[];
  coverUrl: string | null;
};
const BOOK_SEARCH_COOLDOWN_MS = 1200;

export function CurrentPage({
  loading,
  error,
  activeGroupName,
  currentSession,
  options,
  submissions,
  memberDisplayNames,
  sessionRatings,
  userId,
  onCreateSession,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onUpdateSessionPhase,
  onSubmitRanking,
  onSubmitSessionRating,
}: Props) {
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [bookSearchError, setBookSearchError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualTags, setManualTags] = useState("");
  const [manualSynopsis, setManualSynopsis] = useState("");
  const [manualRating, setManualRating] = useState("");
  const [manualAddError, setManualAddError] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [addingBookId, setAddingBookId] = useState<string | null>(null);
  const [removingOptionId, setRemovingOptionId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editRating, setEditRating] = useState("");
  const [editSource, setEditSource] = useState<StoredBookDetails["source"]>("manual");
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [rankingOrder, setRankingOrder] = useState<string[]>([]);
  const [draftRating, setDraftRating] = useState<number>(0);
  const [ratingNotice, setRatingNotice] = useState<string | null>(null);
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);
  const [isRankingDragging, setIsRankingDragging] = useState(false);
  const [expandedVotingOptionIds, setExpandedVotingOptionIds] = useState<Record<string, boolean>>({});
  const bookSearchCacheRef = useRef<Map<string, BookSearchResult[]>>(new Map());
  const lastBookSearchAtRef = useRef<number>(0);

  useEffect(() => {
    setRankingOrder(options.map((option) => option.id));
  }, [options]);

  const userHasSubmitted = useMemo(() => {
    if (!userId) return false;
    return submissions.some((submission) => submission.user_id === userId);
  }, [submissions, userId]);

  const currentUserSubmission = useMemo(() => {
    if (!userId) return null;
    return (
      submissions.find((submission) => submission.user_id === userId) ?? null
    );
  }, [submissions, userId]);

  const currentUserRankingOrder = useMemo(() => {
    if (
      !currentUserSubmission ||
      !Array.isArray(currentUserSubmission.ranking)
    ) {
      return [];
    }
    const entries = [...(currentUserSubmission.ranking as RankingEntry[])].sort(
      (a, b) => a.position - b.position,
    );
    const optionIds = options.map((option) => option.id);
    const optionIdSet = new Set(optionIds);
    const fromSubmission = entries
      .map((entry) => entry.option_id)
      .filter((optionId): optionId is string => optionIdSet.has(optionId));
    const missing = optionIds.filter(
      (optionId) => !fromSubmission.includes(optionId),
    );
    return [...fromSubmission, ...missing];
  }, [currentUserSubmission, options]);

  useEffect(() => {
    if (currentSession?.phase !== "voting") {
      setIsEditingSubmission(false);
    }
  }, [currentSession?.phase]);

  useEffect(() => {
    if (!userId || currentSession?.phase !== "results") {
      setDraftRating(0);
      setRatingNotice(null);
      return;
    }
    setDraftRating(sessionRatings[userId] ?? 0);
    setRatingNotice(null);
  }, [currentSession?.phase, sessionRatings, userId]);

  useEffect(() => {
    if (
      currentSession?.phase === "voting" &&
      userHasSubmitted &&
      isEditingSubmission
    ) {
      setRankingOrder(
        currentUserRankingOrder.length > 0
          ? currentUserRankingOrder
          : options.map((option) => option.id),
      );
    }
  }, [
    currentSession?.phase,
    currentUserRankingOrder,
    isEditingSubmission,
    options,
    userHasSubmitted,
  ]);

  const ratingEntries = useMemo(
    () =>
      Object.entries(sessionRatings)
        .map(([submissionUserId, rating]) => ({
          userId: submissionUserId,
          userName: memberDisplayNames[submissionUserId] ?? submissionUserId,
          rating,
        }))
        .sort((a, b) => b.rating - a.rating),
    [memberDisplayNames, sessionRatings],
  );

  const topOption = useMemo(() => {
    if (!currentSession || !Array.isArray(currentSession.final_ranking))
      return null;
    const first = currentSession.final_ranking[0] as {
      option_id?: string;
      title?: string;
      score?: number;
    };
    if (!first) return null;
    const found = options.find((option) => option.id === first.option_id);
    const metadata = parseStoredBookDetails(found?.details ?? null);
    return {
      title: found?.title ?? first.title ?? "Top book",
      details: metadata?.synopsis ?? found?.details ?? "",
      author: metadata?.author ?? null,
      source: metadata?.source ?? null,
      coverUrl: metadata?.coverUrl ?? null,
      externalRating: metadata?.externalRating ?? null,
      score: typeof first.score === "number" ? first.score : null,
    };
  }, [currentSession, options]);

  const searchBooks = async () => {
    const query = bookQuery.trim();
    if (!query) {
      setBookSearchError("Enter a title, author, or keyword to search.");
      return;
    }
    if (query.length < 2) {
      setBookSearchError("Type at least 2 characters to search.");
      return;
    }

    const queryKey = query.toLowerCase();
    const cached = bookSearchCacheRef.current.get(queryKey);
    if (cached) {
      setBookSearchError(null);
      setBookResults(cached);
      return;
    }

    const now = Date.now();
    if (now - lastBookSearchAtRef.current < BOOK_SEARCH_COOLDOWN_MS) {
      setBookSearchError("Please wait a second before searching again.");
      return;
    }
    lastBookSearchAtRef.current = now;

    setSearchingBooks(true);
    setBookSearchError(null);
    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10`,
      );
      if (response.status === 429) {
        setBookSearchError(
          "Open Library is rate-limiting right now. Wait a moment and try again.",
        );
        setSearchingBooks(false);
        return;
      }
      if (response.status === 403) {
        setBookSearchError(
          "Open Library blocked this request (403). Please try again shortly.",
        );
        setBookResults([]);
        setSearchingBooks(false);
        return;
      }
      if (!response.ok) {
        setBookSearchError(
          `Could not fetch books right now (HTTP ${response.status}).`,
        );
        setBookResults([]);
        setSearchingBooks(false);
        return;
      }

      const payload = (await response.json()) as {
        docs?: Array<{
          key?: string;
          title?: string;
          author_name?: string[];
          first_sentence?:
            | string
            | { value?: string }
            | Array<string | { value?: string }>;
          subject?: string[];
          cover_i?: number;
        }>;
      };

      const nextResults = (payload.docs ?? [])
        .map((doc) => {
          const synopsis = extractOpenLibraryFirstSentence(doc.first_sentence);
          return {
            id:
              doc.key ??
              `${doc.title ?? "book"}-${Math.random().toString(36).slice(2, 8)}`,
            workKey: doc.key ?? null,
            title: doc.title?.trim() || "Untitled",
            author: (doc.author_name ?? []).join(", ") || "Unknown author",
            synopsis,
            tags: (doc.subject ?? []).slice(0, 8),
            coverUrl: doc.cover_i
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
              : null,
          };
        })
        .filter((book) => Boolean(book.title));

      bookSearchCacheRef.current.set(queryKey, nextResults);
      setBookResults(nextResults);
      if (nextResults.length === 0) {
        setBookSearchError("No books found. Try a different query.");
      }
    } catch {
      setBookSearchError("Could not fetch books right now. Please try again.");
      setBookResults([]);
    } finally {
      setSearchingBooks(false);
    }
  };

  const fetchOpenLibraryBookMetadata = async (
    workKey: string | null,
    fallbackSynopsis: string,
    fallbackTags: string[],
  ) => {
    if (!workKey) {
      return {
        synopsis: fallbackSynopsis,
        tags: fallbackTags,
        externalRating: null as number | null,
      };
    }

    let synopsis = fallbackSynopsis;
    let tags = fallbackTags;
    let externalRating: number | null = null;

    try {
      const workResponse = await fetch(
        `https://openlibrary.org${workKey}.json`,
      );
      if (workResponse.ok) {
        const workPayload = (await workResponse.json()) as {
          description?: string | { value?: string };
          subjects?: string[];
        };
        const description = extractOpenLibraryDescription(
          workPayload.description,
        );
        if (description) {
          synopsis = description;
        }
        if (
          Array.isArray(workPayload.subjects) &&
          workPayload.subjects.length > 0
        ) {
          tags = workPayload.subjects.slice(0, 8);
        }
      }
    } catch {
      // Keep fallback metadata if details fetch fails.
    }

    try {
      const ratingsResponse = await fetch(
        `https://openlibrary.org${workKey}/ratings.json`,
      );
      if (ratingsResponse.ok) {
        const ratingsPayload = (await ratingsResponse.json()) as {
          summary?: { average?: number };
          average?: number;
          rating?: { average?: number };
        };
        const average =
          ratingsPayload.summary?.average ??
          ratingsPayload.average ??
          ratingsPayload.rating?.average;
        if (typeof average === "number" && Number.isFinite(average)) {
          externalRating = Math.round(average * 10) / 10;
        }
      }
    } catch {
      // Keep null rating if ratings endpoint fails.
    }

    return { synopsis, tags, externalRating };
  };

  const addManualBook = async () => {
    const title = manualTitle.trim();
    const author = manualAuthor.trim();
    const synopsis = manualSynopsis.trim();
    const tags = manualTags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 8);
    const parsedRating = manualRating.trim()
      ? Number.parseFloat(manualRating.trim())
      : null;

    if (!title) {
      setManualAddError("Title is required.");
      return;
    }
    if (!author) {
      setManualAddError("Author is required.");
      return;
    }
    if (parsedRating !== null && (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5)) {
      setManualAddError("Rating must be a number between 0 and 5.");
      return;
    }

    setManualAddError(null);
    setManualSubmitting(true);
    const detailsPayload = JSON.stringify({
      source: "manual",
      synopsis: synopsis || "No synopsis available.",
      author,
      tags,
      coverUrl: null,
      externalRating: parsedRating === null ? null : Math.round(parsedRating * 10) / 10,
    } satisfies StoredBookDetails);

    const ok = await onAddOption(title, detailsPayload);
    setManualSubmitting(false);
    if (ok) {
      setManualTitle("");
      setManualAuthor("");
      setManualTags("");
      setManualSynopsis("");
      setManualRating("");
      setShowManualForm(false);
    }
  };

  const beginEditingOption = (option: OptionRow) => {
    const metadata = parseStoredBookDetails(option.details);
    setEditingOptionId(option.id);
    setEditTitle(option.title);
    setEditAuthor(metadata?.author ?? "");
    setEditTags((metadata?.tags ?? []).join(", "));
    setEditSynopsis(metadata?.synopsis ?? "");
    setEditRating(
      typeof metadata?.externalRating === "number"
        ? metadata.externalRating.toString()
        : "",
    );
    setEditSource((metadata?.source ?? "manual") as StoredBookDetails["source"]);
    setEditCoverUrl(metadata?.coverUrl ?? null);
    setEditError(null);
  };

  const saveOptionEdit = async () => {
    if (!editingOptionId) return;
    const title = editTitle.trim();
    const author = editAuthor.trim();
    const synopsis = editSynopsis.trim();
    const tags = editTags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 8);
    const parsedRating = editRating.trim()
      ? Number.parseFloat(editRating.trim())
      : null;

    if (!title) {
      setEditError("Title is required.");
      return;
    }
    if (!author) {
      setEditError("Author is required.");
      return;
    }
    if (
      parsedRating !== null &&
      (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5)
    ) {
      setEditError("Rating must be a number between 0 and 5.");
      return;
    }

    setEditError(null);
    setEditSubmitting(true);
    const detailsPayload = JSON.stringify({
      source: editSource ?? "manual",
      synopsis: synopsis || "No synopsis available.",
      author,
      tags,
      coverUrl: editCoverUrl,
      externalRating:
        parsedRating === null ? null : Math.round(parsedRating * 10) / 10,
    } satisfies StoredBookDetails);

    const ok = await onUpdateOption(editingOptionId, title, detailsPayload);
    setEditSubmitting(false);
    if (ok) {
      setEditingOptionId(null);
      setEditError(null);
    }
  };

  const moveOptionById = (optionId: string, direction: -1 | 1) => {
    setRankingOrder((prev) => {
      const index = prev.indexOf(optionId);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const orderedOptions = rankingOrder
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is OptionRow => Boolean(option));

  const toggleVotingOptionDetails = (optionId: string) => {
    setExpandedVotingOptionIds((prev) => ({
      ...prev,
      [optionId]: !prev[optionId],
    }));
  };

  const renderVotingRankItem = ({ item, getIndex, drag, isActive }: RenderItemParams<OptionRow>) => {
    const metadata = parseStoredBookDetails(item.details);
    const isExpanded = Boolean(expandedVotingOptionIds[item.id]);
    const rowIndex = (getIndex?.() ?? orderedOptions.findIndex((option) => option.id === item.id)) + 1;
    return (
      <View
        className={`mb-[10px] select-none rounded-[14px] border p-[10px] ${
          isActive ? "border-[#8CCFCD] bg-[#F7FFFE]" : "border-[#E7ECF2] bg-white"
        }`}
        style={
          isActive
            ? {
                transform: [{ scale: 1.015 }],
                shadowColor: "#111D35",
                shadowOpacity: 0.16,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
                elevation: 7,
                zIndex: 20,
              }
            : undefined
        }
      >
        <View className="flex-row items-center">
          <View className="mr-[6px] w-[22px] items-center">
            <Pressable onPress={() => moveOptionById(item.id, -1)}>
              <ChevronUp size={14} color="#95A1B5" strokeWidth={2.5} />
            </Pressable>
            <Pressable
              className="my-[2px] h-[22px] w-[20px] select-none items-center justify-center"
              onLongPress={drag}
              delayLongPress={80}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <GripVertical size={16} color="#95A1B5" strokeWidth={2.5} />
            </Pressable>
            <Pressable onPress={() => moveOptionById(item.id, 1)}>
              <ChevronDown size={14} color="#95A1B5" strokeWidth={2.5} />
            </Pressable>
          </View>
          <View className="mr-[10px] h-[34px] w-[34px] items-center justify-center rounded-full bg-[#E9FFF8]">
            <Text className="font-bold text-[#2E9A98]">{Math.max(rowIndex, 1)}</Text>
          </View>
          <View className="flex-1 pr-[8px]">
            <Text className="text-[18px] font-bold text-[#111D35]">{item.title}</Text>
            <Text className="mt-[2px] text-[15px] text-[#4D5A71]">
              {metadata?.author ?? "Unknown author"}
            </Text>
          </View>
          <Pressable
            className="h-8 w-8 items-center justify-center rounded-[8px] bg-[#F2F5F8]"
            onPress={() => toggleVotingOptionDetails(item.id)}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            {isExpanded ? (
              <ChevronUp size={18} color="#5C6D89" strokeWidth={2.3} />
            ) : (
              <ChevronDown size={18} color="#5C6D89" strokeWidth={2.3} />
            )}
          </Pressable>
        </View>
        {isExpanded ? (
          <View className="mt-[8px] border-t border-[#E9EEF5] pt-[8px]">
            <Text className="text-[13px] text-[#4F5E76]">
              {metadata?.synopsis?.trim() || "No synopsis available."}
            </Text>
            {metadata?.tags && metadata.tags.length > 0 ? (
              <Text className="mt-[5px] text-[12px] text-[#6D7890]">
                Tags: {metadata.tags.join(", ")}
              </Text>
            ) : null}
            {typeof metadata?.externalRating === "number" ? (
              <Text className="mt-[5px] text-[12px] text-[#6D7890]">
                {ratingLabel(metadata.source)} rating: {metadata.externalRating.toFixed(1)} / 5
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const existingBookKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const option of options) {
      const metadata = parseStoredBookDetails(option.details);
      const author = metadata?.author ?? "";
      keys.add(normalizeBookKey(option.title, author));
    }
    return keys;
  }, [options]);

  return (
    <View className="flex-1 w-full self-stretch bg-white">
      <SessionHeader
        groupName={activeGroupName ?? "No group selected"}
        sessionName={currentSession?.title ?? "No active session"}
        phase={currentSession?.phase ?? null}
      />

      <ScrollView
        className="flex-1 w-full"
        contentContainerClassName="w-full px-[14px] pb-[22px] pt-[14px]"
        scrollEnabled={!isRankingDragging}
      >
        {error ? (
          <Text className="mb-[10px] text-[13px] text-[#9F1D1D]">{error}</Text>
        ) : null}
        {currentSession?.phase === "voting" ? (
          <View className="mb-[8px] items-start">
            <Pressable
              onPress={async () => {
                const ok = await onUpdateSessionPhase("brainstorming");
                if (ok) {
                  setIsEditingSubmission(false);
                }
              }}
              hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              className="flex-row items-center"
            >
              <ChevronLeft size={14} color="#4A5D80" strokeWidth={2.5} />
              <Text className="ml-[2px] text-[13px] font-semibold text-[#4A5D80]">
                Back to brainstorming
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!currentSession ? (
          <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
            <Text className="mb-[10px] text-[20px] font-bold text-[#111D35]">
              No active session
            </Text>
            <Text className="mb-[10px] text-[15px] text-[#4C5870]">
              Create a new session to start brainstorming and voting.
            </Text>
            <TextInput
              className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
              value={newSessionTitle}
              onChangeText={setNewSessionTitle}
              placeholder="Session title (e.g. Book Club - April 2026)"
              placeholderTextColor="#A2AABC"
            />
            <PrimaryActionButton
              label="Create Session"
              icon={<Plus size={20} color="#FFFFFF" strokeWidth={2.5} />}
              onPress={() => void onCreateSession(newSessionTitle)}
              disabled={!newSessionTitle.trim()}
            />
          </View>
        ) : null}

        {currentSession?.phase === "brainstorming" ? (
          <>
            <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
              <Text className="mb-[10px] text-[20px] font-bold text-[#111D35]">
                Search books
              </Text>
              <TextInput
                className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[17px] text-[#111D35]"
                value={bookQuery}
                onChangeText={setBookQuery}
                placeholder="Search by title, author, or keyword"
                placeholderTextColor="#A2AABC"
              />
              <PrimaryActionButton
                label={searchingBooks ? "Searching..." : "Search Books"}
                icon={<Search size={20} color="#FFFFFF" strokeWidth={2.5} />}
                onPress={() => void searchBooks()}
                disabled={!bookQuery.trim() || searchingBooks}
              />
              <Text className="mt-2 text-[13px] text-[#4D5A71]">
                Choose a result to add. We auto-fill cover, synopsis, author,
                and tags.
              </Text>
              {bookSearchError ? (
                <Text className="mt-2 text-[13px] text-[#9F1D1D]">
                  {bookSearchError}
                </Text>
              ) : null}
            </View>
            <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
              <Pressable
                className="h-11 items-center justify-center rounded-[10px] bg-[#ECEEF3]"
                onPress={() => setShowManualForm((prev) => !prev)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <Text className="text-[13px] font-bold text-[#273655]">
                  {showManualForm ? "Hide manual form" : "Add manually"}
                </Text>
              </Pressable>
              {showManualForm ? (
                <View className="mt-3">
                  <TextInput
                    className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[16px] text-[#111D35]"
                    value={manualTitle}
                    onChangeText={setManualTitle}
                    placeholder="Book title"
                    placeholderTextColor="#A2AABC"
                  />
                  <TextInput
                    className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[16px] text-[#111D35]"
                    value={manualAuthor}
                    onChangeText={setManualAuthor}
                    placeholder="Author"
                    placeholderTextColor="#A2AABC"
                  />
                  <TextInput
                    className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[16px] text-[#111D35]"
                    value={manualTags}
                    onChangeText={setManualTags}
                    placeholder="Tags (comma separated)"
                    placeholderTextColor="#A2AABC"
                  />
                  <TextInput
                    className="mb-[10px] min-h-[92px] rounded-xl border border-[#E7ECF2] px-[14px] py-[10px] text-[16px] text-[#111D35]"
                    value={manualSynopsis}
                    onChangeText={setManualSynopsis}
                    placeholder="Synopsis"
                    placeholderTextColor="#A2AABC"
                    multiline
                    textAlignVertical="top"
                  />
                  <TextInput
                    className="mb-[10px] h-12 rounded-xl border border-[#E7ECF2] px-[14px] text-[16px] text-[#111D35]"
                    value={manualRating}
                    onChangeText={setManualRating}
                    placeholder="Rating out of 5 (e.g. 4.5)"
                    placeholderTextColor="#A2AABC"
                    keyboardType="decimal-pad"
                  />
                  <Text className="mb-[10px] text-[12px] text-[#6D7890]">
                    Source: manual
                  </Text>
                  {manualAddError ? (
                    <Text className="mb-[8px] text-[13px] text-[#9F1D1D]">
                      {manualAddError}
                    </Text>
                  ) : null}
                  <PrimaryActionButton
                    label="Add manually"
                    icon={<Plus size={19} color="#FFFFFF" strokeWidth={2.5} />}
                    onPress={() => void addManualBook()}
                    disabled={!manualTitle.trim() || !manualAuthor.trim()}
                    loading={manualSubmitting}
                  />
                </View>
              ) : null}
            </View>
            {bookResults.length > 0 ? (
              <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
                <Text className="mb-2 text-[16px] font-bold text-[#2A3550]">
                  Search results
                </Text>
                {bookResults.map((book) => {
                  const alreadyAdded = existingBookKeys.has(
                    normalizeBookKey(book.title, book.author),
                  );
                  const isAdding = addingBookId === book.id;
                  return (
                  <View
                    key={book.id}
                    className="mb-[10px] rounded-[12px] border border-[#E7ECF2] p-[10px]"
                  >
                    <View className="flex-row">
                      <BookCover
                        coverUrl={book.coverUrl}
                        className="mr-[10px] h-[80px] w-[54px] rounded-[8px] bg-[#D7E0EA]"
                      />
                      <View className="flex-1">
                        <Text className="text-[16px] font-bold text-[#111D35]">
                          {book.title}
                        </Text>
                        <Text className="mt-[2px] text-[14px] text-[#4D5A71]">
                          {book.author}
                        </Text>
                        {book.synopsis ? (
                          <Text
                            className="mt-[2px] text-[13px] text-[#5B6780]"
                            numberOfLines={3}
                          >
                            {book.synopsis}
                          </Text>
                        ) : (
                          <Text className="mt-[2px] text-[12px] text-[#7A879E]">
                            Detailed synopsis will be fetched when you add this book.
                          </Text>
                        )}
                        {book.tags.length > 0 ? (
                          <Text className="mt-[2px] text-[12px] text-[#6D7890]">
                            Tags: {book.tags.join(", ")}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      className={`mt-[8px] h-9 items-center justify-center rounded-[8px] ${
                        alreadyAdded ? "bg-[#A7B4C8]" : "bg-[#2E9A98]"
                      }`}
                      onPress={async () => {
                        if (alreadyAdded) return;
                        setAddingBookId(book.id);
                        try {
                          const enriched = await fetchOpenLibraryBookMetadata(
                            book.workKey,
                            book.synopsis,
                            book.tags,
                          );
                          const detailsPayload = JSON.stringify({
                            source: "open-library",
                            synopsis: enriched.synopsis,
                            author: book.author,
                            tags: enriched.tags,
                            coverUrl: book.coverUrl,
                            externalRating: enriched.externalRating,
                          } satisfies StoredBookDetails);
                          const ok = await onAddOption(
                            book.title,
                            detailsPayload,
                          );
                          if (ok) {
                            setBookSearchError(null);
                          }
                        } finally {
                          setAddingBookId(null);
                        }
                      }}
                      disabled={isAdding || alreadyAdded}
                      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                    >
                      {isAdding ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : alreadyAdded ? (
                        <Text className="text-[13px] font-bold text-white">
                          Already added
                        </Text>
                      ) : (
                        <Text className="text-[13px] font-bold text-white">
                          Add Book
                        </Text>
                      )}
                    </Pressable>
                  </View>
                  );
                })}
              </View>
            ) : null}
            <Text className="mb-[10px] mt-1 text-[16px] font-bold text-[#2A3550]">
              {options.length} books
            </Text>
            {options.length === 0 ? (
              <EmptyCard text="No books yet. Add the first one above." />
            ) : (
              options.map((option) => {
                const metadata = parseStoredBookDetails(option.details);
                return (
                  <View key={option.id}>
                    <View className="mb-[10px] flex-row items-center rounded-[14px] border border-[#E7ECF2] bg-white p-[10px]">
                      <BookCover
                        coverUrl={metadata?.coverUrl ?? null}
                        className="mr-[10px] h-[60px] w-[46px] rounded-lg bg-[#C8D6E3]"
                      />
                      <View className="flex-1">
                        <Text className="text-[18px] font-bold text-[#111D35]">
                          {option.title}
                        </Text>
                        <Text className="mt-[2px] text-[15px] text-[#4D5A71]">
                          {metadata?.author ?? "Unknown author"}
                        </Text>
                        {typeof metadata?.externalRating === "number" ? (
                          <Text className="mt-[1px] text-[13px] text-[#6D7890]">
                            {ratingLabel(metadata.source)} rating:{" "}
                            {metadata.externalRating.toFixed(1)} / 5
                          </Text>
                        ) : null}
                        {metadata?.tags && metadata.tags.length > 0 ? (
                          <Text className="mt-[1px] text-[13px] text-[#6D7890]">
                            Tags: {metadata.tags.join(", ")}
                          </Text>
                        ) : null}
                      </View>
                      <View className="ml-[8px] flex-row items-center">
                        <Pressable
                          className="mr-[6px] h-9 w-9 items-center justify-center rounded-[9px] bg-[#EEF2FF]"
                          onPress={() => beginEditingOption(option)}
                          hitSlop={6}
                          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        >
                          <Pencil size={16} color="#344B7A" strokeWidth={2.4} />
                        </Pressable>
                        <Pressable
                          className="h-9 w-9 items-center justify-center rounded-[9px] bg-[#FEEFF0]"
                          onPress={async () => {
                            setRemovingOptionId(option.id);
                            try {
                              await onRemoveOption(option.id);
                            } finally {
                              setRemovingOptionId(null);
                            }
                          }}
                          hitSlop={6}
                          disabled={removingOptionId === option.id}
                          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        >
                          {removingOptionId === option.id ? (
                            <ActivityIndicator color="#B42318" />
                          ) : (
                            <Trash2 size={16} color="#B42318" strokeWidth={2.4} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                    {editingOptionId === option.id ? (
                    <View className="mt-[10px] rounded-[12px] border border-[#E7ECF2] bg-[#FAFBFD] p-[10px]">
                      <Text className="mb-[8px] text-[15px] font-bold text-[#273655]">
                        Edit book details
                      </Text>
                      <TextInput
                        className="mb-[8px] h-11 rounded-lg border border-[#E7ECF2] px-[12px] text-[15px] text-[#111D35]"
                        value={editTitle}
                        onChangeText={setEditTitle}
                        placeholder="Book title"
                        placeholderTextColor="#A2AABC"
                      />
                      <TextInput
                        className="mb-[8px] h-11 rounded-lg border border-[#E7ECF2] px-[12px] text-[15px] text-[#111D35]"
                        value={editAuthor}
                        onChangeText={setEditAuthor}
                        placeholder="Author"
                        placeholderTextColor="#A2AABC"
                      />
                      <TextInput
                        className="mb-[8px] h-11 rounded-lg border border-[#E7ECF2] px-[12px] text-[15px] text-[#111D35]"
                        value={editTags}
                        onChangeText={setEditTags}
                        placeholder="Tags (comma separated)"
                        placeholderTextColor="#A2AABC"
                      />
                      <TextInput
                        className="mb-[8px] min-h-[84px] rounded-lg border border-[#E7ECF2] px-[12px] py-[9px] text-[15px] text-[#111D35]"
                        value={editSynopsis}
                        onChangeText={setEditSynopsis}
                        placeholder="Synopsis"
                        placeholderTextColor="#A2AABC"
                        multiline
                        textAlignVertical="top"
                      />
                      <TextInput
                        className="mb-[8px] h-11 rounded-lg border border-[#E7ECF2] px-[12px] text-[15px] text-[#111D35]"
                        value={editRating}
                        onChangeText={setEditRating}
                        placeholder="Rating out of 5"
                        placeholderTextColor="#A2AABC"
                        keyboardType="decimal-pad"
                      />
                      <TextInput
                        className="mb-[8px] h-11 rounded-lg border border-[#E7ECF2] px-[12px] text-[15px] text-[#111D35]"
                        value={editSource ?? ""}
                        onChangeText={(value) => setEditSource(value as StoredBookDetails["source"])}
                        placeholder="Source (manual/open-library)"
                        placeholderTextColor="#A2AABC"
                      />
                      {editError ? (
                        <Text className="mb-[8px] text-[13px] text-[#9F1D1D]">
                          {editError}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center justify-end">
                        <Pressable
                          className="mr-[8px] rounded-lg bg-[#ECEEF3] px-3 py-2"
                          onPress={() => setEditingOptionId(null)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        >
                          <Text className="text-[13px] font-bold text-[#273655]">
                            Cancel
                          </Text>
                        </Pressable>
                        <Pressable
                          className={`h-9 min-w-[82px] items-center justify-center rounded-lg ${
                            editSubmitting ? "bg-[#8FC8C7]" : "bg-[#2E9A98]"
                          }`}
                          onPress={() => void saveOptionEdit()}
                          disabled={editSubmitting}
                          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                        >
                          {editSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text className="text-[13px] font-bold text-white">Save</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        ) : null}

        {currentSession?.phase === "voting" &&
        (!userHasSubmitted || isEditingSubmission) ? (
          <>
            <View className="mb-[14px] rounded-xl border border-[#D4F5E9] bg-[#FAFFFD] p-3">
              <Text className="text-[14px] text-[#246F70]">
                Drag books to rank them. Top = most preferred.
              </Text>
            </View>
            <Text className="mb-[10px] mt-1 text-[16px] font-bold text-[#2A3550]">
              Your ranking
            </Text>
            {orderedOptions.length === 0 ? (
              <EmptyCard text="No books available for ranking." />
            ) : (
              <DraggableFlatList
                data={orderedOptions}
                keyExtractor={(item) => item.id}
                renderItem={renderVotingRankItem}
                onDragBegin={() => setIsRankingDragging(true)}
                onDragEnd={({ data }) => {
                  setIsRankingDragging(false);
                  setRankingOrder(data.map((item) => item.id));
                }}
                activationDistance={2}
                scrollEnabled={false}
                containerStyle={{ flexGrow: 0 }}
              />
            )}
          </>
        ) : null}

        {currentSession?.phase === "voting" &&
        userHasSubmitted &&
        !isEditingSubmission ? (
          <View className="items-center pb-3 pt-[30px]">
            <View className="mb-5 h-[110px] w-[110px] items-center justify-center rounded-full bg-[#E9FFF8]">
              <Send size={50} color="#2E9A98" strokeWidth={2.4} />
            </View>
            <Text className="mb-2 text-[21px] font-bold text-[#111D35]">
              Ranking submitted!
            </Text>
            <Text className="max-w-[330px] text-center text-[16px] text-[#4C5870]">
              Waiting for other members to submit their rankings.
            </Text>
            <View className="mt-6 w-[86%] flex-row items-center justify-between">
              <Text className="text-[17px] text-[#4C5870]">
                Submissions received
              </Text>
              <Text className="text-[17px] font-bold text-[#111D35]">
                {submissions.length}
              </Text>
            </View>
            <Pressable
              className="mt-4 h-10 rounded-[10px] bg-[#ECEEF3] px-4 items-center justify-center"
              onPress={() => setIsEditingSubmission(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Text className="text-[13px] font-bold text-[#273655]">
                Edit my submission
              </Text>
            </Pressable>
          </View>
        ) : null}

        {currentSession?.phase === "results" ? (
          <>
            <View className="mb-[14px] rounded-[14px] bg-[#223551] p-[14px]">
              <Text className="text-[18px] font-bold text-white">
                Final Weighted Ranking
              </Text>
              <Text className="mt-2 text-[15px] text-[#D4E0EF]">
                Based on Kemeny-Young method with member weights
              </Text>
            </View>
            {topOption ? (
              <View className="mb-3 flex-row items-center rounded-[14px] border border-[#E7ECF2] bg-white p-[10px]">
                {topOption.coverUrl ? (
                  <BookCover
                    coverUrl={topOption.coverUrl}
                    className="mr-[10px] h-[60px] w-[46px] rounded-lg bg-[#C8D6E3]"
                  />
                ) : (
                  <View className="mr-[10px] h-[34px] w-[34px] items-center justify-center rounded-full bg-[#FFF5CC]">
                    <Text className="font-bold text-[#7A6700]">1</Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-[18px] font-bold text-[#111D35]">
                    {topOption.title}
                  </Text>
                  <Text className="mt-[2px] text-[15px] text-[#4D5A71]">
                    {topOption.author || "Unknown author"}
                  </Text>
                  {typeof topOption.externalRating === "number" ? (
                    <Text className="mt-[2px] text-[13px] text-[#6D7890]">
                      {ratingLabel(topOption.source)} rating: {topOption.externalRating.toFixed(1)}{" "}
                      / 5
                    </Text>
                  ) : null}
                  <Text className="mt-[2px] text-[14px] text-[#5B6780]">
                    {topOption.details || "Top result"}
                  </Text>
                  <Text className="mt-[6px] text-[15px] text-[#4B5871]">
                    Score:{" "}
                    {typeof topOption.score === "number"
                      ? topOption.score.toFixed(2)
                      : "n/a"}
                  </Text>
                </View>
              </View>
            ) : (
              <EmptyCard text="No final ranking has been published to the session yet." />
            )}
            {userId ? (
              <View className="mb-3 rounded-[14px] border border-[#E7ECF2] bg-white p-[12px]">
                <Text className="text-[16px] font-bold text-[#111D35]">
                  Your rating
                </Text>
                <Text className="mt-[2px] text-[13px] text-[#5B6780]">
                  Tap left/right half of each star for 0.5 increments.
                </Text>
                <View className="mt-2 flex-row items-center">
                  {[1, 2, 3, 4, 5].map((starNumber) => {
                    const fill = starFill(draftRating, starNumber);
                    return (
                      <View key={starNumber} className="mr-[6px] h-7 w-7">
                        <Star size={24} color="#CBD5E1" strokeWidth={2.2} />
                        <View
                          className="absolute left-0 top-0 h-7 overflow-hidden"
                          style={{ width: 24 * fill }}
                        >
                          <Star
                            size={24}
                            color="#F4C542"
                            fill="#F4C542"
                            strokeWidth={2.2}
                          />
                        </View>
                        <View className="absolute inset-0 flex-row">
                          <Pressable
                            className="h-full w-1/2"
                            onPress={() => setDraftRating(starNumber - 0.5)}
                          />
                          <Pressable
                            className="h-full w-1/2"
                            onPress={() => setDraftRating(starNumber)}
                          />
                        </View>
                      </View>
                    );
                  })}
                  <Text className="ml-1 text-[14px] font-bold text-[#4B5871]">
                    {draftRating.toFixed(1)}
                  </Text>
                </View>
                <Pressable
                  className={`mt-3 h-10 items-center justify-center rounded-[10px] ${
                    draftRating > 0 ? "bg-[#2E9A98]" : "bg-[#A7B4C8]"
                  }`}
                  onPress={async () => {
                    setSubmittingRating(true);
                    try {
                      const ok = await onSubmitSessionRating(draftRating);
                      if (ok) {
                        setRatingNotice("Rating submitted.");
                      }
                    } finally {
                      setSubmittingRating(false);
                    }
                  }}
                  disabled={draftRating <= 0 || submittingRating}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  {submittingRating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-[14px] font-bold text-white">
                      Submit
                    </Text>
                  )}
                </Pressable>
                {ratingNotice ? (
                  <Text className="mt-2 text-[13px] text-[#177245]">
                    {ratingNotice}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text className="mb-[10px] mt-1 text-[16px] font-bold text-[#2A3550]">
              Everyone&apos;s ratings
            </Text>
            {ratingEntries.length === 0 ? (
              <EmptyCard text="No ratings submitted yet." />
            ) : (
              ratingEntries.map((entry) => (
                <View
                  key={entry.userId}
                  className="mb-2 rounded-xl border border-[#E7ECF2] bg-white p-3"
                >
                  <Text className="mb-1 text-[17px] font-bold text-[#111D35]">
                    {entry.userName}
                  </Text>
                  <View className="flex-row items-center">
                    {[1, 2, 3, 4, 5].map((starNumber) => {
                      const fill = starFill(entry.rating, starNumber);
                      return (
                        <View key={starNumber} className="mr-[5px] h-6 w-6">
                          <Star size={22} color="#CBD5E1" strokeWidth={2.2} />
                          <View
                            className="absolute left-0 top-0 h-6 overflow-hidden"
                            style={{ width: 22 * fill }}
                          >
                            <Star
                              size={22}
                              color="#F4C542"
                              fill="#F4C542"
                              strokeWidth={2.2}
                            />
                          </View>
                        </View>
                      );
                    })}
                    <Text className="ml-1 text-[13px] font-semibold text-[#4B5871]">
                      {entry.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      <View className="border-t border-[#EEF1F5] bg-white px-[14px] pb-3 pt-2">
        {currentSession?.phase === "brainstorming" ? (
          <PrimaryActionButton
            label="Start Voting"
            icon={<Play size={21} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => void onUpdateSessionPhase("voting")}
            disabled={options.length < 2}
          />
        ) : null}
        {currentSession?.phase === "voting" &&
        (!userHasSubmitted || isEditingSubmission) ? (
          <PrimaryActionButton
            label={userHasSubmitted ? "Update Ranking" : "Submit Ranking"}
            icon={<Send size={19} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={async () => {
              const ok = await onSubmitRanking(rankingOrder);
              if (ok) {
                setIsEditingSubmission(false);
              }
            }}
            disabled={rankingOrder.length === 0}
          />
        ) : null}
        {currentSession?.phase === "voting" &&
        userHasSubmitted &&
        !isEditingSubmission ? (
          <PrimaryActionButton
            label="Finish Voting"
            icon={<Trophy size={21} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => void onUpdateSessionPhase("results")}
            color="#22B6AA"
          />
        ) : null}
        {currentSession?.phase === "results" ? (
          <PrimaryActionButton
            label="Finish Session"
            icon={<Check size={22} color="#FFFFFF" strokeWidth={2.5} />}
            onPress={() => void onUpdateSessionPhase("closed")}
            color="#273655"
          />
        ) : null}
      </View>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View className="mb-[10px] rounded-xl border border-[#E7ECF2] p-3">
      <Text className="text-[15px] text-[#4D5A71]">{text}</Text>
    </View>
  );
}

function BookCover({ coverUrl, className }: { coverUrl: string | null; className: string }) {
  const candidates = useMemo(() => buildCoverCandidates(coverUrl), [coverUrl]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const activeUri = candidates[candidateIndex] ?? null;

  if (!activeUri) {
    return <View className={className} />;
  }

  return (
    <Image
      source={{ uri: activeUri }}
      className={className}
      onError={() => {
        if (candidateIndex < candidates.length - 1) {
          setCandidateIndex((prev) => prev + 1);
        }
      }}
    />
  );
}

function starFill(rating: number, starNumber: number) {
  const diff = rating - (starNumber - 1);
  if (diff >= 1) return 1;
  if (diff >= 0.5) return 0.5;
  return 0;
}

function buildCoverCandidates(coverUrl: string | null) {
  if (!coverUrl) {
    return [];
  }
  const normalized = coverUrl.trim().replace(/^http:\/\//i, "https://");
  if (!normalized) {
    return [];
  }
  const withoutProtocol = normalized.replace(/^https?:\/\//i, "");
  const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(withoutProtocol)}`;
  return [normalized, proxyUrl];
}

function normalizeBookKey(title: string, author: string) {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedAuthor = author.trim().toLowerCase();
  return `${normalizedTitle}::${normalizedAuthor}`;
}

function ratingLabel(source: StoredBookDetails["source"] | null | undefined) {
  if (source === "manual") {
    return "Manual";
  }
  return "Open Library";
}

function parseStoredBookDetails( //redeployed
  details: string | null,
): StoredBookDetails | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as StoredBookDetails;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractOpenLibraryFirstSentence(
  firstSentence:
    | string
    | { value?: string }
    | Array<string | { value?: string }>
    | undefined,
) {
  if (!firstSentence) return "";
  if (typeof firstSentence === "string") {
    return firstSentence.trim();
  }
  if (Array.isArray(firstSentence)) {
    const first = firstSentence[0];
    if (typeof first === "string") return first.trim();
    return first?.value?.trim() ?? "";
  }
  return firstSentence.value?.trim() ?? "";
}

function extractOpenLibraryDescription(
  description: string | { value?: string } | undefined,
) {
  if (!description) return "";
  if (typeof description === "string") {
    return description.trim();
  }
  return description.value?.trim() ?? "";
}
