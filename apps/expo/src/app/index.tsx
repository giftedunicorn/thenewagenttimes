import type { OnViewableItemsChanged } from "@legendapp/list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterInputs, RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import {
  getExpoNewsArticleSourceUrl,
  readOrCreateNewsVisitorKey,
} from "~/utils/news-reader";

type NewsFeedItem = RouterOutputs["news"]["forYou"][number];
type SavedNewsItem = RouterOutputs["news"]["saved"][number];
type GuardrailNewsItem = RouterOutputs["news"]["guardrails"][number];
type HistoryNewsItem = RouterOutputs["news"]["history"][number];
type MobileNewsCategory = NonNullable<
  RouterInputs["news"]["forYou"]["category"]
>;
type MobileNewsProfile = RouterInputs["news"]["updateProfile"]["profile"];
type NewsFeedbackAction = "click_source" | "hide" | "save" | "share";

const mobileCategoryChannels = [
  { category: null, label: "For You" },
  { category: "model_release", label: "Models" },
  { category: "agent_product", label: "Agents" },
  { category: "funding", label: "Funding" },
  { category: "research", label: "Research" },
  { category: "policy", label: "Policy" },
] as const satisfies readonly {
  category: MobileNewsCategory | null;
  label: string;
}[];

const mobileNewsProfileCategories = [
  "agent_product",
  "big_tech",
  "funding",
  "hot_take",
  "market_map",
  "model_release",
  "musk_ai",
  "new_concept",
  "open_source",
  "other",
  "policy",
  "product_hunt",
  "research",
  "security",
  "yc_ai",
] as const satisfies readonly MobileNewsProfile["preferredCategories"][number][];

const isMobileNewsProfileCategory = (
  category: string,
): category is MobileNewsProfile["preferredCategories"][number] =>
  mobileNewsProfileCategories.some(
    (profileCategory) => profileCategory === category,
  );

const formatCategory = (category: string) =>
  category
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

const formatPublishedAt = (publishedAt: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(publishedAt));

function NewsCard({
  item,
  onFeedback,
  rankSlot,
}: {
  item: NewsFeedItem;
  onFeedback: (
    item: NewsFeedItem,
    action: NewsFeedbackAction,
    rankSlot: number,
  ) => void;
  rankSlot: number;
}) {
  const router = useRouter();
  const sourceUrl = getExpoNewsArticleSourceUrl(item);
  const recommendationBadges = item.recommendation.badges.slice(0, 3);
  const recommendationSummary = item.recommendation.summary;

  return (
    <View className="bg-muted rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <Pressable
        className="active:opacity-80"
        onPress={() =>
          router.push({
            pathname: "/news/[id]",
            params: { id: item.id },
          })
        }
      >
        <View className="mb-3 flex-row flex-wrap items-center gap-2">
          <Text className="text-primary text-xs font-bold uppercase">
            {formatCategory(item.category)}
          </Text>
          <Text className="text-muted-foreground text-xs">
            {formatPublishedAt(item.publishedAt)}
          </Text>
        </View>
        <Text className="text-foreground text-xl leading-6 font-black">
          {item.title}
        </Text>
        <Text className="text-muted-foreground mt-2 text-sm leading-5">
          {item.summary}
        </Text>
        {recommendationBadges.length > 0 || recommendationSummary ? (
          <View className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <Text className="text-foreground text-xs font-black uppercase">
              Why this
            </Text>
            {recommendationBadges.length > 0 ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {recommendationBadges.map((badge) => (
                  <Text
                    className="border-primary/30 text-primary rounded-sm border px-2 py-1 text-xs font-bold"
                    key={badge}
                  >
                    {badge}
                  </Text>
                ))}
              </View>
            ) : null}
            {recommendationSummary ? (
              <Text className="text-muted-foreground mt-2 text-xs leading-4">
                {recommendationSummary}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Pressable
            disabled={!sourceUrl}
            onPress={() => {
              if (!sourceUrl) return;

              onFeedback(item, "click_source", rankSlot);
              void Linking.openURL(sourceUrl);
            }}
          >
            <Text className="text-foreground text-xs font-semibold underline decoration-zinc-400">
              {item.sourceName}
            </Text>
          </Pressable>
          <Text className="text-muted-foreground mt-1 text-xs">
            Score {Math.round(item.personalizedScore)} / Heat {item.trendScore}
          </Text>
        </View>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Pressable
            className="border-primary/40 rounded-sm border px-2.5 py-2 active:opacity-80"
            onPress={() => onFeedback(item, "save", rankSlot)}
          >
            <Text className="text-primary text-xs font-bold uppercase">
              Save
            </Text>
          </Pressable>
          <Pressable
            className="border-primary/40 rounded-sm border px-2.5 py-2 active:opacity-80"
            onPress={() => {
              onFeedback(item, "share", rankSlot);
              void Share.share({
                message: `${item.title}\n\n${item.summary}`,
                title: item.title,
              });
            }}
          >
            <Text className="text-primary text-xs font-bold uppercase">
              Share
            </Text>
          </Pressable>
          <Pressable
            className="rounded-sm border border-zinc-300 px-2.5 py-2 active:opacity-80 dark:border-zinc-700"
            onPress={() => onFeedback(item, "hide", rankSlot)}
          >
            <Text className="text-muted-foreground text-xs font-bold uppercase">
              Less
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MobileAuth() {
  const { data: session } = authClient.useSession();

  return (
    <Pressable
      onPress={() =>
        session
          ? authClient.signOut()
          : authClient.signIn.social({
              provider: "discord",
              callbackURL: "/",
            })
      }
      className="border-primary/40 rounded-sm border px-3 py-2 active:opacity-80"
    >
      <Text className="text-primary text-center text-xs font-bold uppercase">
        {session ? "Sign Out" : "Sign In"}
      </Text>
    </Pressable>
  );
}

function SavedStoriesShelf({
  isRemoving = false,
  items,
  onRemove,
}: {
  isRemoving?: boolean;
  items: readonly SavedNewsItem[];
  onRemove: (savedItem: SavedNewsItem) => void;
}) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <View className="bg-muted mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-foreground text-sm font-black">
          Saved Stories
        </Text>
        <Text className="text-primary text-xs font-bold uppercase">
          {items.length}
        </Text>
      </View>
      <View className="gap-3">
        {items.map((savedItem) => (
          <View
            className="border-t border-zinc-200 pt-3 dark:border-zinc-800"
            key={savedItem.id}
          >
            <Pressable
              className="active:opacity-80"
              onPress={() =>
                router.push({
                  pathname: "/news/[id]",
                  params: { id: savedItem.id },
                })
              }
            >
              <Text
                className="text-foreground text-sm leading-5 font-bold"
                numberOfLines={2}
              >
                {savedItem.title}
              </Text>
              <Text
                className="text-muted-foreground mt-1 text-xs"
                numberOfLines={1}
              >
                {savedItem.sourceName} / saved{" "}
                {formatPublishedAt(savedItem.savedAt)}
              </Text>
            </Pressable>
            <View className="mt-3 flex-row justify-end">
              <Pressable
                className="rounded-sm border border-zinc-300 px-2.5 py-2 active:opacity-80 disabled:opacity-40 dark:border-zinc-700"
                disabled={isRemoving}
                onPress={() => onRemove(savedItem)}
              >
                <Text className="text-muted-foreground text-xs font-bold uppercase">
                  Remove
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function GuardrailStoriesShelf({
  isRestoring = false,
  items,
  onRestore,
}: {
  isRestoring?: boolean;
  items: readonly GuardrailNewsItem[];
  onRestore: (guardrailItem: GuardrailNewsItem) => void;
}) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <View className="bg-muted mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-foreground text-sm font-black">
          Hidden Stories
        </Text>
        <Text className="text-primary text-xs font-bold uppercase">
          {items.length}
        </Text>
      </View>
      <View className="gap-3">
        {items.map((guardrailItem) => (
          <View
            className="border-t border-zinc-200 pt-3 dark:border-zinc-800"
            key={guardrailItem.id}
          >
            <Pressable
              className="active:opacity-80"
              onPress={() =>
                router.push({
                  pathname: "/news/[id]",
                  params: { id: guardrailItem.id },
                })
              }
            >
              <Text
                className="text-foreground text-sm leading-5 font-bold"
                numberOfLines={2}
              >
                {guardrailItem.title}
              </Text>
              <Text
                className="text-muted-foreground mt-1 text-xs"
                numberOfLines={1}
              >
                {guardrailItem.sourceName} / less{" "}
                {formatPublishedAt(guardrailItem.hiddenAt)}
              </Text>
            </Pressable>
            <View className="mt-3 flex-row justify-end">
              <Pressable
                className="border-primary/40 rounded-sm border px-2.5 py-2 active:opacity-80 disabled:opacity-40"
                disabled={isRestoring}
                onPress={() => onRestore(guardrailItem)}
              >
                <Text className="text-primary text-xs font-bold uppercase">
                  Restore
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryStoriesShelf({ items }: { items: readonly HistoryNewsItem[] }) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <View className="bg-muted mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="text-foreground text-sm font-black">
          Recently Read
        </Text>
        <Text className="text-primary text-xs font-bold uppercase">
          {items.length}
        </Text>
      </View>
      <View className="gap-3">
        {items.map((historyItem) => (
          <Pressable
            className="border-t border-zinc-200 pt-3 active:opacity-80 dark:border-zinc-800"
            key={historyItem.id}
            onPress={() =>
              router.push({
                pathname: "/news/[id]",
                params: { id: historyItem.id },
              })
            }
          >
            <Text
              className="text-foreground text-sm leading-5 font-bold"
              numberOfLines={2}
            >
              {historyItem.title}
            </Text>
            <Text
              className="text-muted-foreground mt-1 text-xs"
              numberOfLines={1}
            >
              {historyItem.sourceName} / read{" "}
              {formatPublishedAt(historyItem.viewedAt)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Index() {
  const queryClient = useQueryClient();
  const recordedExposureIds = useRef(new Set<string>());
  const isLoadingMoreStoriesRef = useRef(false);
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const [readerLocalHour, setReaderLocalHour] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<MobileNewsCategory | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadedStories, setLoadedStories] = useState<NewsFeedItem[]>([]);
  const [hasMoreStories, setHasMoreStories] = useState(true);
  const [isLoadingMoreStories, setIsLoadingMoreStories] = useState(false);
  const newsQuery = useQuery(
    trpc.news.forYou.queryOptions(
      {
        category: activeCategory ?? undefined,
        limit: 30,
        q: searchQuery || undefined,
        readerLocalHour: readerLocalHour ?? undefined,
        visitorKey: visitorKey ?? undefined,
      },
      {
        enabled: Boolean(visitorKey),
      },
    ),
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
      { enabled: Boolean(visitorKey) },
    ),
  );
  const savedQuery = useQuery(
    trpc.news.saved.queryOptions(
      { limit: 3, visitorKey: visitorKey ?? undefined },
      { enabled: Boolean(visitorKey) },
    ),
  );
  const historyQuery = useQuery(
    trpc.news.history.queryOptions(
      { limit: 3, visitorKey: visitorKey ?? undefined },
      { enabled: Boolean(visitorKey) },
    ),
  );
  const guardrailsQuery = useQuery(
    trpc.news.guardrails.queryOptions(
      { limit: 3, visitorKey: visitorKey ?? undefined },
      { enabled: Boolean(visitorKey) },
    ),
  );
  const updateProfile = useMutation(
    trpc.news.updateProfile.mutationOptions({
      async onSuccess() {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.queryFilter()),
          queryClient.invalidateQueries(trpc.news.profile.queryFilter()),
        ]);
      },
    }),
  );
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      async onSuccess() {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.queryFilter()),
          queryClient.invalidateQueries(trpc.news.guardrails.queryFilter()),
          queryClient.invalidateQueries(trpc.news.profile.queryFilter()),
          queryClient.invalidateQueries(trpc.news.saved.queryFilter()),
        ]);
      },
    }),
  );
  const recordExposure = useMutation(
    trpc.news.recordInteraction.mutationOptions(),
  );
  const removeSaved = useMutation(
    trpc.news.removeSaved.mutationOptions({
      async onSuccess() {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.queryFilter()),
          queryClient.invalidateQueries(trpc.news.profile.queryFilter()),
          queryClient.invalidateQueries(trpc.news.saved.queryFilter()),
        ]);
      },
    }),
  );
  const restoreGuardrail = useMutation(
    trpc.news.restoreGuardrail.mutationOptions({
      async onSuccess() {
        await Promise.all([
          queryClient.invalidateQueries(trpc.news.forYou.queryFilter()),
          queryClient.invalidateQueries(trpc.news.guardrails.queryFilter()),
          queryClient.invalidateQueries(trpc.news.profile.queryFilter()),
          queryClient.invalidateQueries(trpc.news.saved.queryFilter()),
        ]);
      },
    }),
  );
  const readerMemorySummary =
    profileQuery.data?.audit.summary ??
    "Profile is still learning from mobile reads, saves, shares, and source clicks.";
  const trainedSignalCount = profileQuery.data?.audit.trainedSignalCount ?? 0;
  const savedStoryCount = savedQuery.data?.length ?? 0;
  const savedStories = savedQuery.data?.slice(0, 3) ?? [];
  const historyStories = historyQuery.data?.slice(0, 3) ?? [];
  const guardrailStories = guardrailsQuery.data?.slice(0, 3) ?? [];
  const topCategory = profileQuery.data?.audit.topCategories[0]?.key;
  const activeChannel = mobileCategoryChannels.find(
    (channel) => channel.category === activeCategory,
  );
  const activeCategoryFollowed = Boolean(
    activeCategory &&
      profileQuery.data?.preferredCategories.includes(activeCategory),
  );
  const stories = useMemo(() => {
    const baseStories = newsQuery.data ?? [];
    const baseStoryIds = new Set(baseStories.map((story) => story.id));

    return [
      ...baseStories,
      ...loadedStories.filter((story) => !baseStoryIds.has(story.id)),
    ];
  }, [loadedStories, newsQuery.data]);

  useEffect(() => {
    let cancelled = false;

    void readOrCreateNewsVisitorKey().then((nextVisitorKey) => {
      if (!cancelled) {
        setReaderLocalHour(new Date().getHours());
        setVisitorKey(nextVisitorKey);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    recordedExposureIds.current.clear();
    isLoadingMoreStoriesRef.current = false;
    setHasMoreStories(true);
    setIsLoadingMoreStories(false);
    setLoadedStories([]);
  }, [activeCategory, readerLocalHour, searchQuery, visitorKey]);

  const recordFeedback = (
    item: NewsFeedItem,
    action: NewsFeedbackAction,
    rankSlot: number,
  ) => {
    if (!visitorKey) return;

    recordInteraction.mutate({
      action,
      metadata: {
        feedMode: "for_you",
        matchedSignals: item.matchedSignals,
        personalizedScore: item.personalizedScore,
        rankSlot,
        surface: "mobile_home",
      },
      newsItemId: item.id,
      visitorKey,
    });
  };

  const removeSavedStory = (savedItem: SavedNewsItem) => {
    if (!visitorKey) return;

    removeSaved.mutate({
      newsItemId: savedItem.id,
      visitorKey,
    });
  };

  const restoreGuardrailStory = (guardrailItem: GuardrailNewsItem) => {
    if (!visitorKey) return;

    restoreGuardrail.mutate({
      newsItemId: guardrailItem.id,
      visitorKey,
    });
  };

  const followActiveCategory = () => {
    if (!visitorKey || !activeCategory || activeCategoryFollowed) return;

    const currentProfile = profileQuery.data;
    const preferredCategories: MobileNewsProfile["preferredCategories"] = [
      ...(currentProfile?.preferredCategories.filter(
        isMobileNewsProfileCategory,
      ) ?? []),
      activeCategory,
    ];
    const preferredEntities: MobileNewsProfile["preferredEntities"] = [
      ...(currentProfile?.preferredEntities ?? []),
    ];
    const preferredSources: MobileNewsProfile["preferredSources"] = [
      ...(currentProfile?.preferredSources ?? []),
    ];

    updateProfile.mutate({
      profile: {
        noveltyBias: currentProfile?.noveltyBias ?? 1,
        preferredCategories,
        preferredEntities,
        preferredSources,
        recencyBias: currentProfile?.recencyBias ?? 1,
      },
      visitorKey,
    });
  };

  const applySearch = () => {
    setSearchQuery(searchDraft.trim());
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearchQuery("");
  };

  const loadMoreStories = useCallback(async () => {
    if (
      !visitorKey ||
      !hasMoreStories ||
      isLoadingMoreStoriesRef.current ||
      newsQuery.isLoading ||
      stories.length === 0
    ) {
      return;
    }

    isLoadingMoreStoriesRef.current = true;
    setIsLoadingMoreStories(true);

    try {
      const nextStories = await queryClient.fetchQuery(
        trpc.news.forYou.queryOptions({
          category: activeCategory ?? undefined,
          excludeNewsItemIds: stories.map((story) => story.id),
          limit: 20,
          q: searchQuery || undefined,
          readerLocalHour: readerLocalHour ?? undefined,
          visitorKey,
        }),
      );
      const existingStoryIds = new Set(stories.map((story) => story.id));
      const uniqueNextStories = nextStories.filter(
        (story) => !existingStoryIds.has(story.id),
      );

      setLoadedStories((currentStories) => {
        const currentStoryIds = new Set(
          currentStories.map((story) => story.id),
        );

        return [
          ...currentStories,
          ...uniqueNextStories.filter(
            (story) => !currentStoryIds.has(story.id),
          ),
        ];
      });
      setHasMoreStories(uniqueNextStories.length > 0);
    } finally {
      isLoadingMoreStoriesRef.current = false;
      setIsLoadingMoreStories(false);
    }
  }, [
    activeCategory,
    hasMoreStories,
    newsQuery.isLoading,
    queryClient,
    readerLocalHour,
    searchQuery,
    stories,
    visitorKey,
  ]);

  const recordVisibleExposures = useCallback<
    NonNullable<OnViewableItemsChanged<NewsFeedItem>>
  >(
    ({ changed }) => {
      if (!visitorKey) return;

      for (const viewableItem of changed) {
        if (!viewableItem.isViewable) continue;

        const item = viewableItem.item;

        if (recordedExposureIds.current.has(item.id)) continue;

        recordedExposureIds.current.add(item.id);
        recordExposure.mutate({
          action: "view",
          metadata: {
            exposure: true,
            exposureSlot: viewableItem.index,
            feedMode: "for_you",
            matchedSignals: item.matchedSignals,
            personalizedScore: item.personalizedScore,
            rankSlot: viewableItem.index,
            surface: "mobile_home",
          },
          newsItemId: item.id,
          visitorKey,
        });
      }
    },
    [recordExposure, visitorKey],
  );

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ title: "The New AI Times" }} />
      <View className="bg-background flex-1 px-4 py-5">
        <View className="mb-5 flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-foreground text-4xl leading-10 font-black">
              The New AI Times
            </Text>
            <Text className="text-muted-foreground mt-2 text-sm leading-5">
              A mobile briefing for model releases, agents, funding, research,
              and policy shifts.
            </Text>
          </View>
          <MobileAuth />
        </View>

        <View className="mb-4 flex-row items-center gap-2">
          <TextInput
            accessibilityLabel="Search AI news"
            className="text-foreground bg-muted min-h-11 flex-1 rounded-sm border border-zinc-300 px-3 text-sm dark:border-zinc-700"
            onChangeText={setSearchDraft}
            onSubmitEditing={applySearch}
            placeholder="Search AI news"
            placeholderTextColor="#71717a"
            returnKeyType="search"
            value={searchDraft}
          />
          <Pressable
            className="bg-primary rounded-sm px-3 py-3 active:opacity-80"
            onPress={applySearch}
          >
            <Text className="text-background text-xs font-bold uppercase">
              Search
            </Text>
          </Pressable>
          <Pressable
            className="rounded-sm border border-zinc-300 px-3 py-3 active:opacity-80 dark:border-zinc-700"
            onPress={clearSearch}
          >
            <Text className="text-muted-foreground text-xs font-bold uppercase">
              Clear
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="-mx-4 mb-4"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View className="flex-row gap-2 px-4">
            {mobileCategoryChannels.map((channel) => {
              const isActive = activeCategory === channel.category;

              return (
                <Pressable
                  className={`rounded-sm border px-3 py-2 active:opacity-80 ${
                    isActive
                      ? "border-primary bg-primary"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  key={channel.label}
                  onPress={() => setActiveCategory(channel.category)}
                >
                  <Text
                    className={`text-xs font-bold uppercase ${
                      isActive ? "text-background" : "text-muted-foreground"
                    }`}
                  >
                    {channel.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {activeCategory && activeChannel ? (
          <View className="bg-muted mb-4 flex-row items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <View className="min-w-0 flex-1">
              <Text className="text-foreground text-sm font-black">
                {activeChannel.label}
              </Text>
              <Text className="text-muted-foreground mt-1 text-xs leading-5">
                Follow this topic to make it a durable For You signal.
              </Text>
            </View>
            <Pressable
              className="border-primary/40 rounded-sm border px-3 py-2 active:opacity-80 disabled:opacity-40"
              disabled={activeCategoryFollowed || updateProfile.isPending}
              onPress={followActiveCategory}
            >
              <Text className="text-primary text-xs font-bold uppercase">
                {activeCategoryFollowed ? "Following topic" : "Follow topic"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="bg-muted mb-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-foreground text-sm font-black">
                Reader Memory
              </Text>
              <Text className="text-muted-foreground mt-1 text-xs leading-5">
                {readerMemorySummary}
              </Text>
            </View>
            <Text className="text-primary text-xs font-bold uppercase">
              For You
            </Text>
          </View>
          <View className="mt-3 flex-row gap-2">
            <View className="min-w-0 flex-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <Text className="text-muted-foreground text-xs">Signals</Text>
              <Text className="text-foreground mt-1 text-base font-black">
                {trainedSignalCount}
              </Text>
            </View>
            <View className="min-w-0 flex-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <Text className="text-muted-foreground text-xs">Saved</Text>
              <Text className="text-foreground mt-1 text-base font-black">
                {savedStoryCount}
              </Text>
            </View>
            <View className="min-w-0 flex-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <Text className="text-muted-foreground text-xs">Top topic</Text>
              <Text
                className="text-foreground mt-1 text-sm font-black"
                numberOfLines={1}
              >
                {topCategory ? formatCategory(topCategory) : "Learning"}
              </Text>
            </View>
          </View>
        </View>

        <SavedStoriesShelf
          isRemoving={removeSaved.isPending}
          items={savedStories}
          onRemove={removeSavedStory}
        />

        <HistoryStoriesShelf items={historyStories} />

        <GuardrailStoriesShelf
          isRestoring={restoreGuardrail.isPending}
          items={guardrailStories}
          onRestore={restoreGuardrailStory}
        />

        {!visitorKey || newsQuery.isLoading ? (
          <View className="gap-3">
            {["lead", "second", "third"].map((key) => (
              <View
                className="bg-muted h-32 rounded-lg border border-zinc-200 dark:border-zinc-800"
                key={key}
              />
            ))}
          </View>
        ) : stories.length > 0 ? (
          <LegendList
            data={stories}
            estimatedItemSize={156}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View className="h-3" />}
            ListFooterComponent={() =>
              isLoadingMoreStories ? (
                <View className="py-5">
                  <Text className="text-muted-foreground text-center text-xs font-bold uppercase">
                    Loading more
                  </Text>
                </View>
              ) : !hasMoreStories ? (
                <View className="py-5">
                  <Text className="text-muted-foreground text-center text-xs font-bold uppercase">
                    You are caught up
                  </Text>
                </View>
              ) : null
            }
            onEndReached={loadMoreStories}
            onEndReachedThreshold={0.6}
            onViewableItemsChanged={recordVisibleExposures}
            renderItem={({ index, item }) => (
              <NewsCard
                item={item}
                onFeedback={recordFeedback}
                rankSlot={index}
              />
            )}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 50,
              minimumViewTime: 500,
            }}
          />
        ) : (
          <View className="bg-muted rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <Text className="text-foreground text-lg font-black">
              No live stories yet
            </Text>
            <Text className="text-muted-foreground mt-2 text-sm leading-5">
              Seed sources and run the RSS refresh to fill the mobile edition.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
