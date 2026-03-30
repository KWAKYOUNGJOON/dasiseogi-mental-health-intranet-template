package com.dasisuhgi.mentalhealth.client.repository;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.client.dto.ClientListItemResponse;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.entity.Gender;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class ClientQueryRepository {
    private final EntityManager entityManager;

    public ClientQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public PageResponse<ClientListItemResponse> findClients(
            String name,
            LocalDate birthDate,
            Long primaryWorkerId,
            boolean includeMisregistered,
            Long currentUserId,
            boolean admin,
            int page,
            int size
    ) {
        StringBuilder fromClause = new StringBuilder("""
                from Client c
                join c.primaryWorker pw
                where 1 = 1
                """);
        Map<String, Object> parameters = new HashMap<>();

        appendVisibilityClause(fromClause, parameters, includeMisregistered, currentUserId, admin);
        appendContainsClause(fromClause, parameters, "c.name", "name", name);
        appendEqualsClause(fromClause, parameters, "c.birthDate", "birthDate", birthDate);
        appendEqualsClause(fromClause, parameters, "pw.id", "primaryWorkerId", primaryWorkerId);
        Map<String, Object> selectParameters = new HashMap<>(parameters);

        String selectClause = """
                select new com.dasisuhgi.mentalhealth.client.repository.ClientListRow(
                    c.id,
                    c.clientNo,
                    c.name,
                    c.birthDate,
                    c.gender,
                    pw.name,
                    (
                        select max(s.sessionDate)
                        from AssessmentSession s
                        where s.client.id = c.id
                          and s.status = :completedStatus
                    ),
                    c.status
                )
                """;
        selectParameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
        String orderByClause = " order by c.createdAt desc, c.id desc";

        TypedQuery<ClientListRow> query = entityManager.createQuery(selectClause + fromClause + orderByClause, ClientListRow.class);
        applyParameters(query, selectParameters);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(c.id) " + fromClause, Long.class);
        applyParameters(countQuery, parameters);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        List<ClientListItemResponse> items = query.getResultList().stream()
                .map(row -> new ClientListItemResponse(
                        row.id(),
                        row.clientNo(),
                        row.name(),
                        row.birthDate().toString(),
                        row.gender().name(),
                        row.primaryWorkerName(),
                        row.latestSessionDate() == null ? null : row.latestSessionDate().toString(),
                        row.status().name()
                ))
                .toList();

        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }

    private void appendVisibilityClause(
            StringBuilder fromClause,
            Map<String, Object> parameters,
            boolean includeMisregistered,
            Long currentUserId,
            boolean admin
    ) {
        if (!includeMisregistered) {
            fromClause.append(" and c.status <> :misregisteredStatus");
            parameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
            return;
        }
        if (admin) {
            return;
        }
        fromClause.append(" and (c.status <> :misregisteredStatus or c.createdBy.id = :currentUserId)");
        parameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
        parameters.put("currentUserId", currentUserId);
    }

    private void appendContainsClause(
            StringBuilder fromClause,
            Map<String, Object> parameters,
            String fieldName,
            String parameterName,
            String value
    ) {
        if (value == null || value.isBlank()) {
            return;
        }
        fromClause.append(" and lower(").append(fieldName).append(") like :").append(parameterName);
        parameters.put(parameterName, "%" + value.trim().toLowerCase() + "%");
    }

    private void appendEqualsClause(
            StringBuilder fromClause,
            Map<String, Object> parameters,
            String fieldName,
            String parameterName,
            Object value
    ) {
        if (value == null) {
            return;
        }
        fromClause.append(" and ").append(fieldName).append(" = :").append(parameterName);
        parameters.put(parameterName, value);
    }

    private void applyParameters(TypedQuery<?> query, Map<String, Object> parameters) {
        parameters.forEach(query::setParameter);
    }
}

record ClientListRow(
        Long id,
        String clientNo,
        String name,
        LocalDate birthDate,
        Gender gender,
        String primaryWorkerName,
        LocalDate latestSessionDate,
        ClientStatus status
) {
}
