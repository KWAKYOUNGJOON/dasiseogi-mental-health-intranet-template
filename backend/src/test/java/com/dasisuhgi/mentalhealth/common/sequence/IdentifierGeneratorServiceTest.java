package com.dasisuhgi.mentalhealth.common.sequence;

import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "app.seed.enabled=false")
class IdentifierGeneratorServiceTest {
    @Autowired
    private IdentifierGeneratorService identifierGeneratorService;

    @Autowired
    private IdentifierSequenceRepository identifierSequenceRepository;

    @BeforeEach
    void setUp() {
        identifierSequenceRepository.deleteAll();
    }

    @AfterEach
    void tearDown() {
        identifierSequenceRepository.deleteAll();
    }

    @Test
    void nextClientNoUsesMonthlySequenceBucket() {
        assertThat(identifierGeneratorService.nextClientNo(LocalDate.of(2026, 3, 30)))
                .isEqualTo("CL-202603-0001");
        assertThat(identifierGeneratorService.nextClientNo(LocalDate.of(2026, 3, 31)))
                .isEqualTo("CL-202603-0002");
        assertThat(identifierGeneratorService.nextClientNo(LocalDate.of(2026, 4, 1)))
                .isEqualTo("CL-202604-0001");
    }

    @Test
    void nextSessionNoUsesDailySequenceBucket() {
        assertThat(identifierGeneratorService.nextSessionNo(LocalDate.of(2026, 3, 28)))
                .isEqualTo("AS-20260328-0001");
        assertThat(identifierGeneratorService.nextSessionNo(LocalDate.of(2026, 3, 28)))
                .isEqualTo("AS-20260328-0002");
        assertThat(identifierGeneratorService.nextSessionNo(LocalDate.of(2026, 3, 29)))
                .isEqualTo("AS-20260329-0001");
    }

    @Test
    void concurrentSessionNoGenerationDoesNotCreateDuplicates() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        Callable<String> task = () -> {
            ready.countDown();
            assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
            return identifierGeneratorService.nextSessionNo(LocalDate.of(2026, 3, 28));
        };

        try {
            Future<String> first = executor.submit(task);
            Future<String> second = executor.submit(task);

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<String> sessionNos = List.of(
                    first.get(5, TimeUnit.SECONDS),
                    second.get(5, TimeUnit.SECONDS)
            ).stream().sorted().toList();

            assertThat(sessionNos).containsExactly(
                    "AS-20260328-0001",
                    "AS-20260328-0002"
            );
            assertThat(identifierSequenceRepository.countBySequenceType("SESSION:20260328")).isEqualTo(2L);
        } finally {
            executor.shutdownNow();
        }
    }
}
