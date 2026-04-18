package ct01.n06.backend.dto.lecturer;

import java.util.List;

public record LecturerDashboardSummaryResponse(
    long totalEvents,
    long totalStudents,
    long participatingStudents,
    long pendingEvidence,
    long newNotifications,
    double passRate,
    List<ScoreDistributionItem> scoreDistribution,
    List<UpcomingEventItem> upcomingEvents
) {

  public record ScoreDistributionItem(
      String key,
      String label,
      double percentage
  ) {
  }

  public record UpcomingEventItem(
      Long id,
      String title,
      String location,
      String dateLabel,
      String timeLabel,
      long attendeeCount
  ) {
  }
}
