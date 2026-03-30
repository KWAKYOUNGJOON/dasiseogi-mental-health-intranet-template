package com.dasisuhgi.mentalhealth;

import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.sequence.IdentifierSequenceRepository;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class IdentifierGenerationIntegrationTest {
    private static final DateTimeFormatter YEAR_MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ClientRepository clientRepository;

    @Autowired
    private IdentifierSequenceRepository identifierSequenceRepository;

    @Test
    void createClientGeneratesSequentialClientNumbers() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        String expectedYearMonth = LocalDate.now().format(YEAR_MONTH_FORMAT);

        String firstClientNo = createClient(session, "번호생성대상A", "1993-04-15");
        String secondClientNo = createClient(session, "번호생성대상B", "1994-04-15");

        assertThat(firstClientNo).isEqualTo("CL-%s-0001".formatted(expectedYearMonth));
        assertThat(secondClientNo).isEqualTo("CL-%s-0002".formatted(expectedYearMonth));
        assertThat(identifierSequenceRepository.countBySequenceType("CLIENT:%s".formatted(expectedYearMonth))).isEqualTo(2L);
    }

    @Test
    void saveSessionGeneratesSequentialSessionNumbers() throws Exception {
        MockHttpSession session = login("usera", "Test1234!");
        Client client = findClient("김대상", LocalDate.of(1982, 7, 13));

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(client.getId(), "첫 번째 세션"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.sessionNo").value("AS-20260328-0001"));

        mockMvc.perform(post("/api/v1/assessment-sessions")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(validPhq9SaveRequest(client.getId(), "두 번째 세션"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.sessionNo").value("AS-20260328-0002"));

        assertThat(identifierSequenceRepository.countBySequenceType("SESSION:20260328")).isEqualTo(2L);
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
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    private String createClient(MockHttpSession session, String name, String birthDate) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/clients")
                        .session(session)
                        .contentType(APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", name,
                                "gender", "FEMALE",
                                "birthDate", birthDate,
                                "phone", "010-1234-5678",
                                "primaryWorkerId", userRepository.findByLoginId("usera").orElseThrow().getId()
                        ))))
                .andExpect(status().isCreated())
                .andReturn();
        return body(result).path("data").path("clientNo").asText();
    }

    private Client findClient(String name, LocalDate birthDate) {
        return clientRepository.findAllByNameAndBirthDate(name, birthDate).stream()
                .findFirst()
                .orElseThrow();
    }

    private Map<String, Object> validPhq9SaveRequest(Long clientId, String memo) {
        return sessionSaveRequest(clientId, memo, List.of(scaleRequest("PHQ9", 0, 0, 0, 0, 0, 0, 0, 0, 1)));
    }

    private Map<String, Object> sessionSaveRequest(Long clientId, String memo, List<Map<String, Object>> selectedScales) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("clientId", clientId);
        payload.put("sessionStartedAt", "2026-03-28T13:50:00");
        payload.put("sessionCompletedAt", "2026-03-28T14:20:00");
        payload.put("memo", memo);
        payload.put("selectedScales", selectedScales);
        return payload;
    }

    private Map<String, Object> scaleRequest(String scaleCode, int... answerValues) {
        List<Map<String, Object>> answers = new java.util.ArrayList<>();
        for (int index = 0; index < answerValues.length; index++) {
            answers.add(answer(index + 1, Integer.toString(answerValues[index])));
        }

        Map<String, Object> scale = new LinkedHashMap<>();
        scale.put("scaleCode", scaleCode);
        scale.put("answers", answers);
        return scale;
    }

    private Map<String, Object> answer(int questionNo, String answerValue) {
        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("questionNo", questionNo);
        answer.put("answerValue", answerValue);
        return answer;
    }

    private JsonNode body(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
