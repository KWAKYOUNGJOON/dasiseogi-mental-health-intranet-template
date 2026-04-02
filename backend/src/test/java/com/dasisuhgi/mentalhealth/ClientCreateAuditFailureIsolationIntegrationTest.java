package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.session.SessionConstants;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ClientCreateAuditFailureIsolationIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClientRepository clientRepository;

    @SpyBean
    private ActivityLogRepository activityLogRepository;

    @Test
    void createClientStillSucceedsWhenAuditLogPersistenceFails() throws Exception {
        doThrow(new RuntimeException("audit log persistence failure"))
                .when(activityLogRepository)
                .saveAndFlush(argThat(this::isClientCreateLog));

        mockMvc.perform(post("/api/v1/clients")
                        .session(loginSession("usera"))
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "로그실패대상",
                                "gender", "FEMALE",
                                "birthDate", "1990-01-02",
                                "phone", "010-1234-5678",
                                "primaryWorkerId", findUser("usera").getId()
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.clientNo").isString());

        assertThat(clientRepository.findAllByNameAndBirthDate("로그실패대상", LocalDate.of(1990, 1, 2)))
                .hasSize(1);
    }

    private boolean isClientCreateLog(ActivityLog activityLog) {
        return activityLog != null && activityLog.getActionType() == ActivityActionType.CLIENT_CREATE;
    }

    private MockHttpSession loginSession(String loginId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionConstants.USER, SessionUser.from(findUser(loginId)));
        return session;
    }

    private User findUser(String loginId) {
        return userRepository.findByLoginId(loginId).orElseThrow();
    }
}
