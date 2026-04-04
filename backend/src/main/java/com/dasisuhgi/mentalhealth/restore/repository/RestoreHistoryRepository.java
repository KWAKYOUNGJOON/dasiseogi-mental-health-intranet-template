package com.dasisuhgi.mentalhealth.restore.repository;

import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RestoreHistoryRepository extends JpaRepository<RestoreHistory, Long> {
}
