export class MoodleDiscussionScraper {
  async scrape(activityUrl: string) {
    return {
      activityUrl,
      posts: [],
    };
  }
}
