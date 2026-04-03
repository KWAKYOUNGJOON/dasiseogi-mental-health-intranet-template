package com.dasisuhgi.mentalhealth.assessment.support;

import com.dasisuhgi.mentalhealth.common.time.SeoulDateTimeSupport;
import java.time.Clock;
import java.time.LocalDateTime;

public final class AssessmentDateTimePolicy {
    private AssessmentDateTimePolicy() {
    }

    public static LocalDateTime now() {
        return SeoulDateTimeSupport.now();
    }

    static LocalDateTime now(Clock clock) {
        return SeoulDateTimeSupport.now(clock);
    }
}
