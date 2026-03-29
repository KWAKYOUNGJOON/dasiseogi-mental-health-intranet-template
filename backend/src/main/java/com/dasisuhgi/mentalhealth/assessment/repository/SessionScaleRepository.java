package com.dasisuhgi.mentalhealth.assessment.repository;

import com.dasisuhgi.mentalhealth.assessment.entity.SessionScale;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionScaleRepository extends JpaRepository<SessionScale, Long> {
    List<SessionScale> findBySessionIdOrderByDisplayOrderAsc(Long sessionId);
}
