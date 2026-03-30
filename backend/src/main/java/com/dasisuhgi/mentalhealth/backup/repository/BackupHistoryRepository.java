package com.dasisuhgi.mentalhealth.backup.repository;

import com.dasisuhgi.mentalhealth.backup.entity.BackupHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BackupHistoryRepository extends JpaRepository<BackupHistory, Long> {
}
