package com.dasisuhgi.mentalhealth.health.service;

import com.dasisuhgi.mentalhealth.health.dto.HealthResponse;
import com.dasisuhgi.mentalhealth.scale.service.ScaleService;
import javax.sql.DataSource;
import org.springframework.stereotype.Service;

@Service
public class HealthService {
    private final DataSource dataSource;
    private final ScaleService scaleService;

    public HealthService(DataSource dataSource, ScaleService scaleService) {
        this.dataSource = dataSource;
        this.scaleService = scaleService;
    }

    public HealthResponse getHealth() {
        boolean dbUp = isDatabaseUp();
        boolean scaleRegistryUp = scaleService.isRegistryLoaded();
        String overallStatus = dbUp && scaleRegistryUp ? "UP" : "DOWN";
        return new HealthResponse(
                overallStatus,
                "UP",
                dbUp ? "UP" : "DOWN",
                scaleRegistryUp ? "UP" : "DOWN",
                scaleService.loadedDefinitionCount()
        );
    }

    private boolean isDatabaseUp() {
        try (var connection = dataSource.getConnection()) {
            return connection.isValid(2);
        } catch (Exception exception) {
            return false;
        }
    }
}
