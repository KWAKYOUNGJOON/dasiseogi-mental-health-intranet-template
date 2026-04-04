package com.dasisuhgi.mentalhealth.restore.repository;

import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import com.dasisuhgi.mentalhealth.restore.dto.RestoreHistoryListItemResponse;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class RestoreHistoryQueryRepository {
    private final EntityManager entityManager;

    public RestoreHistoryQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public PageResponse<RestoreHistoryListItemResponse> findRestoreHistories(
            RestoreStatus status,
            LocalDate dateFrom,
            LocalDate dateTo,
            int page,
            int size
    ) {
        StringBuilder fromClause = new StringBuilder(" from RestoreHistory r where 1=1");
        Map<String, Object> parameters = new HashMap<>();

        if (status != null) {
            fromClause.append(" and r.status = :status");
            parameters.put("status", status);
        }
        if (dateFrom != null) {
            fromClause.append(" and r.uploadedAt >= :dateFrom");
            parameters.put("dateFrom", dateFrom.atStartOfDay());
        }
        if (dateTo != null) {
            fromClause.append(" and r.uploadedAt <= :dateTo");
            parameters.put("dateTo", dateTo.plusDays(1).atStartOfDay().minusNanos(1));
        }

        TypedQuery<RestoreHistoryRow> query = entityManager.createQuery("""
                select new com.dasisuhgi.mentalhealth.restore.repository.RestoreHistoryRow(
                    r.id,
                    r.status,
                    r.fileName,
                    r.fileSizeBytes,
                    r.uploadedAt,
                    r.validatedAt,
                    r.uploadedByNameSnapshot,
                    r.formatVersion,
                    r.datasourceType,
                    r.backupId,
                    r.failureReason
                )
                """ + fromClause + " order by r.uploadedAt desc, r.id desc", RestoreHistoryRow.class);
        parameters.forEach(query::setParameter);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(r.id) " + fromClause, Long.class);
        parameters.forEach(countQuery::setParameter);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        List<RestoreHistoryListItemResponse> items = query.getResultList().stream()
                .map(row -> new RestoreHistoryListItemResponse(
                        row.id(),
                        row.status().name(),
                        row.fileName(),
                        row.fileSizeBytes(),
                        SeoulDateTimeSupport.formatDateTime(row.uploadedAt()),
                        SeoulDateTimeSupport.formatDateTime(row.validatedAt()),
                        row.uploadedByNameSnapshot(),
                        row.formatVersion(),
                        row.datasourceType(),
                        row.backupId(),
                        row.failureReason()
                ))
                .toList();
        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }
}

record RestoreHistoryRow(
        Long id,
        com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus status,
        String fileName,
        Long fileSizeBytes,
        LocalDateTime uploadedAt,
        LocalDateTime validatedAt,
        String uploadedByNameSnapshot,
        String formatVersion,
        String datasourceType,
        Long backupId,
        String failureReason
) {
}
