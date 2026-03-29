package com.dasisuhgi.mentalhealth.client.service;

import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSession;
import com.dasisuhgi.mentalhealth.assessment.entity.AssessmentSessionStatus;
import com.dasisuhgi.mentalhealth.assessment.repository.AssessmentSessionRepository;
import com.dasisuhgi.mentalhealth.client.dto.ClientCreateResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientDetailResponse;
import com.dasisuhgi.mentalhealth.client.dto.ClientListItemResponse;
import com.dasisuhgi.mentalhealth.client.dto.CreateClientRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCandidateResponse;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckRequest;
import com.dasisuhgi.mentalhealth.client.dto.DuplicateCheckResponse;
import com.dasisuhgi.mentalhealth.client.dto.RecentSessionSummaryResponse;
import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.entity.Gender;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.common.error.AppException;
import com.dasisuhgi.mentalhealth.common.session.SessionUser;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClientService {
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final AssessmentSessionRepository assessmentSessionRepository;

    public ClientService(
            ClientRepository clientRepository,
            UserRepository userRepository,
            AssessmentSessionRepository assessmentSessionRepository
    ) {
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.assessmentSessionRepository = assessmentSessionRepository;
    }

    public List<ClientListItemResponse> getClients(String name, String birthDate) {
        return clientRepository.findAllByStatusNotOrderByCreatedAtDesc(ClientStatus.MISREGISTERED).stream()
                .filter(client -> name == null || name.isBlank() || client.getName().contains(name.trim()))
                .filter(client -> birthDate == null || birthDate.isBlank() || DATE_FORMAT.format(client.getBirthDate()).equals(birthDate))
                .map(client -> new ClientListItemResponse(
                        client.getId(),
                        client.getClientNo(),
                        client.getName(),
                        DATE_FORMAT.format(client.getBirthDate()),
                        client.getGender().name(),
                        client.getPrimaryWorker().getName(),
                        assessmentSessionRepository.findTopByClientIdAndStatusOrderBySessionCompletedAtDesc(client.getId(), AssessmentSessionStatus.COMPLETED)
                                .map(session -> DATE_FORMAT.format(session.getSessionDate()))
                                .orElse(null),
                        client.getStatus().name()
                ))
                .toList();
    }

    public DuplicateCheckResponse duplicateCheck(DuplicateCheckRequest request) {
        List<DuplicateCandidateResponse> candidates = clientRepository.findAllByNameAndBirthDate(request.name().trim(), request.birthDate()).stream()
                .map(client -> new DuplicateCandidateResponse(
                        client.getId(),
                        client.getClientNo(),
                        client.getName(),
                        DATE_FORMAT.format(client.getBirthDate()),
                        client.getGender().name(),
                        client.getPrimaryWorker().getName(),
                        client.getStatus().name()
                ))
                .toList();
        return new DuplicateCheckResponse(!candidates.isEmpty(), candidates);
    }

    @Transactional
    public ClientCreateResponse createClient(CreateClientRequest request, SessionUser sessionUser) {
        User currentUser = userRepository.findById(sessionUser.userId())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "로그인이 필요합니다."));
        User primaryWorker = userRepository.findById(request.primaryWorkerId())
                .orElseThrow(() -> new AppException(HttpStatus.BAD_REQUEST, "PRIMARY_WORKER_NOT_FOUND", "담당자를 찾을 수 없습니다."));
        if (primaryWorker.getStatus() != UserStatus.ACTIVE) {
            throw new AppException(HttpStatus.BAD_REQUEST, "PRIMARY_WORKER_NOT_ACTIVE", "활성 사용자만 담당자로 지정할 수 있습니다.");
        }

        Client client = new Client();
        client.setClientNo(generateClientNo());
        client.setName(request.name().trim());
        client.setGender(parseGender(request.gender()));
        client.setBirthDate(request.birthDate());
        client.setPhone(blankToNull(request.phone()));
        client.setPrimaryWorker(primaryWorker);
        client.setCreatedBy(currentUser);
        client.setStatus(ClientStatus.ACTIVE);

        Client saved = clientRepository.save(client);
        return new ClientCreateResponse(saved.getId(), saved.getClientNo());
    }

    public ClientDetailResponse getClientDetail(Long clientId) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "CLIENT_NOT_FOUND", "대상자를 찾을 수 없습니다."));

        List<RecentSessionSummaryResponse> recentSessions = assessmentSessionRepository
                .findTop10ByClientIdAndStatusOrderBySessionCompletedAtDesc(clientId, AssessmentSessionStatus.COMPLETED)
                .stream()
                .map(this::toRecentSession)
                .toList();

        return new ClientDetailResponse(
                client.getId(),
                client.getClientNo(),
                client.getName(),
                client.getGender().name(),
                DATE_FORMAT.format(client.getBirthDate()),
                client.getPhone(),
                DATETIME_FORMAT.format(client.getRegisteredAt()),
                client.getPrimaryWorker().getId(),
                client.getPrimaryWorker().getName(),
                client.getStatus().name(),
                recentSessions
        );
    }

    private RecentSessionSummaryResponse toRecentSession(AssessmentSession session) {
        return new RecentSessionSummaryResponse(
                session.getId(),
                session.getSessionNo(),
                DATETIME_FORMAT.format(session.getSessionCompletedAt()),
                session.getPerformedBy().getName(),
                session.getScaleCount(),
                session.isHasAlert(),
                session.getStatus().name()
        );
    }

    private Gender parseGender(String rawGender) {
        try {
            return Gender.valueOf(rawGender.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new AppException(HttpStatus.BAD_REQUEST, "INVALID_GENDER", "유효한 성별 값을 입력해주세요.");
        }
    }

    private String generateClientNo() {
        long next = clientRepository.count() + 1;
        return "CL-%04d".formatted(next);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
