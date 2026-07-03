import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useGlobalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";

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

export default function NewsArticle() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const recordedReadIdsRef = useRef(new Set<string>());
  const articleQuery = useQuery(
    trpc.news.byId.queryOptions(
      { id },
      {
        enabled: Boolean(id),
      },
    ),
  );
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions(),
  );
  const article = articleQuery.data;

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

  return (
    <SafeAreaView className="bg-background flex-1">
      <Stack.Screen options={{ title: article?.source.name ?? "News" }} />
      <ScrollView className="bg-background flex-1">
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
                <Text className="text-foreground text-sm font-semibold">
                  {article.source.name}
                </Text>
                <Text className="text-muted-foreground mt-1 text-xs">
                  {formatPublishedAt(article.publishedAt)}
                </Text>
              </View>
              <Text className="text-foreground mt-6 text-base leading-7">
                {article.bodyText?.trim() ?? article.summary}
              </Text>
              <Pressable
                className="bg-primary mt-7 rounded-sm px-4 py-3 active:opacity-80"
                onPress={recordSourceClick}
              >
                <Text className="text-center text-sm font-bold text-white uppercase">
                  Open Source
                </Text>
              </Pressable>
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
