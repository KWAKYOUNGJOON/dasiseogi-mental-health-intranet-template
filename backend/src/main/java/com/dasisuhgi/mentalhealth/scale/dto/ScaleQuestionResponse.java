package com.dasisuhgi.mentalhealth.scale.dto;

import java.util.List;

public record ScaleQuestionResponse(
        int questionNo,
        String questionKey,
        String questionText,
        List<ScaleOptionResponse> options
) {
}
