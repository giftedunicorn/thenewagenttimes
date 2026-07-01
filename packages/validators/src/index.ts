import { z } from "zod/v4";

export {
  filterHiddenNewsItems,
  rankNewsForReader,
  updateReaderProfileWithInteraction,
  type NewsIdentity,
  type NewsPreferenceProfile,
  type ReaderInteraction,
  type ReaderInteractionAction,
  type RankedNewsItem,
  type RecommendableNewsItem,
} from "./news-recommendation";

export const unused = z.string().describe(
  `This lib is currently not used as we use drizzle-zod for simple schemas
   But as your application grows and you need other validators to share
   with back and frontend, you can put them in here
  `,
);
