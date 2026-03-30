package com.dasisuhgi.mentalhealth.common.sequence;

import java.time.LocalDate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentifierGeneratorService {
    private static final String CLIENT_SEQUENCE = "CLIENT";
    private static final String SESSION_SEQUENCE = "SESSION";

    private final IdentifierSequenceRepository identifierSequenceRepository;

    public IdentifierGeneratorService(IdentifierSequenceRepository identifierSequenceRepository) {
        this.identifierSequenceRepository = identifierSequenceRepository;
    }

    @Transactional
    public String nextClientNo(LocalDate registeredDate) {
        long sequence = identifierSequenceRepository.saveAndFlush(new IdentifierSequence(CLIENT_SEQUENCE)).getId();
        return "CL-%s-%06d".formatted(toYearMonth(registeredDate), sequence);
    }

    @Transactional
    public String nextSessionNo(LocalDate sessionDate) {
        long sequence = identifierSequenceRepository.saveAndFlush(new IdentifierSequence(SESSION_SEQUENCE)).getId();
        return "AS-%s-%06d".formatted(toDate(sessionDate), sequence);
    }

    private String toYearMonth(LocalDate date) {
        return "%04d%02d".formatted(date.getYear(), date.getMonthValue());
    }

    private String toDate(LocalDate date) {
        return "%04d%02d%02d".formatted(date.getYear(), date.getMonthValue(), date.getDayOfMonth());
    }
}
