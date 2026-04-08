package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.common.api.PageResponse;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.scale.dto.ScaleListItemResponse;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsScaleResponse;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatisticsServiceTest {
    @Mock
    private AssessmentQueryRepository assessmentQueryRepository;

    @Mock
    private ScaleService scaleService;

    @Test
    void getScaleStatisticsAddsRegistryDisplayMetadataAndPreservesLegacyFallback() {
        StatisticsService service = new StatisticsService(assessmentQueryRepository, scaleService);
        SessionUser sessionUser = sessionUser();

        when(scaleService.getScales()).thenReturn(List.of(
                new ScaleListItemResponse("PHQ9", "Patient Health Questionnaire-9", "PHQ-9", "우울", 1, true, true),
                new ScaleListItemResponse("GAD7", "Generalized Anxiety Disorder-7", "GAD-7", "불안", 2, true, true)
        ));
        when(assessmentQueryRepository.findScaleStatistics(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31)))
                .thenReturn(List.of(
                        new StatisticsScaleItemResponse("PHQ9", "PHQ-9", null, null, 18, 6, false),
                        new StatisticsScaleItemResponse("OLDPHQ", "구버전 PHQ", null, null, 4, 1, false)
                ));

        StatisticsScaleResponse response = service.getScaleStatistics(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                sessionUser
        );

        assertThat(response.items()).containsExactly(
                new StatisticsScaleItemResponse("PHQ9", "PHQ-9", "PHQ-9", "우울", 18, 6, true),
                new StatisticsScaleItemResponse("GAD7", "Generalized Anxiety Disorder-7", "GAD-7", "불안", 0, 0, true),
                new StatisticsScaleItemResponse("OLDPHQ", "구버전 PHQ", "구버전 PHQ", null, 4, 1, false)
        );
    }

    @Test
    void getAlertStatisticsAddsRegistryDisplayMetadataAndKeepsLegacyScaleNameFallback() {
        StatisticsService service = new StatisticsService(assessmentQueryRepository, scaleService);
        SessionUser sessionUser = sessionUser();

        when(scaleService.getScales()).thenReturn(List.of(
                new ScaleListItemResponse("PHQ9", "Patient Health Questionnaire-9", "PHQ-9", "우울", 1, true, true),
                new ScaleListItemResponse("CRI", "정신과적 위기 분류 평정척도 (CRI)", "CRI", "정신과적 위기 분류 평정척도", 2, true, true)
        ));
        when(assessmentQueryRepository.findStatisticsAlerts(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                null,
                null,
                1,
                10
        )).thenReturn(new PageResponse<>(
                List.of(
                        new StatisticsAlertItemResponse(
                                "김대상",
                                "2026-03-31 09:10:00",
                                "김담당",
                                "PHQ9",
                                "PHQ-9",
                                null,
                                null,
                                "CAUTION",
                                "우울 주의",
                                101L
                        ),
                        new StatisticsAlertItemResponse(
                                "박대상",
                                "2026-03-31 10:10:00",
                                "이담당",
                                "OLDPHQ",
                                "구버전 PHQ",
                                null,
                                null,
                                "HIGH_RISK",
                                "과거 고위험",
                                102L
                        )
                ),
                1,
                10,
                2,
                1
        ));

        PageResponse<StatisticsAlertItemResponse> response = service.getAlertStatistics(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                null,
                null,
                1,
                10,
                sessionUser
        );

        assertThat(response.items()).containsExactly(
                new StatisticsAlertItemResponse(
                        "김대상",
                        "2026-03-31 09:10:00",
                        "김담당",
                        "PHQ9",
                        "PHQ-9",
                        "PHQ-9",
                        "우울",
                        "CAUTION",
                        "우울 주의",
                        101L
                ),
                new StatisticsAlertItemResponse(
                        "박대상",
                        "2026-03-31 10:10:00",
                        "이담당",
                        "OLDPHQ",
                        "구버전 PHQ",
                        "구버전 PHQ",
                        null,
                        "HIGH_RISK",
                        "과거 고위험",
                        102L
                )
        );
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.totalItems()).isEqualTo(2);
    }

    private SessionUser sessionUser() {
        return new SessionUser(1L, "admin", "관리자", UserRole.ADMIN, UserStatus.ACTIVE);
    }
}
