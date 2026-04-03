package com.dasisuhgi.mentalhealth.audit.repository;

import com.dasisuhgi.mentalhealth.audit.dto.ActivityLogListItemResponse;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
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
public class ActivityLogQueryRepository {
    private final EntityManager entityManager;

    public ActivityLogQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public PageResponse<ActivityLogListItemResponse> findLogs(
            LocalDate dateFrom,
            LocalDate dateTo,
            Long userId,
            ActivityActionType actionType,
            int page,
            int size
    ) {
        StringBuilder fromClause = new StringBuilder(" from ActivityLog l where 1=1");
        Map<String, Object> parameters = new HashMap<>();

        if (dateFrom != null) {
            fromClause.append(" and l.createdAt >= :dateFrom");
            parameters.put("dateFrom", dateFrom.atStartOfDay());
        }
        if (dateTo != null) {
            fromClause.append(" and l.createdAt <= :dateTo");
            parameters.put("dateTo", dateTo.plusDays(1).atStartOfDay().minusNanos(1));
        }
        if (userId != null) {
            fromClause.append(" and l.userId = :userId");
            parameters.put("userId", userId);
        }
        if (actionType != null) {
            fromClause.append(" and l.actionType = :actionType");
            parameters.put("actionType", actionType);
        }

        TypedQuery<ActivityLogRow> query = entityManager.createQuery("""
                select new com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRow(
                    l.id,
                    l.userId,
                    l.userNameSnapshot,
                    l.actionType,
                    l.targetType,
                    l.targetId,
                    l.targetLabel,
                    l.description,
                    l.ipAddress,
                    l.createdAt
                )
                """ + fromClause + " order by l.createdAt desc, l.id desc", ActivityLogRow.class);
        parameters.forEach(query::setParameter);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(l.id) " + fromClause, Long.class);
        parameters.forEach(countQuery::setParameter);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        List<ActivityLogListItemResponse> items = query.getResultList().stream()
                .map(row -> new ActivityLogListItemResponse(
                        row.id(),
                        row.userId(),
                        row.userNameSnapshot(),
                        row.actionType().name(),
                        row.targetType() == null ? null : row.targetType().name(),
                        row.targetId(),
                        row.targetLabel(),
                        row.description(),
                        row.ipAddress(),
                        SeoulDateTimeSupport.formatDateTime(row.createdAt())
                ))
                .toList();

        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }
}

record ActivityLogRow(
        Long id,
        Long userId,
        String userNameSnapshot,
        com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType actionType,
        com.dasisuhgi.mentalhealth.audit.entity.ActivityTargetType targetType,
        Long targetId,
        String targetLabel,
        String description,
        String ipAddress,
        LocalDateTime createdAt
) {
}
