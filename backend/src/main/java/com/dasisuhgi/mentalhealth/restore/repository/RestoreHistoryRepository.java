package com.dasisuhgi.mentalhealth.restore.repository;

import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RestoreHistoryRepository extends JpaRepository<RestoreHistory, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from RestoreHistory r where r.id = :restoreId")
    Optional<RestoreHistory> findLockedById(@Param("restoreId") Long restoreId);
}
