package com.dasisuhgi.mentalhealth.assessment.repository;

import com.dasisuhgi.mentalhealth.assessment.entity.SessionAlert;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionAlertRepository extends JpaRepository<SessionAlert, Long> {
    List<SessionAlert> findBySessionIdOrderByIdAsc(Long sessionId);
}
