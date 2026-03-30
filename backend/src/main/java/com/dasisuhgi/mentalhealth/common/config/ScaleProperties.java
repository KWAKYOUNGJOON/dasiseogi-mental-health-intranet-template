package com.dasisuhgi.mentalhealth.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.scale")
public class ScaleProperties {
    public static final String DEFAULT_RESOURCE_PATH = "classpath:scales";

    private String resourcePath = DEFAULT_RESOURCE_PATH;

    public String getResourcePath() {
        return resourcePath;
    }

    public void setResourcePath(String resourcePath) {
        this.resourcePath = resourcePath;
    }
}
