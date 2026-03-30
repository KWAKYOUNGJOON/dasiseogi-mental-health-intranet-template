package com.dasisuhgi.mentalhealth.assessment.dto;

public record SessionAnswerResponse(
        int questionNo,
        String questionKey,
        String questionText,
        String answerValue,
        String answerLabel,
        int scoreValue
) {
}
