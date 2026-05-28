export class MoodleAssignmentScraper {
  async scrape(activityUrl: string) {
    return {
      activityUrl,
      students: [],
      submissions: [],
    };
  }
}
