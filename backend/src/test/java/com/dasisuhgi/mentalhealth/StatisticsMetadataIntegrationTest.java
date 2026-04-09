package com.dasisuhgi.mentalhealth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class StatisticsMetadataIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void statisticsMetadataEndpointReturnsServerManagedAlertTypesInStableOrder() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");

        mockMvc.perform(get("/api/v1/statistics/metadata").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.alertTypes.length()").value(4))
                .andExpect(jsonPath("$.data.alertTypes[0].code").value("HIGH_RISK"))
                .andExpect(jsonPath("$.data.alertTypes[0].label").value("고위험"))
                .andExpect(jsonPath("$.data.alertTypes[1].code").value("CAUTION"))
                .andExpect(jsonPath("$.data.alertTypes[1].label").value("주의"))
                .andExpect(jsonPath("$.data.alertTypes[2].code").value("CRITICAL_ITEM"))
                .andExpect(jsonPath("$.data.alertTypes[2].label").value("개별 위험 항목"))
                .andExpect(jsonPath("$.data.alertTypes[3].code").value("COMPOSITE_RULE"))
                .andExpect(jsonPath("$.data.alertTypes[3].label").value("복합 위험"));
    }

    @Test
    void statisticsMetadataEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/statistics/metadata"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
    }

    private MockHttpSession login(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "loginId": "%s",
                                  "password": "%s"
                                }
                                """.formatted(loginId, password)))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getRequest().getSession(false)).isInstanceOf(MockHttpSession.class);
        return (MockHttpSession) result.getRequest().getSession(false);
    }
}
