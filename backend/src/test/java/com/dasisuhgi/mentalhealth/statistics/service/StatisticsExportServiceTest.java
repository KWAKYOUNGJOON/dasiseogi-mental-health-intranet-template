package com.dasisuhgi.mentalhealth.statistics.service;

import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentQueryRepository;
import com.dasisuhgi.mentalhealth.audit.service.ActivityLogService;
import com.dasisuhgi.mentalhealth.common.config.ExportProperties;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.security.AccessPolicyService;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsAlertItemResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.PerformedByStatResponse;
import com.dasisuhgi.mentalhealth.statistics.dto.StatisticsSummaryResponse;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatisticsExportServiceTest {
    @Mock
    private StatisticsService statisticsService;

    @Mock
    private AssessmentQueryRepository assessmentQueryRepository;

    @Mock
    private AccessPolicyService accessPolicyService;

    @Mock
    private ActivityLogService activityLogService;

    @Test
    void exportSummaryUsesConfiguredTempPath(@TempDir Path tempDir) {
        Path exportRoot = tempDir.resolve("exports");
        TrackingExportTempFileService exportTempFileService = new TrackingExportTempFileService(exportProperties(exportRoot));
        StatisticsExportService service = new StatisticsExportService(
                statisticsService,
                assessmentQueryRepository,
                accessPolicyService,
                activityLogService,
                exportTempFileService
        );
        SessionUser sessionUser = new SessionUser(1L, "admin", "관리자", UserRole.ADMIN, UserStatus.ACTIVE);
        User currentUser = adminUser();

        when(accessPolicyService.getCurrentUser(sessionUser)).thenReturn(currentUser);
        when(accessPolicyService.isAdmin(currentUser)).thenReturn(true);
        when(statisticsService.getSummary(eq(LocalDate.of(2026, 3, 1)), eq(LocalDate.of(2026, 3, 31)), eq(sessionUser)))
                .thenReturn(new StatisticsSummaryResponse(
                        LocalDate.of(2026, 3, 1),
                        LocalDate.of(2026, 3, 31),
                        3,
                        5,
                        1,
                        1,
                        List.of(new PerformedByStatResponse(1L, "관리자", 3))
                ));

        StatisticsExportService.StatisticsExportFile exportFile = service.export(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                "SUMMARY",
                sessionUser
        );

        assertThat(exportFile.filename()).isEqualTo("statistics-summary-2026-03-01-2026-03-31.csv");
        assertThat(new String(exportFile.content(), StandardCharsets.UTF_8)).contains("전체 세션 수");
        assertThat(exportTempFileService.lastCreatedFile).isNotNull();
        assertThat(exportTempFileService.lastCreatedFile.getParent()).isEqualTo(exportRoot.toAbsolutePath().normalize());
        assertThat(Files.exists(exportTempFileService.lastCreatedFile)).isFalse();
    }

    @Test
    void exportSummaryFailsClearlyWhenConfiguredTempPathIsInvalid(@TempDir Path tempDir) throws Exception {
        Path invalidPath = Files.createFile(tempDir.resolve("not-a-directory.tmp"));
        ExportTempFileService exportTempFileService = new ExportTempFileService(exportProperties(invalidPath));
        StatisticsExportService service = new StatisticsExportService(
                statisticsService,
                assessmentQueryRepository,
                accessPolicyService,
                activityLogService,
                exportTempFileService
        );
        SessionUser sessionUser = new SessionUser(1L, "admin", "관리자", UserRole.ADMIN, UserStatus.ACTIVE);
        User currentUser = adminUser();

        when(accessPolicyService.getCurrentUser(sessionUser)).thenReturn(currentUser);
        when(accessPolicyService.isAdmin(currentUser)).thenReturn(true);
        when(statisticsService.getSummary(any(), any(), eq(sessionUser)))
                .thenReturn(new StatisticsSummaryResponse(
                        LocalDate.of(2026, 3, 1),
                        LocalDate.of(2026, 3, 31),
                        1,
                        1,
                        0,
                        0,
                        List.of()
                ));

        AppException exception = assertThrows(
                AppException.class,
                () -> service.export(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31), "SUMMARY", sessionUser),
                "Expected invalid export temp path to raise AppException"
        );

        assertThat(exception).isNotNull();
        assertThat(exception.getErrorCode()).isEqualTo("EXPORT_TEMP_PATH_UNAVAILABLE");
        assertThat(exception.getMessage()).isEqualTo("export 임시 경로를 사용할 수 없습니다.");
        verify(activityLogService, never()).log(any(), any(), any(), any(), any(), any());
    }

    @Test
    void exportAlertListKeepsSessionCompletedAtInUnifiedDisplayFormat(@TempDir Path tempDir) {
        Path exportRoot = tempDir.resolve("exports");
        TrackingExportTempFileService exportTempFileService = new TrackingExportTempFileService(exportProperties(exportRoot));
        StatisticsExportService service = new StatisticsExportService(
                statisticsService,
                assessmentQueryRepository,
                accessPolicyService,
                activityLogService,
                exportTempFileService
        );
        SessionUser sessionUser = new SessionUser(1L, "admin", "관리자", UserRole.ADMIN, UserStatus.ACTIVE);
        User currentUser = adminUser();

        when(accessPolicyService.getCurrentUser(sessionUser)).thenReturn(currentUser);
        when(accessPolicyService.isAdmin(currentUser)).thenReturn(true);
        when(assessmentQueryRepository.findStatisticsAlerts(eq(LocalDate.of(2026, 3, 1)), eq(LocalDate.of(2026, 3, 31)), eq(null), eq(null), eq(1), eq(10000)))
                .thenReturn(new com.dasisuhgi.mentalhealth.common.api.PageResponse<>(
                        List.of(new StatisticsAlertItemResponse(
                                "김대상",
                                "2026-03-31 09:10:00",
                                "김담당",
                                "PHQ9",
                                "CAUTION",
                                "우울 주의",
                                101L
                        )),
                        1,
                        10000,
                        1,
                        1
                ));

        StatisticsExportService.StatisticsExportFile exportFile = service.export(
                LocalDate.of(2026, 3, 1),
                LocalDate.of(2026, 3, 31),
                "ALERT_LIST",
                sessionUser
        );

        String csv = new String(exportFile.content(), StandardCharsets.UTF_8);
        assertThat(csv).contains("\"2026-03-31 09:10:00\"");
        assertThat(csv).doesNotContain("T09:10:00");
    }

    private ExportProperties exportProperties(Path exportRoot) {
        ExportProperties exportProperties = new ExportProperties();
        exportProperties.setTempPath(exportRoot.toString());
        return exportProperties;
    }

    private User adminUser() {
        User user = new User();
        user.setId(1L);
        user.setLoginId("admin");
        user.setName("관리자");
        user.setRole(UserRole.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private static final class TrackingExportTempFileService extends ExportTempFileService {
        private Path lastCreatedFile;

        private TrackingExportTempFileService(ExportProperties exportProperties) {
            super(exportProperties);
        }

        @Override
        public Path createTempFile(String prefix, String suffix) {
            lastCreatedFile = super.createTempFile(prefix, suffix);
            return lastCreatedFile;
        }
    }
}
