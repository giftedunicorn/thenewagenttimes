import { z } from "zod/v4";

export {
  dedupeNewsItems,
  filterBlockedNewsItems,
  filterHiddenNewsItems,
  getNewsExplorationInterval,
  normalizeNewsPreferenceProfile,
  rankNewsForReader,
  selectBreakingNewsPriorityFeed,
  selectDiscoverySlotNewsFeed,
  selectDiverseNewsFeed,
  selectExposureBalancedNewsFeed,
  selectFatigueBalancedNewsFeed,
  selectNegativeFeedbackAdjustedNewsFeed,
  selectPositiveFeedbackAnchoredNewsFeed,
  selectReaderFreshNewsFeed,
  selectSourceTrustBalancedNewsFeed,
  shouldTrainReaderProfileFromInteraction,
  updateReaderProfileWithInteraction,
  type NegativeFeedbackNewsItem,
  type NewsIdentity,
  type NewsPreferenceProfile,
  type NewsUrlReference,
  type PositiveFeedbackNewsItem,
  type ReaderInteraction,
  type ReaderInteractionAction,
  type RankedNewsItem,
  type RecentExposureNewsItem,
  type RecommendableNewsItem,
  type DedupeNewsItem,
} from "./news-recommendation";

export const unused = z.string().describe(
  `This lib is currently not used as we use drizzle-zod for simple schemas
   But as your application grows and you need other validators to share
   with back and frontend, you can put them in here
  `,
);
