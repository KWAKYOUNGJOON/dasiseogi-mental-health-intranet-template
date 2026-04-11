package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.user.support.PositionNamePolicy;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@SuppressWarnings("null")
class AppMetadataIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void appMetadataEndpointReturnsOrganizationNameAndPositionCatalogWithoutAuthentication() throws Exception {
        assertThat(PositionNamePolicy.getAllowedValues()).containsExactly("팀장", "대리", "실무자");
        assertThat(PositionNamePolicy.isAllowed("팀장")).isTrue();
        assertThat(PositionNamePolicy.isAllowed("상담사")).isFalse();

        mockMvc.perform(get("/api/v1/app/metadata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.organizationName").value("다시서기 정신건강 평가관리 시스템"))
                .andExpect(jsonPath("$.data.positionNames[0]").value("팀장"))
                .andExpect(jsonPath("$.data.positionNames[1]").value("대리"))
                .andExpect(jsonPath("$.data.positionNames[2]").value("실무자"));
    }
}
