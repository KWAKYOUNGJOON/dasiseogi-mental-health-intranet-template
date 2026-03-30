package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import org.springframework.stereotype.Component;

@Component
public class NoopSessionSaveFailureSimulator implements SessionSaveFailureSimulator {
    @Override
    public void afterSessionSaved(AssessmentSession session) {
    }
}
