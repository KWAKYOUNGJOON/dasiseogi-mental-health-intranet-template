package com.dasisuhgi.mentalhealth.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.test.context.support.TestPropertySourceUtils;

import static org.assertj.core.api.Assertions.assertThat;

class ProdProfileSeedIsolationTest {
    @Test
    void localSeedInitializerDoesNotLoadOnProdProfileEvenWhenPropertyIsForced() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.getEnvironment().setActiveProfiles("prod");
            TestPropertySourceUtils.addInlinedPropertiesToEnvironment(context, "app.seed.enabled=true");
            context.register(LocalDataInitializer.class);
            context.refresh();

            assertThat(context.getBeansOfType(LocalDataInitializer.class)).isEmpty();
        }
    }
}
