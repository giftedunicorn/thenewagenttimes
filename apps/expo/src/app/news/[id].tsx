import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useGlobalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterInputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import {
  getExpoNewsArticleSourceUrl,
  readOrCreateNewsVisitorKey,
} from "~/utils/news-reader";

const formatCategory = (category: string) =>
  category
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");

const formatPublishedAt = (publishedAt: string | Date) =>
  new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(publishedAt));

type NewsArticleFeedbackAction = "hide" | "save" | "share";
type NewsArticleProfile = RouterInputs["news"]["updateProfile"]["profile"];

const defaultNewsArticlePreferredCategories = [
  "model_release",
  "agent_product",
  "funding",
] as const satisfies readonly NewsArticleProfile["preferredCategories"][number][];

const newsArticleProfileCategories = [
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
] as const satisfies readonly NewsArticleProfile["preferredCategories"][number][];

const isNewsArticleProfileCategory = (
  category: string,
): category is NewsArticleProfile["preferredCategories"][number] =>
  newsArticleProfileCategories.some(
    (profileCategory) => profileCategory === category,
  );

export default function NewsArticle() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const recordedDeepReadIdsRef = useRef(new Set<string>());
  const recordedReadIdsRef = useRef(new Set<string>());
  const articleQuery = useQuery(
    trpc.news.byId.queryOptions(
      { id },
      {
        enabled: Boolean(id),
      },
    ),
  );
  const profileQuery = useQuery(
    trpc.news.profile.queryOptions(
      { visitorKey: visitorKey ?? undefined },
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
          queryClient.invalidateQueries(trpc.news.history.queryFilter()),
          queryClient.invalidateQueries(trpc.news.profile.queryFilter()),
          queryClient.invalidateQueries(trpc.news.saved.queryFilter()),
        ]);
      },
    }),
  );
  const article = articleQuery.data;
  const sourceFollowed = Boolean(
    article?.source.slug &&
      profileQuery.data?.preferredSources.includes(article.source.slug),
  );

  useEffect(() => {
    let cancelled = false;

    void readOrCreateNewsVisitorKey().then((nextVisitorKey) => {
      if (!cancelled) {
        setVisitorKey(nextVisitorKey);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!article || !visitorKey || recordedReadIdsRef.current.has(article.id)) {
      return;
    }

    recordedReadIdsRef.current.add(article.id);
    recordInteraction.mutate({
      action: "view",
      metadata: {
        readMilestone: "meaningful_read",
        readPercent: 0.42,
        surface: "article",
      },
      newsItemId: article.id,
      visitorKey,
    });
  }, [article, recordInteraction, visitorKey]);

  const recordSourceClick = () => {
    if (!article) return;

    const sourceUrl = getExpoNewsArticleSourceUrl(article);

    if (!sourceUrl) return;

    if (visitorKey) {
      recordInteraction.mutate({
        action: "click_source",
        metadata: {
          surface: "article_source",
        },
        newsItemId: article.id,
        visitorKey,
      });
    }

    void Linking.openURL(sourceUrl);
  };

  const followArticleSource = () => {
    if (!article || !visitorKey || sourceFollowed) return;

    const currentProfile = profileQuery.data;
    const preferredCategories: NewsArticleProfile["preferredCategories"] =
      currentProfile
        ? currentProfile.preferredCategories.filter(
            isNewsArticleProfileCategory,
          )
        : [...defaultNewsArticlePreferredCategories];
    const preferredEntities: NewsArticleProfile["preferredEntities"] = [
      ...(currentProfile?.preferredEntities ?? []),
    ];
    const preferredSources: NewsArticleProfile["preferredSources"] = Array.from(
      new Set([
        ...(currentProfile?.preferredSources ?? []),
        article.source.slug,
      ]),
    );

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

  const recordArticleFeedback = (action: NewsArticleFeedbackAction) => {
    if (!article) return;

    if (visitorKey) {
      recordInteraction.mutate({
        action,
        metadata: {
          surface: "article_feedback",
        },
        newsItemId: article.id,
        visitorKey,
      });
    }

    if (action === "share") {
      void Share.share({
        message: `${article.title}\n\n${article.summary}`,
        title: article.title,
      });
    }
  };

  const recordDeepRead = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (
      !article ||
      !visitorKey ||
      recordedDeepReadIdsRef.current.has(article.id)
    ) {
      return;
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    if (contentSize.height <= 0) return;

    const readPercent = Math.min(
      1,
      Math.max(
        0,
        (contentOffset.y + layoutMeasurement.height) / contentSize.height,
      ),
    );

    if (readPercent < 0.8) return;

    recordedDeepReadIdsRef.current.add(article.id);
    recordInteraction.mutate({
      action: "view",
      metadata: {
        readMilestone: "deep_read",
        readPercent,
        surface: "article",
      },
      newsItemId: article.id,
      visitorKey,
    });
  };

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ title: article?.source.name ?? "News" }} />
      <ScrollView
        className="bg-background flex-1"
        onScroll={recordDeepRead}
        scrollEventThrottle={250}
      >
        <View className="px-4 py-5">
          {article ? (
            <>
              <Text className="text-primary text-xs font-bold uppercase">
                {formatCategory(article.category)}
              </Text>
              <Text className="text-foreground mt-3 text-4xl leading-10 font-black">
                {article.title}
              </Text>
              <Text className="text-muted-foreground mt-4 text-base leading-6">
                {article.summary}
              </Text>
              <View className="mt-5 border-y border-zinc-200 py-3 dark:border-zinc-800">
                <View className="flex-row items-center justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <Text className="text-foreground text-sm font-semibold">
                      {article.source.name}
                    </Text>
                    <Text className="text-muted-foreground mt-1 text-xs">
                      {formatPublishedAt(article.publishedAt)}
                    </Text>
                  </View>
                  <Pressable
                    className="border-primary/40 rounded-sm border px-3 py-2 active:opacity-80 disabled:opacity-40"
                    disabled={sourceFollowed || updateProfile.isPending}
                    onPress={followArticleSource}
                  >
                    <Text className="text-primary text-xs font-bold uppercase">
                      {sourceFollowed ? "Following Source" : "Follow Source"}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Text className="text-foreground mt-6 text-base leading-7">
                {article.bodyText?.trim() ?? article.summary}
              </Text>
              <View className="mt-7 flex-row flex-wrap gap-2">
                <Pressable
                  className="border-primary/40 rounded-sm border px-3 py-2 active:opacity-80"
                  onPress={() => recordArticleFeedback("save")}
                >
                  <Text className="text-primary text-xs font-bold uppercase">
                    Save
                  </Text>
                </Pressable>
                <Pressable
                  className="border-primary/40 rounded-sm border px-3 py-2 active:opacity-80"
                  onPress={() => recordArticleFeedback("share")}
                >
                  <Text className="text-primary text-xs font-bold uppercase">
                    Share
                  </Text>
                </Pressable>
                <Pressable
                  className="rounded-sm border border-zinc-300 px-3 py-2 active:opacity-80 dark:border-zinc-700"
                  onPress={() => recordArticleFeedback("hide")}
                >
                  <Text className="text-muted-foreground text-xs font-bold uppercase">
                    Less
                  </Text>
                </Pressable>
                <Pressable
                  className="bg-primary rounded-sm px-4 py-2 active:opacity-80"
                  onPress={recordSourceClick}
                >
                  <Text className="text-center text-xs font-bold text-white uppercase">
                    Open Source
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View className="bg-muted rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <Text className="text-foreground text-lg font-black">
                Story unavailable
              </Text>
              <Text className="text-muted-foreground mt-2 text-sm leading-5">
                The story may not be published yet or the mobile client is
                waiting for the API.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
