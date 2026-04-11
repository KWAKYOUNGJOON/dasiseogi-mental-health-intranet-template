package com.dasisuhgi.mentalhealth.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.organization")
public class OrganizationProperties {
    private String name = "다시서기 정신건강 평가관리 시스템";

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
