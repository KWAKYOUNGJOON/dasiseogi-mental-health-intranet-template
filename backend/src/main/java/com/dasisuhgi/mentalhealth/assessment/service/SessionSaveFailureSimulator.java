package com.dasisuhgi.mentalhealth.assessment.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;

public interface SessionSaveFailureSimulator {
    void afterSessionSaved(AssessmentSession session);
}
