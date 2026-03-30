package com.dasisuhgi.mentalhealth.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.export")
public class ExportProperties {
    public static final String DEFAULT_TEMP_PATH = "./tmp/exports";

    private String tempPath = DEFAULT_TEMP_PATH;

    public String getTempPath() {
        return tempPath;
    }

    public void setTempPath(String tempPath) {
        this.tempPath = tempPath;
    }
}
