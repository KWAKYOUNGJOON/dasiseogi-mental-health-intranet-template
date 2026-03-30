package com.dasisuhgi.mentalhealth.common.sequence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IdentifierSequenceRepository extends JpaRepository<IdentifierSequence, Long> {
    long countBySequenceType(String sequenceType);
}
