package com.dasisuhgi.mentalhealth.assessment.support;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class AssessmentDateTimePolicyTest {

    @Test
    void returnsNowInAsiaSeoul() {
        Clock clock = Clock.fixed(Instant.parse("2026-03-31T00:20:30Z"), ZoneOffset.UTC);

        LocalDateTime actual = AssessmentDateTimePolicy.now(clock);

        assertEquals(LocalDateTime.of(2026, 3, 31, 9, 20, 30), actual);
    }
}
