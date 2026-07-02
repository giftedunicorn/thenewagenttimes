import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { readOrCreateNewsVisitorKey } from "~/utils/news-reader";

type NewsFeedItem = RouterOutputs["news"]["forYou"][number];
type NewsFeedbackAction = "hide" | "save";

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
      </Pressable>
      <View className="mt-4 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-foreground text-xs font-semibold">
            {item.sourceName}
          </Text>
          <Text className="text-muted-foreground mt-1 text-xs">
            Score {Math.round(item.personalizedScore)} / Heat {item.trendScore}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            className="border-primary/40 rounded-sm border px-3 py-2 active:opacity-80"
            onPress={() => onFeedback(item, "save", rankSlot)}
          >
            <Text className="text-primary text-xs font-bold uppercase">
              Save
            </Text>
          </Pressable>
          <Pressable
            className="rounded-sm border border-zinc-300 px-3 py-2 active:opacity-80 dark:border-zinc-700"
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

export default function Index() {
  const queryClient = useQueryClient();
  const [visitorKey, setVisitorKey] = useState<string | null>(null);
  const newsQuery = useQuery(
    trpc.news.forYou.queryOptions(
      {
        limit: 30,
        visitorKey: visitorKey ?? undefined,
      },
      {
        enabled: Boolean(visitorKey),
      },
    ),
  );
  const recordInteraction = useMutation(
    trpc.news.recordInteraction.mutationOptions({
      async onSuccess() {
        await queryClient.invalidateQueries(trpc.news.forYou.queryFilter());
      },
    }),
  );
  const stories = newsQuery.data ?? [];

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
            renderItem={({ index, item }) => (
              <NewsCard
                item={item}
                onFeedback={recordFeedback}
                rankSlot={index}
              />
            )}
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
