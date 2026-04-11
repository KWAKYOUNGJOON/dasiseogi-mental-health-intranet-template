package com.dasisuhgi.mentalhealth.app.dto;

import java.util.List;

public record AppMetadataResponse(
        String organizationName,
        List<String> positionNames
) {
}
