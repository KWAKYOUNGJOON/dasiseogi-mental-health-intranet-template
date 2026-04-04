package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.audit.entity.ActivityActionType;
import com.dasisuhgi.mentalhealth.audit.entity.ActivityLog;
import com.dasisuhgi.mentalhealth.audit.repository.ActivityLogRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@SuppressWarnings("null")
class AdminUserPositionManagementIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Test
    void adminCanUpdateUserPositionName() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        User target = findUser("usera");

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/position-name", target.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("positionName", "대리"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.positionName").value("대리"));

        mockMvc.perform(get("/api/v1/admin/users")
                        .session(session)
                        .param("keyword", "usera"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].loginId").value("usera"))
                .andExpect(jsonPath("$.data.items[0].positionName").value("대리"));

        User updated = userRepository.findById(target.getId()).orElseThrow();
        assertThat(updated.getPositionName()).isEqualTo("대리");
        assertThat(latestActivityLog(ActivityActionType.USER_POSITION_NAME_CHANGE).getTargetId()).isEqualTo(target.getId());
    }

    @Test
    void nonAdminCannotUpdateUserPositionName() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User admin = findUser("admina");
        String beforePositionName = admin.getPositionName();

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/position-name", admin.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("positionName", "실무자"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));

        User unchanged = userRepository.findById(admin.getId()).orElseThrow();
        assertThat(unchanged.getPositionName()).isEqualTo(beforePositionName);
    }

    @Test
    void adminPositionNameUpdateRejectsUnsupportedValue() throws Exception {
        MockHttpSession session = login("admina", "Test1234!");
        User target = findUser("usera");
        String beforePositionName = target.getPositionName();

        mockMvc.perform(patch("/api/v1/admin/users/{userId}/position-name", target.getId())
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of("positionName", "사회복지사"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("INVALID_POSITION_NAME"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("positionName"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value("직책 또는 역할은 팀장, 대리, 실무자 중에서 선택해주세요."));

        User unchanged = userRepository.findById(target.getId()).orElseThrow();
        assertThat(unchanged.getPositionName()).isEqualTo(beforePositionName);
    }

    @Test
    void updateMyProfileRejectsPositionNameFromPayload() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        User beforeUpdate = findUser("usera");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", "사용자A");
        payload.put("phone", "010-1234-5678");
        payload.put("positionName", "대리");
        payload.put("teamName", "정신건강팀");

        mockMvc.perform(patch("/api/v1/auth/me")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(payload)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("USER_PROFILE_UPDATE_FIELD_NOT_ALLOWED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("positionName"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value("수정할 수 없는 항목입니다."));

        User unchanged = userRepository.findById(beforeUpdate.getId()).orElseThrow();
        assertThat(unchanged.getPositionName()).isEqualTo(beforeUpdate.getPositionName());
    }

    private MockHttpSession login(String loginId, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "loginId", loginId,
                                "password", password
                        ))))
                .andExpect(status().isOk())
                .andReturn();
        return (MockHttpSession) Objects.requireNonNull(
                result.getRequest().getSession(false),
                "Expected a session after successful login"
        );
    }

    private User findUser(String loginId) {
        return userRepository.findByLoginId(loginId).orElseThrow();
    }

    private ActivityLog latestActivityLog(ActivityActionType actionType) {
        return activityLogRepository.findAll().stream()
                .filter(activityLog -> activityLog.getActionType() == actionType)
                .max(Comparator.comparing(ActivityLog::getId))
                .orElseThrow();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
