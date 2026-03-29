package com.dasisuhgi.mentalhealth.assessment.repository;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssessmentSessionRepository extends JpaRepository<AssessmentSession, Long> {
    List<AssessmentSession> findTop10ByClientIdAndStatusOrderBySessionCompletedAtDesc(Long clientId, AssessmentSessionStatus status);

    Optional<AssessmentSession> findTopByClientIdAndStatusOrderBySessionCompletedAtDesc(Long clientId, AssessmentSessionStatus status);
}
