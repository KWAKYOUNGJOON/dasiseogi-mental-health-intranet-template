package com.dasisuhgi.mentalhealth.backup.repository;

import com.dasisuhgi.mentalhealth.backup.dto.BackupHistoryListItemResponse;
import com.dasisuhgi.mentalhealth.backup.entity.BackupStatus;
import com.dasisuhgi.mentalhealth.backup.entity.BackupType;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class BackupHistoryQueryRepository {
    private final EntityManager entityManager;

    public BackupHistoryQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public PageResponse<BackupHistoryListItemResponse> findBackups(
            BackupType backupType,
            BackupStatus status,
            LocalDate dateFrom,
            LocalDate dateTo,
            int page,
            int size
    ) {
        StringBuilder fromClause = new StringBuilder(" from BackupHistory b where 1=1");
        Map<String, Object> parameters = new HashMap<>();
        if (backupType != null) {
            fromClause.append(" and b.backupType = :backupType");
            parameters.put("backupType", backupType);
        }
        if (status != null) {
            fromClause.append(" and b.status = :status");
            parameters.put("status", status);
        }
        if (dateFrom != null) {
            fromClause.append(" and b.startedAt >= :dateFrom");
            parameters.put("dateFrom", dateFrom.atStartOfDay());
        }
        if (dateTo != null) {
            fromClause.append(" and b.startedAt <= :dateTo");
            parameters.put("dateTo", dateTo.plusDays(1).atStartOfDay().minusNanos(1));
        }

        TypedQuery<BackupHistoryRow> query = entityManager.createQuery("""
                select new com.dasisuhgi.mentalhealth.backup.repository.BackupHistoryRow(
                    b.id,
                    b.backupType,
                    b.backupMethod,
                    b.status,
                    b.fileName,
                    b.filePath,
                    b.fileSizeBytes,
                    b.startedAt,
                    b.completedAt,
                    b.executedByNameSnapshot,
                    b.failureReason
                )
                """ + fromClause + " order by b.startedAt desc, b.id desc", BackupHistoryRow.class);
        parameters.forEach(query::setParameter);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(b.id) " + fromClause, Long.class);
        parameters.forEach(countQuery::setParameter);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        List<BackupHistoryListItemResponse> items = query.getResultList().stream()
                .map(row -> new BackupHistoryListItemResponse(
                        row.id(),
                        row.backupType().name(),
                        row.backupMethod().name(),
                        row.status().name(),
                        row.fileName(),
                        row.filePath(),
                        row.fileSizeBytes(),
                        SeoulDateTimeSupport.formatDateTime(row.startedAt()),
                        SeoulDateTimeSupport.formatDateTime(row.completedAt()),
                        row.executedByNameSnapshot(),
                        row.failureReason()
                ))
                .toList();
        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }
}

record BackupHistoryRow(
        Long id,
        com.dasisuhgi.mentalhealth.backup.entity.BackupType backupType,
        com.dasisuhgi.mentalhealth.backup.entity.BackupMethod backupMethod,
        com.dasisuhgi.mentalhealth.backup.entity.BackupStatus status,
        String fileName,
        String filePath,
        Long fileSizeBytes,
        LocalDateTime startedAt,
        LocalDateTime completedAt,
        String executedByNameSnapshot,
        String failureReason
) {
}
