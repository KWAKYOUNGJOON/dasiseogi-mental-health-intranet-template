package com.dasisuhgi.mentalhealth.assessment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "session_answers")
public class SessionAnswer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_scale_id")
    private SessionScale sessionScale;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id")
    private AssessmentSession session;

    @Column(nullable = false, length = 30)
    private String scaleCode;

    @Column(nullable = false)
    private int questionNo;

    @Column(nullable = false, length = 50)
    private String questionKey;

    @Column(nullable = false, length = 255)
    private String questionTextSnapshot;

    @Column(nullable = false, length = 50)
    private String answerValue;

    @Column(nullable = false, length = 100)
    private String answerLabelSnapshot;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal scoreValue;

    @Column(name = "is_reverse_scored", nullable = false)
    private boolean reverseScored;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
