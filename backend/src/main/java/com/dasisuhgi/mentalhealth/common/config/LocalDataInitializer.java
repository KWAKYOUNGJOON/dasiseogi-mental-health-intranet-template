package com.dasisuhgi.mentalhealth.common.config;

import com.dasisuhgi.mentalhealth.client.entity.Client;
import com.dasisuhgi.mentalhealth.client.entity.ClientStatus;
import com.dasisuhgi.mentalhealth.client.entity.Gender;
import com.dasisuhgi.mentalhealth.client.repository.ClientRepository;
import com.dasisuhgi.mentalhealth.signup.entity.ApprovalRequestStatus;
import com.dasisuhgi.mentalhealth.signup.entity.UserApprovalRequest;
import com.dasisuhgi.mentalhealth.signup.repository.UserApprovalRequestRepository;
import com.dasisuhgi.mentalhealth.user.entity.User;
import com.dasisuhgi.mentalhealth.user.entity.UserRole;
import com.dasisuhgi.mentalhealth.user.entity.UserStatus;
import com.dasisuhgi.mentalhealth.user.repository.UserRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "app.seed", name = "enabled", havingValue = "true")
public class LocalDataInitializer implements ApplicationRunner {
    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final UserApprovalRequestRepository userApprovalRequestRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public LocalDataInitializer(
            UserRepository userRepository,
            ClientRepository clientRepository,
            UserApprovalRequestRepository userApprovalRequestRepository,
            BCryptPasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.userApprovalRequestRepository = userApprovalRequestRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }

        User adminA = saveUser("admina", "관리자A", UserRole.ADMIN, UserStatus.ACTIVE);
        User userA = saveUser("usera", "사용자A", UserRole.USER, UserStatus.ACTIVE);
        User userB = saveUser("userb", "사용자B", UserRole.USER, UserStatus.ACTIVE);
        User pendingUser = saveUser("pendinguser", "승인대기", UserRole.USER, UserStatus.PENDING);
        saveUser("inactiveuser", "비활성", UserRole.USER, UserStatus.INACTIVE);
        User rejectedUser = saveUser("rejecteduser", "반려사용자", UserRole.USER, UserStatus.REJECTED);
        rejectedUser.setRejectedById(adminA.getId());
        rejectedUser.setRejectionReason("시드 반려 사유");
        rejectedUser = userRepository.save(rejectedUser);
        saveApprovalRequest(pendingUser, ApprovalRequestStatus.PENDING, null);
        saveApprovalRequest(rejectedUser, ApprovalRequestStatus.REJECTED, "시드 반려 사유");

        if (clientRepository.count() == 0) {
            saveClient("CL-0001", "김대상", Gender.MALE, LocalDate.of(1982, 7, 13), "010-1111-2222", userA, userA, ClientStatus.ACTIVE);
            saveClient("CL-0002", "박대상", Gender.FEMALE, LocalDate.of(1979, 2, 21), "010-2222-3333", userB, userB, ClientStatus.ACTIVE);
            saveClient("CL-0003", "오등록대상", Gender.UNKNOWN, LocalDate.of(1990, 5, 5), null, adminA, adminA, ClientStatus.MISREGISTERED);
        }
    }

    private User saveUser(String loginId, String name, UserRole role, UserStatus status) {
        User user = new User();
        user.setLoginId(loginId);
        user.setPasswordHash(passwordEncoder.encode("Test1234!"));
        user.setName(name);
        user.setPhone("010-0000-0000");
        user.setPositionName("사회복지사");
        user.setTeamName("정신건강팀");
        user.setRole(role);
        user.setStatus(status);
        if (status == UserStatus.REJECTED) {
            user.setRejectedAt(LocalDateTime.now());
            user.setRejectionReason("시드 반려 사유");
        }
        return userRepository.save(user);
    }

    private void saveApprovalRequest(User user, ApprovalRequestStatus requestStatus, String processNote) {
        UserApprovalRequest request = new UserApprovalRequest();
        request.setUserId(user.getId());
        request.setRequestedName(user.getName());
        request.setRequestedLoginId(user.getLoginId());
        request.setRequestedPhone(user.getPhone());
        request.setRequestedPositionName(user.getPositionName());
        request.setRequestedTeamName(user.getTeamName());
        request.setRequestMemo(processNote);
        request.setRequestStatus(requestStatus);
        request.setRequestedAt(user.getCreatedAt());
        if (requestStatus != ApprovalRequestStatus.PENDING) {
            request.setProcessedAt(user.getRejectedAt());
            request.setProcessedBy(user.getRejectedById());
            request.setProcessNote(processNote);
        }
        userApprovalRequestRepository.save(request);
    }

    private void saveClient(
            String clientNo,
            String name,
            Gender gender,
            LocalDate birthDate,
            String phone,
            User primaryWorker,
            User createdBy,
            ClientStatus status
    ) {
        Client client = new Client();
        client.setClientNo(clientNo);
        client.setName(name);
        client.setGender(gender);
        client.setBirthDate(birthDate);
        client.setPhone(phone);
        client.setPrimaryWorker(primaryWorker);
        client.setCreatedBy(createdBy);
        client.setStatus(status);
        if (status == ClientStatus.MISREGISTERED) {
            client.setMisregisteredAt(LocalDateTime.now());
            client.setMisregisteredBy(createdBy);
            client.setMisregisteredReason("시드 오등록 데이터");
        }
        clientRepository.save(client);
    }
}
