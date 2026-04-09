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
class ScaleMetadataIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void scaleDetailEndpointReturnsAssessmentUiMetadataFromScaleDefinitions() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");

        mockMvc.perform(get("/api/v1/scales/IESR").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.metadata.ui.formNotice.title").value("기간 안내"))
                .andExpect(jsonPath("$.data.metadata.ui.formNotice.description")
                        .value("IES-R는 \"지난 일주일 동안\" 어떠셨는지를 기준으로 응답합니다."))
                .andExpect(jsonPath("$.data.metadata.ui.preview.showResultLevel").value(true))
                .andExpect(jsonPath("$.data.metadata.ui.preview.showAlertMessages").value(true));

        mockMvc.perform(get("/api/v1/scales/KMDQ").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.metadata.ui.kmdq.impairmentQuestionNo").value(15));

        mockMvc.perform(get("/api/v1/scales/CRI").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.metadata.resultLevelLabels.A").value("극도의 위기"))
                .andExpect(jsonPath("$.data.metadata.resultLevelLabels.E").value("위기상황 아님"));
    }

    @Test
    void scaleDetailEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/scales/IESR"))
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
