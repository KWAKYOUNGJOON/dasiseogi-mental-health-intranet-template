package com.dasisuhgi.mentalhealth.audit.repository;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
}
