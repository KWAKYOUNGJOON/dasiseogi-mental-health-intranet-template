package com.dasisuhgi.mentalhealth.common.sequence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@Entity
@Table(name = "identifier_sequences")
public class IdentifierSequence {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String sequenceType;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public IdentifierSequence(String sequenceType) {
        this.sequenceType = sequenceType;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
