package com.dasisuhgi.mentalhealth.assessment.repository;

import com.dasisuhgi.mentalhealth.assessment.dto.AssessmentRecordListItemResponse;
import com.dasisuhgi.mentalhealth.assessment.entity.AlertType;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.PerformedByStatResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsSummaryResponse;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class AssessmentQueryRepository {
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final EntityManager entityManager;

    public AssessmentQueryRepository(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public PageResponse<AssessmentRecordListItemResponse> findAssessmentRecords(
            LocalDate dateFrom,
            LocalDate dateTo,
            String clientName,
            String scaleCode,
            boolean includeMisentered,
            Long currentUserId,
            boolean admin,
            int page,
            int size
    ) {
        StringBuilder fromClause = new StringBuilder("""
                from SessionScale sc
                join sc.session s
                join s.client c
                join s.performedBy p
                where c.status <> :misregisteredStatus
                """);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
        appendRecordVisibilityClause(fromClause, parameters, includeMisentered, currentUserId, admin);
        appendDateRange(fromClause, parameters, "s.sessionDate", dateFrom, dateTo);
        appendContainsClause(fromClause, parameters, "c.name", "clientName", clientName);
        appendEqualsIgnoreCaseClause(fromClause, parameters, "sc.scaleCode", "scaleCode", scaleCode);

        String selectClause = """
                select new com.dasisuhgi.mentalhealth.assessment.repository.AssessmentRecordRow(
                    s.id,
                    sc.id,
                    s.sessionNo,
                    s.sessionCompletedAt,
                    c.id,
                    c.name,
                    p.name,
                    sc.scaleCode,
                    sc.scaleName,
                    sc.totalScore,
                    sc.resultLevel,
                    sc.hasAlert,
                    s.status
                )
                """;
        String orderBy = " order by s.sessionCompletedAt desc, sc.displayOrder asc, sc.id desc";

        TypedQuery<AssessmentRecordRow> query = entityManager.createQuery(selectClause + fromClause + orderBy, AssessmentRecordRow.class);
        applyParameters(query, parameters);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(sc.id) " + fromClause, Long.class);
        applyParameters(countQuery, parameters);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        List<AssessmentRecordListItemResponse> items = query.getResultList().stream()
                .map(row -> new AssessmentRecordListItemResponse(
                        row.sessionId(),
                        row.sessionScaleId(),
                        row.sessionNo(),
                        DATETIME_FORMAT.format(row.sessionCompletedAt()),
                        row.clientId(),
                        row.clientName(),
                        row.performedByName(),
                        row.scaleCode(),
                        row.scaleName(),
                        row.totalScore().intValue(),
                        row.resultLevel(),
                        row.hasAlert(),
                        row.sessionStatus().name()
                ))
                .toList();

        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }

    public StatisticsSummaryResponse findStatisticsSummary(LocalDate dateFrom, LocalDate dateTo) {
        StringBuilder sessionFromClause = new StringBuilder("""
                from AssessmentSession s
                join s.client c
                join s.performedBy p
                where c.status <> :misregisteredStatus
                  and s.status = :completedStatus
                """);
        Map<String, Object> sessionParameters = new HashMap<>();
        sessionParameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
        sessionParameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
        appendDateRange(sessionFromClause, sessionParameters, "s.sessionDate", dateFrom, dateTo);

        long totalSessionCount = getSingleCount("select count(s.id) " + sessionFromClause, sessionParameters);
        long alertSessionCount = getSingleCount("select count(s.id) " + sessionFromClause + " and s.hasAlert = true", sessionParameters);

        StringBuilder scaleFromClause = new StringBuilder("""
                from SessionScale sc
                join sc.session s
                join s.client c
                where c.status <> :misregisteredStatus
                  and s.status = :completedStatus
                """);
        Map<String, Object> scaleParameters = new HashMap<>();
        scaleParameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
        scaleParameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
        appendDateRange(scaleFromClause, scaleParameters, "s.sessionDate", dateFrom, dateTo);

        long totalScaleCount = getSingleCount("select count(sc.id) " + scaleFromClause, scaleParameters);
        long alertScaleCount = getSingleCount("select count(sc.id) " + scaleFromClause + " and sc.hasAlert = true", scaleParameters);

        TypedQuery<PerformedByCountRow> performedByQuery = entityManager.createQuery("""
                select new com.dasisuhgi.mentalhealth.assessment.repository.PerformedByCountRow(
                    p.id,
                    p.name,
                    count(s.id)
                )
                """ + sessionFromClause + """
                 group by p.id, p.name
                 order by count(s.id) desc, p.name asc
                """, PerformedByCountRow.class);
        applyParameters(performedByQuery, sessionParameters);
        List<PerformedByStatResponse> performedByStats = performedByQuery.getResultList().stream()
                .map(row -> new PerformedByStatResponse(row.userId(), row.userName(), row.sessionCount()))
                .toList();

        return new StatisticsSummaryResponse(
                dateFrom,
                dateTo,
                totalSessionCount,
                totalScaleCount,
                alertSessionCount,
                alertScaleCount,
                performedByStats
        );
    }

    public List<StatisticsScaleItemResponse> findScaleStatistics(LocalDate dateFrom, LocalDate dateTo) {
        StringBuilder fromClause = new StringBuilder("""
                from SessionScale sc
                join sc.session s
                join s.client c
                where c.status <> :misregisteredStatus
                  and s.status = :completedStatus
                """);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
        parameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
        appendDateRange(fromClause, parameters, "s.sessionDate", dateFrom, dateTo);

        TypedQuery<ScaleStatisticsRow> query = entityManager.createQuery("""
                select new com.dasisuhgi.mentalhealth.assessment.repository.ScaleStatisticsRow(
                    sc.scaleCode,
                    sc.scaleName,
                    count(sc.id),
                    sum(case when sc.hasAlert = true then 1 else 0 end)
                )
                """ + fromClause + """
                 group by sc.scaleCode, sc.scaleName
                 order by min(sc.displayOrder) asc, sc.scaleName asc
                """, ScaleStatisticsRow.class);
        applyParameters(query, parameters);
        return query.getResultList().stream()
                .map(row -> new StatisticsScaleItemResponse(
                        row.scaleCode(),
                        row.scaleName(),
                        row.totalCount(),
                        row.alertCount() == null ? 0 : row.alertCount(),
                        false
                ))
                .toList();
    }

    public PageResponse<StatisticsAlertItemResponse> findStatisticsAlerts(
            LocalDate dateFrom,
            LocalDate dateTo,
            String scaleCode,
            AlertType alertType,
            int page,
            int size
    ) {
        StringBuilder fromClause = new StringBuilder("""
                from SessionAlert a
                join a.session s
                join s.client c
                join s.performedBy p
                where c.status <> :misregisteredStatus
                  and s.status = :completedStatus
                """);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("misregisteredStatus", ClientStatus.MISREGISTERED);
        parameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
        appendDateRange(fromClause, parameters, "s.sessionDate", dateFrom, dateTo);
        appendEqualsIgnoreCaseClause(fromClause, parameters, "a.scaleCode", "scaleCode", scaleCode);
        if (alertType != null) {
            fromClause.append(" and a.alertType = :alertType");
            parameters.put("alertType", alertType);
        }

        TypedQuery<StatisticsAlertRow> query = entityManager.createQuery("""
                select new com.dasisuhgi.mentalhealth.assessment.repository.StatisticsAlertRow(
                    c.name,
                    s.sessionCompletedAt,
                    p.name,
                    a.scaleCode,
                    a.alertType,
                    a.alertMessage,
                    s.id
                )
                """ + fromClause + """
                 order by s.sessionCompletedAt desc, a.id desc
                """, StatisticsAlertRow.class);
        applyParameters(query, parameters);
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(a.id) " + fromClause, Long.class);
        applyParameters(countQuery, parameters);
        long totalItems = countQuery.getSingleResult();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / size);

        List<StatisticsAlertItemResponse> items = query.getResultList().stream()
                .map(row -> new StatisticsAlertItemResponse(
                        row.clientName(),
                        DATETIME_FORMAT.format(row.sessionCompletedAt()),
                        row.performedByName(),
                        row.scaleCode(),
                        row.alertType().name(),
                        row.alertMessage(),
                        row.sessionId()
                ))
                .toList();

        return new PageResponse<>(items, page, size, totalItems, totalPages);
    }

    private long getSingleCount(String jpql, Map<String, Object> parameters) {
        TypedQuery<Long> query = entityManager.createQuery(jpql, Long.class);
        applyParameters(query, parameters);
        return query.getSingleResult();
    }

    private void appendRecordVisibilityClause(
            StringBuilder fromClause,
            Map<String, Object> parameters,
            boolean includeMisentered,
            Long currentUserId,
            boolean admin
    ) {
        if (!includeMisentered) {
            fromClause.append(" and s.status = :completedStatus");
            parameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
            return;
        }

        parameters.put("completedStatus", AssessmentSessionStatus.COMPLETED);
        parameters.put("misenteredStatus", AssessmentSessionStatus.MISENTERED);
        if (admin) {
            fromClause.append(" and (s.status = :completedStatus or s.status = :misenteredStatus)");
            return;
        }

        fromClause.append(" and (s.status = :completedStatus or (s.status = :misenteredStatus and p.id = :currentUserId))");
        parameters.put("currentUserId", currentUserId);
    }

    private void appendDateRange(
            StringBuilder fromClause,
            Map<String, Object> parameters,
            String fieldName,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        if (dateFrom != null) {
            fromClause.append(" and ").append(fieldName).append(" >= :dateFrom");
            parameters.put("dateFrom", dateFrom);
        }
        if (dateTo != null) {
            fromClause.append(" and ").append(fieldName).append(" <= :dateTo");
            parameters.put("dateTo", dateTo);
        }
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

    private void appendEqualsIgnoreCaseClause(
            StringBuilder fromClause,
            Map<String, Object> parameters,
            String fieldName,
            String parameterName,
            String value
    ) {
        if (value == null || value.isBlank()) {
            return;
        }
        fromClause.append(" and upper(").append(fieldName).append(") = :").append(parameterName);
        parameters.put(parameterName, value.trim().toUpperCase());
    }

    private void applyParameters(TypedQuery<?> query, Map<String, Object> parameters) {
        parameters.forEach(query::setParameter);
    }
}

record AssessmentRecordRow(
        Long sessionId,
        Long sessionScaleId,
        String sessionNo,
        LocalDateTime sessionCompletedAt,
        Long clientId,
        String clientName,
        String performedByName,
        String scaleCode,
        String scaleName,
        BigDecimal totalScore,
        String resultLevel,
        boolean hasAlert,
        AssessmentSessionStatus sessionStatus
) {
}

record PerformedByCountRow(
        Long userId,
        String userName,
        long sessionCount
) {
}

record ScaleStatisticsRow(
        String scaleCode,
        String scaleName,
        long totalCount,
        Long alertCount
) {
}

record StatisticsAlertRow(
        String clientName,
        LocalDateTime sessionCompletedAt,
        String performedByName,
        String scaleCode,
        AlertType alertType,
        String alertMessage,
        Long sessionId
) {
}
