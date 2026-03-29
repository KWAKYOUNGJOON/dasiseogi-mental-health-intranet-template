package com.dasisuhgi.mentalhealth.assessment.repository;

import com.dasisuhgi.mentalhealth.assessment.entity.SessionAnswer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionAnswerRepository extends JpaRepository<SessionAnswer, Long> {
    List<SessionAnswer> findBySessionScaleIdInOrderBySessionScaleIdAscQuestionNoAsc(List<Long> sessionScaleIds);
}
