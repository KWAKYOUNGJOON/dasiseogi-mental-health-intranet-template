package com.dasisuhgi.mentalhealth.assessment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public record SaveAssessmentSessionRequest(
        @NotNull(message = "대상자 정보가 필요합니다.") Long clientId,
        @NotNull(message = "검사 시작 시각이 필요합니다.") LocalDateTime sessionStartedAt,
        @NotNull(message = "검사 종료 시각이 필요합니다.") LocalDateTime sessionCompletedAt,
        @Size(max = 1000, message = "세션 메모는 1000자 이하여야 합니다.") String memo,
        @Valid @NotEmpty(message = "척도 선택이 필요합니다.") List<SelectedScaleRequest> selectedScales
) {
}
