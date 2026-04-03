package com.dasisuhgi.mentalhealth.common.time;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class SeoulDateTimeSupport {
    private static final ZoneId ASIA_SEOUL = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter DISPLAY_DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private SeoulDateTimeSupport() {
    }

    public static ZoneId zoneId() {
        return ASIA_SEOUL;
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(ASIA_SEOUL);
    }

    public static LocalDateTime now(Clock clock) {
        return LocalDateTime.now(clock.withZone(ASIA_SEOUL));
    }

    public static LocalDate today() {
        return LocalDate.now(ASIA_SEOUL);
    }

    public static String formatDateTime(LocalDateTime value) {
        return value == null ? null : DISPLAY_DATETIME_FORMAT.format(value);
    }
}
