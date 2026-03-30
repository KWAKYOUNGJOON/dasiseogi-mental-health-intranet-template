package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.service.SessionSaveFailureSimulator;

public class ControllableSessionSaveFailureSimulator implements SessionSaveFailureSimulator {
    private RuntimeException nextFailure;

    public void reset() {
        nextFailure = null;
    }

    public void failWith(RuntimeException exception) {
        nextFailure = exception;
    }

    @Override
    public void afterSessionSaved(AssessmentSession session) {
        RuntimeException failure = nextFailure;
        if (failure == null) {
            return;
        }
        nextFailure = null;
        throw failure;
    }
}
