package com.dasisuhgi.mentalhealth.app.service;

import com.dasisuhgi.mentalhealth.app.dto.AppMetadataResponse;
import com.dasisuhgi.mentalhealth.common.config.OrganizationProperties;
import com.dasisuhgi.mentalhealth.user.support.PositionNamePolicy;
import org.springframework.stereotype.Service;

@Service
public class AppMetadataService {
    private final OrganizationProperties organizationProperties;

    public AppMetadataService(OrganizationProperties organizationProperties) {
        this.organizationProperties = organizationProperties;
    }

    public AppMetadataResponse getMetadata() {
        String organizationName = organizationProperties.getName() == null
                ? ""
                : organizationProperties.getName().trim();
        return new AppMetadataResponse(organizationName, PositionNamePolicy.getAllowedValues());
    }
}
