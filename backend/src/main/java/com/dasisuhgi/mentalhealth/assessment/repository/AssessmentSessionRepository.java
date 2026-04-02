package com.dasisuhgi.mentalhealth.assessment.repository;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.client.dto.RecentSessionSummaryQueryRow;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssessmentSessionRepository extends JpaRepository<AssessmentSession, Long> {
    List<AssessmentSession> findTop10ByClientIdAndStatusOrderBySessionCompletedAtDesc(Long clientId, AssessmentSessionStatus status);

    Optional<AssessmentSession> findTopByClientIdAndStatusOrderBySessionCompletedAtDesc(Long clientId, AssessmentSessionStatus status);

    @Query("""
            select new com.dasisuhgi.mentalhealth.client.dto.RecentSessionSummaryQueryRow(
                session.id,
                session.sessionNo,
                session.sessionCompletedAt,
                performer.name,
                session.scaleCount,
                session.hasAlert,
                session.status
            )
            from AssessmentSession session
            join session.performedBy performer
            where session.client.id = :clientId
              and session.status = :status
            order by session.sessionCompletedAt desc
            """)
    List<RecentSessionSummaryQueryRow> findRecentSessionSummaries(
            @Param("clientId") Long clientId,
            @Param("status") AssessmentSessionStatus status,
            Pageable pageable
    );
}
