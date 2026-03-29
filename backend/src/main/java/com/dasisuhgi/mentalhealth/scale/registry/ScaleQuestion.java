package com.dasisuhgi.mentalhealth.scale.registry;

import java.util.List;

public record ScaleQuestion(
        int questionNo,
        String questionKey,
        String text,
        List<ScaleOption> options
) {
}
