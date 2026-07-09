import {
  getNewsCollaborativeSignals,
  getNewsHomeData,
  getNewsSemanticSimilarityMatches,
} from "../../../_data/news";
import { handleNewsForYouRequest } from "./handler";

export async function POST(request: Request) {
  return handleNewsForYouRequest({
    getItems: async () => {
      const data = await getNewsHomeData();

      return data.items;
    },
    getCollaborativeSignals: ({ items }) =>
      getNewsCollaborativeSignals({ items }),
    getSemanticSimilarityMatches: ({ items, positiveFeedbackItems }) =>
      getNewsSemanticSimilarityMatches({
        feedbackItems: positiveFeedbackItems,
        items,
      }),
    request,
  });
}
