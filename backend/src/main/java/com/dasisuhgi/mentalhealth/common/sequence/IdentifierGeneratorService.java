package com.dasisuhgi.mentalhealth.common.sequence;

import java.time.LocalDate;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.ReentrantLock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class IdentifierGeneratorService {
    private static final String CLIENT_SEQUENCE = "CLIENT";
    private static final String SESSION_SEQUENCE = "SESSION";

    private final IdentifierSequenceRepository identifierSequenceRepository;
    private final ConcurrentMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    public IdentifierGeneratorService(IdentifierSequenceRepository identifierSequenceRepository) {
        this.identifierSequenceRepository = identifierSequenceRepository;
    }

    @Transactional
    public String nextClientNo(LocalDate registeredDate) {
        String yearMonth = toYearMonth(registeredDate);
        int sequence = nextSequence("%s:%s".formatted(CLIENT_SEQUENCE, yearMonth));
        return "CL-%s-%04d".formatted(yearMonth, sequence);
    }

    @Transactional
    public String nextSessionNo(LocalDate sessionDate) {
        String date = toDate(sessionDate);
        int sequence = nextSequence("%s:%s".formatted(SESSION_SEQUENCE, date));
        return "AS-%s-%04d".formatted(date, sequence);
    }

    private int nextSequence(String sequenceType) {
        ReentrantLock lock = acquireLock(sequenceType);
        boolean releaseOnTransactionCompletion = TransactionSynchronizationManager.isSynchronizationActive();
        if (releaseOnTransactionCompletion) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    releaseLock(sequenceType, lock);
                }
            });
        }

        try {
            long nextValue = identifierSequenceRepository.countBySequenceType(sequenceType) + 1;
            identifierSequenceRepository.saveAndFlush(new IdentifierSequence(sequenceType));
            return Math.toIntExact(nextValue);
        } finally {
            if (!releaseOnTransactionCompletion) {
                releaseLock(sequenceType, lock);
            }
        }
    }

    private ReentrantLock acquireLock(String sequenceType) {
        ReentrantLock lock = locks.computeIfAbsent(sequenceType, key -> new ReentrantLock(true));
        lock.lock();
        return lock;
    }

    private void releaseLock(String sequenceType, ReentrantLock lock) {
        lock.unlock();
        if (!lock.isLocked() && !lock.hasQueuedThreads()) {
            locks.remove(sequenceType, lock);
        }
    }

    private String toYearMonth(LocalDate date) {
        return "%04d%02d".formatted(date.getYear(), date.getMonthValue());
    }

    private String toDate(LocalDate date) {
        return "%04d%02d%02d".formatted(date.getYear(), date.getMonthValue(), date.getDayOfMonth());
    }
}
