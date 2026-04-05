package com.dasisuhgi.mentalhealth.restore.repository;

import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreHistory;
import com.dasisuhgi.mentalhealth.restore.entity.RestoreStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class RestoreHistoryQueryRepository {
    private final EntityManager entityManager;

    public RestoreHistoryQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public PageResponse<RestoreHistory> findRestoreHistories(
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

        TypedQuery<RestoreHistory> query = entityManager.createQuery(
                "select r" + fromClause + " order by r.uploadedAt desc, r.id desc",
                RestoreHistory.class
        );
        parameters.forEach(query::setParameter);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(r.id) " + fromClause, Long.class);
        parameters.forEach(countQuery::setParameter);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        return new PageResponse<>(query.getResultList(), page, size, totalItems, totalPages);
    }
}
