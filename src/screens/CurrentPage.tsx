import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Play,
  Plus,
  Search,
  Send,
  Star,
  Trophy,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
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
  onUpdateSessionPhase: (phase: SessionPhase) => Promise<boolean>;
  onSubmitRanking: (orderedOptionIds: string[]) => Promise<boolean>;
  onSubmitSessionRating: (rating: number) => Promise<boolean>;
};

type RankingEntry = { option_id: string; position: number };
type StoredBookDetails = {
  source?: "open-library";
  synopsis?: string;
  author?: string;
  tags?: string[];
  coverUrl?: string | null;
};
type BookSearchResult = {
  id: string;
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
  onUpdateSessionPhase,
  onSubmitRanking,
  onSubmitSessionRating,
}: Props) {
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [bookSearchError, setBookSearchError] = useState<string | null>(null);
  const [rankingOrder, setRankingOrder] = useState<string[]>([]);
  const [draftRating, setDraftRating] = useState<number>(0);
  const [ratingNotice, setRatingNotice] = useState<string | null>(null);
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);
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
      coverUrl: metadata?.coverUrl ?? null,
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
            title: doc.title?.trim() || "Untitled",
            author: (doc.author_name ?? []).join(", ") || "Unknown author",
            synopsis: synopsis || "No synopsis available.",
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

  const moveOption = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rankingOrder.length) return;
    const next = [...rankingOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setRankingOrder(next);
  };

  const orderedOptions = rankingOrder
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is OptionRow => Boolean(option));

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
      >
        {error ? (
          <Text className="mb-[10px] text-[13px] text-[#9F1D1D]">{error}</Text>
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
            {bookResults.length > 0 ? (
              <View className="mb-[14px] rounded-[14px] border border-[#E7ECF2] bg-white p-[14px]">
                <Text className="mb-2 text-[16px] font-bold text-[#2A3550]">
                  Search results
                </Text>
                {bookResults.map((book) => (
                  <View
                    key={book.id}
                    className="mb-[10px] rounded-[12px] border border-[#E7ECF2] p-[10px]"
                  >
                    <View className="flex-row">
                      {book.coverUrl ? (
                        <Image
                          source={{ uri: book.coverUrl }}
                          className="mr-[10px] h-[80px] w-[54px] rounded-[8px] bg-[#D7E0EA]"
                        />
                      ) : (
                        <View className="mr-[10px] h-[80px] w-[54px] rounded-[8px] bg-[#C8D6E3]" />
                      )}
                      <View className="flex-1">
                        <Text className="text-[16px] font-bold text-[#111D35]">
                          {book.title}
                        </Text>
                        <Text className="mt-[2px] text-[14px] text-[#4D5A71]">
                          {book.author}
                        </Text>
                        <Text
                          className="mt-[2px] text-[13px] text-[#5B6780]"
                          numberOfLines={3}
                        >
                          {book.synopsis}
                        </Text>
                        {book.tags.length > 0 ? (
                          <Text className="mt-[2px] text-[12px] text-[#6D7890]">
                            Tags: {book.tags.join(", ")}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      className="mt-[8px] h-9 items-center justify-center rounded-[8px] bg-[#2E9A98]"
                      onPress={async () => {
                        const detailsPayload = JSON.stringify({
                          source: "open-library",
                          synopsis: book.synopsis,
                          author: book.author,
                          tags: book.tags,
                          coverUrl: book.coverUrl,
                        } satisfies StoredBookDetails);
                        const ok = await onAddOption(
                          book.title,
                          detailsPayload,
                        );
                        if (ok) {
                          setBookSearchError(null);
                        }
                      }}
                    >
                      <Text className="text-[13px] font-bold text-white">
                        Add Book
                      </Text>
                    </Pressable>
                  </View>
                ))}
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
                  <View
                    key={option.id}
                    className="mb-[10px] flex-row items-center rounded-[14px] border border-[#E7ECF2] bg-white p-[10px]"
                  >
                    {metadata?.coverUrl ? (
                      <Image
                        source={{ uri: metadata.coverUrl }}
                        className="mr-[10px] h-[60px] w-[46px] rounded-lg bg-[#C8D6E3]"
                      />
                    ) : (
                      <View className="mr-[10px] h-[60px] w-[46px] rounded-lg bg-[#C8D6E3]" />
                    )}
                    <View className="flex-1">
                      <Text className="text-[18px] font-bold text-[#111D35]">
                        {option.title}
                      </Text>
                      <Text className="mt-[2px] text-[15px] text-[#4D5A71]">
                        {metadata?.author ?? "Unknown author"}
                      </Text>
                      {metadata?.tags && metadata.tags.length > 0 ? (
                        <Text className="mt-[1px] text-[13px] text-[#6D7890]">
                          Tags: {metadata.tags.join(", ")}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      className="ml-[8px] h-9 w-9 items-center justify-center rounded-[9px] bg-[#FEEFF0]"
                      onPress={() => void onRemoveOption(option.id)}
                      hitSlop={6}
                    >
                      <Trash2 size={16} color="#B42318" strokeWidth={2.4} />
                    </Pressable>
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
              orderedOptions.map((option, index) => {
                const metadata = parseStoredBookDetails(option.details);
                return (
                  <View
                    key={option.id}
                    className="mb-[10px] flex-row items-center rounded-[14px] border border-[#E7ECF2] bg-white p-[10px]"
                  >
                    <View className="mr-[6px] w-[22px] items-center">
                      <Pressable onPress={() => moveOption(index, -1)}>
                        <ChevronUp
                          size={14}
                          color="#95A1B5"
                          strokeWidth={2.5}
                        />
                      </Pressable>
                      <GripVertical
                        size={16}
                        color="#95A1B5"
                        strokeWidth={2.5}
                      />
                      <Pressable onPress={() => moveOption(index, 1)}>
                        <ChevronDown
                          size={14}
                          color="#95A1B5"
                          strokeWidth={2.5}
                        />
                      </Pressable>
                    </View>
                    <View className="mr-[10px] h-[34px] w-[34px] items-center justify-center rounded-full bg-[#E9FFF8]">
                      <Text className="font-bold text-[#2E9A98]">
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[18px] font-bold text-[#111D35]">
                        {option.title}
                      </Text>
                      <Text className="mt-[2px] text-[15px] text-[#4D5A71]">
                        {metadata?.author ?? "Unknown author"}
                      </Text>
                    </View>
                  </View>
                );
              })
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
                  <Image
                    source={{ uri: topOption.coverUrl }}
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
                    const ok = await onSubmitSessionRating(draftRating);
                    if (ok) {
                      setRatingNotice("Rating submitted.");
                    }
                  }}
                  disabled={draftRating <= 0}
                >
                  <Text className="text-[14px] font-bold text-white">
                    Submit
                  </Text>
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

function starFill(rating: number, starNumber: number) {
  const diff = rating - (starNumber - 1);
  if (diff >= 1) return 1;
  if (diff >= 0.5) return 0.5;
  return 0;
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
